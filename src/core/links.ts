// Links between records must point to records in the same workspace (docs/02). The UI cannot
// create a broken link, but a hand edit or another app can. A broken link is reported, and the
// record still loads.
import type { FileIssue } from './record-file.ts';
import type { CRMRecord, RecordType } from './schemas.ts';

export function linkIssues(entries: { path: string; record: CRMRecord }[]): FileIssue[] {
  const ids = new Set(entries.map(({ record }) => `${record.type}:${record.id}`));
  const issues: FileIssue[] = [];
  for (const { path, record } of entries) {
    const problems = links(record)
      .filter(({ type, id }) => !ids.has(`${type}:${id}`))
      .map(({ field, type, id }) => `${field}: no ${type} with ID ${id.slice(0, 8)} is in the workspace`);
    if (problems.length > 0) issues.push({ path, code: 'broken-link', message: problems.join('; ') });
  }
  return issues;
}

function links(record: CRMRecord): { field: string; type: RecordType; id: string }[] {
  switch (record.type) {
    case 'contact':
      return record.companyId ? [{ field: 'companyId', type: 'company', id: record.companyId }] : [];
    case 'company':
      return [];
    case 'opportunity':
      return [
        ...(record.companyId ? [{ field: 'companyId', type: 'company' as const, id: record.companyId }] : []),
        ...record.contactIds.map((id) => ({ field: 'contactIds', type: 'contact' as const, id })),
      ];
    case 'task':
    case 'activity':
      return record.related ? [{ field: 'related', ...record.related }] : [];
  }
}
