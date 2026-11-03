// Leads (spec 15): the leads that wait in the lead inbox. The owner adds each one as a contact or
// discards it. GitCRM checks the inbox when this page opens and when the owner asks, never in the
// background (ADR-006).
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import type { LeadSetup } from '@/app/lead-setup.ts';
import { selectCanWrite, selectReadOnly, useApp } from '@/app/store.ts';
import { Button } from '@/components/ui/button';
import { recordPath } from '@/core/paths.ts';
import { InboxError, type Lead, type LeadInbox } from '@/inbox/inbox.ts';
import { stateForError } from '@/storage/operation-state.ts';
import { table, tableBox, td, th } from '@/ui/data-table.ts';
import { formatDateTime } from '../records.ts';
import { AddLeadError, addLead } from './add-lead.ts';
import { leadSummary } from './lead-records.ts';
import { openInbox } from './open-inbox.ts';

type RowState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'adding' }
  | { status: 'discarding' }
  | { status: 'added'; contactId: string; name: string }
  | { status: 'failed'; message: string };
type Row = { lead: Lead; state: RowState };
type Load = { status: 'checking' } | { status: 'loaded'; unreadable: number; more: boolean } | { status: 'failed'; message: string };

const MESSAGE_LENGTH = 120;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// One sentence for a failure: the reason, and which step it stopped at.
function failureMessage(error: unknown): string {
  const cause = error instanceof AddLeadError ? error.cause : error;
  const state = stateForError(cause);
  const reason = cause instanceof InboxError ? cause.message : 'message' in state ? state.message : 'Something went wrong.';
  if (error instanceof AddLeadError && error.step === 'note') return `Contact added, note not saved. ${reason}`;
  if (error instanceof AddLeadError && error.step === 'remove') return `Added. Formcarry still has this lead. ${reason}`;
  return reason;
}

// What one check of the inbox leaves on the page.
async function readInbox(inbox: LeadInbox): Promise<{ rows: Row[]; load: Load }> {
  try {
    const { leads, unreadable, more } = await inbox.list();
    return { rows: leads.map((lead) => ({ lead, state: { status: 'idle' } })), load: { status: 'loaded', unreadable, more } };
  } catch (error) {
    return { rows: [], load: { status: 'failed', message: error instanceof InboxError ? error.message : 'Something went wrong while checking Formcarry. Try again.' } };
  }
}

// The Button component does not pass autoFocus on, so a button that must take focus when it
// appears does it here.
function FocusedButton(props: ComponentProps<typeof Button>) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <Button ref={ref} {...props} />;
}

export function LeadsPage() {
  const setup = useApp((s) => s.leadSetup);
  return (
    <>
      <h1 className="text-2xl font-semibold">Leads</h1>
      {setup ? (
        <Leads setup={setup} />
      ) : (
        <p>
          No lead form is set up on this device. <Link to="/settings" className="underline">Set it up in Settings</Link>.
        </p>
      )}
    </>
  );
}

function Leads({ setup }: { setup: LeadSetup }) {
  const inbox = useMemo(() => openInbox(setup), [setup]);
  const canWrite = useApp(selectCanWrite);
  const readOnly = useApp(selectReadOnly);
  const [load, setLoad] = useState<Load>({ status: 'checking' });
  const [rows, setRows] = useState<Row[]>([]);
  const [refocus, setRefocus] = useState<string | null>(null); // the row whose Discard button gets focus back
  const [focusCheck, setFocusCheck] = useState(0); // a discarded row takes focus with it: go to "Check for leads"
  const newest = useRef(0);
  const checkButton = useRef<HTMLButtonElement>(null);
  const busy = rows.some(({ state }) => state.status === 'adding' || state.status === 'discarding');

  // The page starts in the "checking" state, so only a later check sets it again. Only the newest
  // check shows its answer.
  useEffect(() => {
    const mine = ++newest.current;
    void readInbox(inbox).then((result) => {
      if (mine !== newest.current) return;
      setRows(result.rows);
      setLoad(result.load);
    });
    return () => {
      newest.current += 1;
    };
  }, [inbox]);

  // After the render, because the button is disabled while a row is being discarded.
  useEffect(() => {
    if (focusCheck > 0) checkButton.current?.focus();
  }, [focusCheck]);

  function recheck() {
    const mine = ++newest.current;
    setLoad({ status: 'checking' });
    void readInbox(inbox).then((result) => {
      if (mine !== newest.current) return;
      setRows(result.rows);
      setLoad(result.load);
    });
  }

  const setState = (id: string, state: RowState) => setRows((all) => all.map((row) => (row.lead.id === id ? { ...row, state } : row)));

  async function add(lead: Lead) {
    setState(lead.id, { status: 'adding' });
    try {
      const { contactId, name } = await addLead(lead, {
        service: setup.service,
        formId: setup.formId,
        now: () => new Date(),
        exists: (type, id) => useApp.getState().snapshot?.records.some((version) => version.path === recordPath(type, id)) ?? false,
        create: (record) => useApp.getState().saveRecord(record, null),
        inbox,
      });
      setState(lead.id, { status: 'added', contactId, name });
    } catch (error) {
      setState(lead.id, { status: 'failed', message: failureMessage(error) });
    }
  }

  async function discard(lead: Lead) {
    setState(lead.id, { status: 'discarding' });
    try {
      await inbox.remove(lead);
      setRows((all) => all.filter((row) => row.lead.id !== lead.id));
      setFocusCheck((n) => n + 1);
    } catch (error) {
      setState(lead.id, { status: 'failed', message: failureMessage(error) });
    }
  }

  const count = rows.length;
  const summary =
    load.status === 'loaded'
      ? [
          count === 0 ? 'No new leads.' : `${count} new ${plural(count, 'lead', 'leads')}.`,
          load.unreadable > 0 ? `${load.unreadable} ${plural(load.unreadable, 'lead could', 'leads could')} not be read. ${plural(load.unreadable, 'It stays', 'They stay')} in Formcarry.` : '',
          load.more ? 'Showing the oldest 500. Add or discard some, then check again.' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : load.status === 'checking'
        ? 'Checking Formcarry…'
        : '';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={checkButton} variant="outline" disabled={load.status === 'checking' || busy} onClick={recheck}>
          Check for leads
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {summary}
        </p>
      </div>
      {load.status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {load.message}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">GitCRM is read-only here, so changes cannot be saved. You can still discard leads.</p>
      ) : !canWrite && !busy && count > 0 ? (
        <p className="text-sm text-muted-foreground">You can add leads when GitCRM finishes checking GitHub.</p>
      ) : null}
      {count > 0 && (
        <div className={tableBox}>
          <table aria-label="Leads" className={table}>
            <thead>
              <tr>
                <th className={th}>Received</th>
                <th className={th}>From</th>
                <th className={th}>Email</th>
                <th className={th}>Phone</th>
                <th className={th}>Message</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lead, state }) => {
                const { name, email, phone, message } = leadSummary(lead);
                return (
                  <tr key={lead.id}>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(lead.receivedAt)}</td>
                    <td className={`${td} font-medium`}>{name}</td>
                    <td className={`${td} break-all`}>{email}</td>
                    <td className={`${td} whitespace-nowrap`}>{phone}</td>
                    <td className={`${td} min-w-48`} title={message.length > MESSAGE_LENGTH ? message : undefined}>
                      {message.length > MESSAGE_LENGTH ? `${message.slice(0, MESSAGE_LENGTH)}…` : message}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-2">
                        {state.status === 'added' ? (
                          <span role="status">
                            Added:{' '}
                            <Link to="/contacts/$contactId" params={{ contactId: state.contactId }} className="font-medium underline">
                              {state.name}
                            </Link>
                          </span>
                        ) : state.status === 'adding' || state.status === 'discarding' ? (
                          <span role="status">{state.status === 'adding' ? 'Adding…' : 'Discarding…'}</span>
                        ) : state.status === 'confirming' ? (
                          <>
                            <FocusedButton size="sm" variant="destructive" disabled={busy} onClick={() => void discard(lead)}>
                              Confirm discard<span className="sr-only"> for {name}</span>
                            </FocusedButton>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRefocus(lead.id);
                                setState(lead.id, { status: 'idle' });
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" disabled={!canWrite || busy} onClick={() => void add(lead)}>
                              Add as contact<span className="sr-only"> for {name}</span>
                            </Button>
                            {refocus === lead.id ? (
                              <FocusedButton size="sm" variant="outline" disabled={busy} onClick={() => setState(lead.id, { status: 'confirming' })}>
                                Discard<span className="sr-only"> lead from {name}</span>
                              </FocusedButton>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => setState(lead.id, { status: 'confirming' })}>
                                Discard<span className="sr-only"> lead from {name}</span>
                              </Button>
                            )}
                            {state.status === 'failed' && (
                              <span role="alert" className="text-destructive">
                                {state.message}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
