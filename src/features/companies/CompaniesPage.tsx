// The company list (spec 02): search, filters, a sort by any column (spec 14), and archived
// companies on request, in pages of 50 (spec 08). A table with a column per field (spec 12), and the
// custom fields that the user turns on.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { memo, useCallback, useMemo, useRef } from 'react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import type { CustomField } from '@/core/custom-fields.ts';
import type { Company } from '@/core/schemas.ts';
import { table, tableBox, td } from '@/ui/data-table.ts';
import { linkButton } from '@/ui/link-button.ts';
import { SortHeader } from '@/ui/list-controls.tsx';
import { ArchivedBadge, ListSummary, ListToolbar, Pager } from '@/ui/record-page.tsx';
import { useCustomFields } from '../custom-fields/custom-values.ts';
import { CustomCells } from '../custom-fields/CustomFields.tsx';
import { companySpec } from '../list-fields.ts';
import { onePage } from '../list-page.ts';
import { listRecords, type Sort } from '../list-query.ts';
import { formatDate, useRecords } from '../records.ts';

const COLUMNS = [
  ['name', 'Name'],
  ['industry', 'Industry'],
  ['website', 'Website'],
  ['contacts', 'Contacts'],
  ['tags', 'Tags'],
  ['updated', 'Updated'],
] as const;

export function CompaniesPage() {
  const companies = useRecords('company');
  const contacts = useRecords('contact');
  const { query, showArchived, sort, filters, page: index } = useApp((s) => s.lists.company);
  const readOnly = useApp(selectReadOnly);
  const { shown: custom } = useCustomFields('company');
  const columnIds = useApp((s) => s.columns.company);
  const columns = useMemo(() => custom.filter((f) => columnIds.includes(f.id)), [custom, columnIds]);
  const list = useRef<HTMLTableElement>(null);
  const contactCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { record } of contacts) if (record.companyId && record.archivedAt === null) counts.set(record.companyId, (counts.get(record.companyId) ?? 0) + 1);
    return counts;
  }, [contacts]);
  const spec = useMemo(() => companySpec({ contactCount: (id) => contactCounts.get(id) ?? 0, custom }), [contactCounts, custom]);
  const { shown, hiddenArchived } = useMemo(
    () =>
      listRecords(
        companies.map((v) => v.record),
        { query, showArchived, sort, filters },
        (c) => [c.name, c.website ?? '', ...c.tags],
        spec,
      ),
    [companies, query, showArchived, sort, filters, spec],
  );
  const onSort = useCallback((sort: Sort) => useApp.getState().setListView('company', { sort }), []);
  const page = onePage(shown, index);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Companies</h1>
        {!readOnly && (
          <Link to="/companies/new" className={linkButton()}>
            <Plus aria-hidden />
            New company
          </Link>
        )}
      </div>
      {companies.length === 0 ? (
        <p>No companies yet.</p>
      ) : (
        <>
          <ListToolbar type="company" plural="companies" fields={spec.fields} custom={custom} />
          <ListSummary shown={shown.length} hiddenArchived={hiddenArchived} singular="company" plural="companies" page={page} />
          {shown.length > 0 && (
            <div className={tableBox}>
              <table ref={list} tabIndex={-1} aria-label="Companies" className={table}>
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
                    <CompanyRow key={c.id} company={c} contacts={contactCounts.get(c.id) ?? 0} columns={columns} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} label="Companies" list={list} onPage={(page) => useApp.getState().setListView('company', { page })} />
        </>
      )}
    </>
  );
}

// A memo: a save draws again only the row of the record that changed (docs/06).
const CompanyRow = memo(function CompanyRow({ company: c, contacts, columns }: { company: Company; contacts: number; columns: CustomField[] }) {
  return (
    <tr>
      <td className={td}>
        <span className="flex items-center gap-2">
          <Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium hover:underline">
            {c.name}
          </Link>
          {c.archivedAt && <ArchivedBadge />}
        </span>
      </td>
      <td className={td}>{c.industry}</td>
      <td className={`${td} text-muted-foreground`}>{c.website && new URL(c.website).host}</td>
      <td className={`${td} text-right tabular-nums`}>{contacts}</td>
      <td className={td}>{c.tags.join(', ')}</td>
      <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(c.updatedAt)}</td>
      <CustomCells fields={columns} values={c.customFields} />
    </tr>
  );
});
