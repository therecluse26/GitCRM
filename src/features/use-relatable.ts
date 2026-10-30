// The records a task or an activity can link to: their IDs for the form checks, their names, and
// their pages.
import { useMemo } from 'react';
import type { CRMRecord } from '@/core/schemas.ts';
import { useRecords } from './records.ts';
import type { Related, RelatedIds, RelatedType } from './related.ts';

const NOUNS: Record<RelatedType, string> = { contact: 'contact', company: 'company', opportunity: 'opportunity' };

export const nameOf = (record: CRMRecord) => ('name' in record ? record.name : 'title' in record ? record.title : record.id);

// The records a task or an activity can link to, and their IDs for the form checks.
export function useRelatable() {
  const contacts = useRecords('contact');
  const companies = useRecords('company');
  const opportunities = useRecords('opportunity');
  return useMemo(() => {
    const records = { contact: contacts, company: companies, opportunity: opportunities };
    const idsOf = (list: { record: CRMRecord }[]) => new Set(list.map((v) => v.record.id));
    const ids: RelatedIds = { contact: idsOf(contacts), company: idsOf(companies), opportunity: idsOf(opportunities) };
    const find = (related: Related) => records[related.type].find((v) => v.record.id === related.id)?.record;
    // The name to show for a link, also when its record is missing.
    const name = (related: Related | null) => {
      if (!related) return 'None';
      const record = find(related);
      return record ? nameOf(record) : `Missing ${NOUNS[related.type]} (ID ${related.id.slice(0, 8)})`;
    };
    return { records, ids, find, name };
  }, [contacts, companies, opportunities]);
}

// The page of a linked record, or Home when there is no link.
export function pageOf(related: Related | null) {
  if (related?.type === 'contact') return { to: '/contacts/$contactId', params: { contactId: related.id } } as const;
  if (related?.type === 'company') return { to: '/companies/$companyId', params: { companyId: related.id } } as const;
  if (related?.type === 'opportunity') return { to: '/opportunities/$opportunityId', params: { opportunityId: related.id } } as const;
  return { to: '/' } as const;
}
