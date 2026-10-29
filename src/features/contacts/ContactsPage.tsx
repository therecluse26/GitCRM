// The contact list (spec 02): search, sort, and archived contacts on request.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge, ListSummary, ListToolbar } from '@/ui/record-page.tsx';
import { listRecords } from '../list-query.ts';
import { useRecords } from '../records.ts';

export function ContactsPage() {
  const contacts = useRecords('contact');
  const companies = useRecords('company');
  const view = useApp((s) => s.lists.contact);
  const readOnly = useApp(selectReadOnly);
  const companyNames = useMemo(() => new Map(companies.map(({ record }) => [record.id, record.name])), [companies]);
  const companyOf = (companyId: string | null) => (companyId && companyNames.get(companyId)) || '';
  const { shown, hiddenArchived } = listRecords(
    contacts.map((v) => v.record),
    view,
    (c) => [c.name, ...c.emails, ...c.phones, ...c.tags, companyOf(c.companyId)],
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        {!readOnly && (
          <Link to="/contacts/new" className={linkButton()}>
            <Plus aria-hidden />
            New contact
          </Link>
        )}
      </div>
      {contacts.length === 0 ? (
        <p>No contacts yet.</p>
      ) : (
        <>
          <ListToolbar type="contact" plural="contacts" />
          <ListSummary shown={shown.length} hiddenArchived={hiddenArchived} singular="contact" plural="contacts" />
          {shown.length > 0 && (
            <ul aria-label="Contacts" className="divide-y rounded-lg border">
              {shown.map((c) => (
                <li key={c.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link to="/contacts/$contactId" params={{ contactId: c.id }} className="font-medium break-words hover:underline">
                      {c.name}
                    </Link>
                    {c.archivedAt && <ArchivedBadge />}
                  </span>
                  <span className="text-sm break-words text-muted-foreground">{[companyOf(c.companyId), c.emails[0]].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
