// The opportunities linked to a company or a contact, on that record's page (docs/08).
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/core/money.ts';
import type { Opportunity } from '@/core/schemas.ts';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge } from '@/ui/record-page.tsx';
import { useRecords, useStages } from '../records.ts';
import type { NewOpportunitySearch } from './OpportunityEditor.tsx';
import { stageName } from './pipeline.ts';

export function RelatedOpportunities({ name, linked, search }: { name: string; linked: (o: Opportunity) => boolean; search: NewOpportunitySearch }) {
  const stages = useStages();
  const readOnly = useApp(selectReadOnly);
  const opportunities = useRecords('opportunity')
    .map((v) => v.record)
    .filter(linked)
    // Active opportunities first, then by title.
    .sort((a, b) => Number(a.archivedAt !== null) - Number(b.archivedAt !== null) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2>Opportunities</h2>
        </CardTitle>
        {!readOnly && (
          <Link to="/opportunities/new" search={search} className={linkButton({ variant: 'outline', size: 'sm' })}>
            <Plus aria-hidden />
            Add opportunity
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opportunities yet.</p>
        ) : (
          <ul aria-label={`Opportunities with ${name}`} className="flex flex-col gap-1 text-sm">
            {opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <Link to="/opportunities/$opportunityId" params={{ opportunityId: o.id }} className="underline">{o.title}</Link>
                <span className="text-muted-foreground">{[stageName(stages, o.stageId), o.valueMinor !== null && formatMoney(o.valueMinor, o.currency)].filter(Boolean).join(' · ')}</span>
                {o.archivedAt && <ArchivedBadge />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
