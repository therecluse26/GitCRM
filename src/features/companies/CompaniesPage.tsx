// The company list (spec 02): search, sort, and archived companies on request.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge, ListSummary, ListToolbar } from '@/ui/record-page.tsx';
import { listRecords } from '../list-query.ts';
import { useRecords } from '../records.ts';

export function CompaniesPage() {
  const companies = useRecords('company');
  const contacts = useRecords('contact');
  const view = useApp((s) => s.lists.company);
  const readOnly = useApp(selectReadOnly);
  const contactCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { record } of contacts) if (record.companyId && record.archivedAt === null) counts.set(record.companyId, (counts.get(record.companyId) ?? 0) + 1);
    return counts;
  }, [contacts]);
  const { shown, hiddenArchived } = listRecords(
    companies.map((v) => v.record),
    view,
    (c) => [c.name, c.website ?? '', ...c.tags],
  );
  const contactsLine = (n: number) => (n === 0 ? '' : n === 1 ? '1 contact' : `${n} contacts`);

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
          <ListToolbar type="company" plural="companies" />
          <ListSummary shown={shown.length} hiddenArchived={hiddenArchived} singular="company" plural="companies" />
          {shown.length > 0 && (
            <ul aria-label="Companies" className="divide-y rounded-lg border">
              {shown.map((c) => (
                <li key={c.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link to="/companies/$companyId" params={{ companyId: c.id }} className="font-medium break-words hover:underline">
                      {c.name}
                    </Link>
                    {c.archivedAt && <ArchivedBadge />}
                  </span>
                  <span className="text-sm break-words text-muted-foreground">
                    {[c.website && new URL(c.website).host, contactsLine(contactCounts.get(c.id) ?? 0)].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
