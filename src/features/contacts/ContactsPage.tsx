// The contact list (spec 02): search, filters, a sort by any column (spec 14), and archived
// contacts on request, in pages of 50 (spec 08). A table with a column per field (spec 12), and the
// custom fields that the user turns on.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { memo, useCallback, useMemo, useRef } from 'react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import type { CustomField } from '@/core/custom-fields.ts';
import type { Contact } from '@/core/schemas.ts';
import { table, tableBox, td } from '@/ui/data-table.ts';
import { linkButton } from '@/ui/link-button.ts';
import { SortHeader } from '@/ui/list-controls.tsx';
import { ArchivedBadge, ListSummary, ListToolbar, Pager } from '@/ui/record-page.tsx';
import { useCustomFields } from '../custom-fields/custom-values.ts';
import { CustomCells } from '../custom-fields/CustomFields.tsx';
import { contactSpec } from '../list-fields.ts';
import { onePage } from '../list-page.ts';
import { listRecords, type Sort } from '../list-query.ts';
import { formatDate, useRecords } from '../records.ts';

const COLUMNS = [
  ['name', 'Name'],
  ['jobTitle', 'Job title'],
  ['company', 'Company'],
  ['emails', 'Email'],
  ['phones', 'Phone'],
  ['tags', 'Tags'],
  ['updated', 'Updated'],
] as const;

export function ContactsPage() {
  const contacts = useRecords('contact');
  const companies = useRecords('company');
  const { query, showArchived, sort, filters, page: index } = useApp((s) => s.lists.contact);
  const readOnly = useApp(selectReadOnly);
  const { shown: custom } = useCustomFields('contact');
  const columnIds = useApp((s) => s.columns.contact);
  const columns = useMemo(() => custom.filter((f) => columnIds.includes(f.id)), [custom, columnIds]);
  const list = useRef<HTMLTableElement>(null);
  const companyNames = useMemo(() => new Map(companies.map(({ record }) => [record.id, record.name])), [companies]);
  const companyOf = useCallback((companyId: string | null) => (companyId && companyNames.get(companyId)) || '', [companyNames]);
  const spec = useMemo(() => contactSpec({ companyName: companyOf, custom }), [companyOf, custom]);
  const { shown, hiddenArchived } = useMemo(
    () =>
      listRecords(
        contacts.map((v) => v.record),
        { query, showArchived, sort, filters },
        (c) => [c.name, ...c.emails, ...c.phones, ...c.tags, companyOf(c.companyId)],
        spec,
      ),
    [contacts, companyOf, query, showArchived, sort, filters, spec],
  );
  const onSort = useCallback((sort: Sort) => useApp.getState().setListView('contact', { sort }), []);
  const page = onePage(shown, index);

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
          <ListToolbar type="contact" plural="contacts" fields={spec.fields} custom={custom} />
          <ListSummary shown={shown.length} hiddenArchived={hiddenArchived} singular="contact" plural="contacts" page={page} />
          {shown.length > 0 && (
            <div className={tableBox}>
              <table ref={list} tabIndex={-1} aria-label="Contacts" className={table}>
                <thead>
                  <tr>
                    {COLUMNS.map(([field, label]) => (
                      <SortHeader key={field} field={field} label={label} sort={sort} onSort={onSort} />
                    ))}
                    {columns.map((f) => (
                      <SortHeader key={f.id} field={`custom.${f.id}`} label={f.label} sort={sort} onSort={onSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((c) => (
                    <ContactRow key={c.id} contact={c} company={companyOf(c.companyId)} columns={columns} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} label="Contacts" list={list} onPage={(page) => useApp.getState().setListView('contact', { page })} />
        </>
      )}
    </>
  );
}

// A memo: a save draws again only the row of the record that changed (docs/06).
const ContactRow = memo(function ContactRow({ contact: c, company, columns }: { contact: Contact; company: string; columns: CustomField[] }) {
  return (
    <tr>
      <td className={td}>
        <span className="flex items-center gap-2">
          <Link to="/contacts/$contactId" params={{ contactId: c.id }} className="font-medium hover:underline">
            {c.name}
          </Link>
          {c.archivedAt && <ArchivedBadge />}
        </span>
      </td>
      <td className={td}>{c.jobTitle}</td>
      <td className={td}>{company}</td>
      <td className={`${td} text-muted-foreground`}>{c.emails[0]}</td>
      <td className={`${td} font-mono text-xs whitespace-nowrap text-muted-foreground`}>{c.phones[0]}</td>
      <td className={td}>{c.tags.join(', ')}</td>
      <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(c.updatedAt)}</td>
      <CustomCells fields={columns} values={c.customFields} />
    </tr>
  );
});
