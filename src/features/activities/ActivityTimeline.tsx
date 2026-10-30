// The activity timeline on a contact, company, or opportunity page (spec 04): the latest first.
// A body shows as plain text, so markup in a note never runs.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { selectCanWrite, selectReadOnly, useApp } from '@/app/store.ts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Activity } from '@/core/schemas.ts';
import type { VersionedRecord } from '@/storage/workspace-repository.ts';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge, ArchivedToggle, Problem } from '@/ui/record-page.tsx';
import { formatDateTime, useRecords } from '../records.ts';
import { isRelatedTo, relatedKey, type Related } from '../related.ts';
import { useArchive } from '../use-archive.ts';
import { kindLabel } from './activity-form.ts';
import { timeline } from './timeline.ts';

export function ActivityTimeline({ name, related }: { name: string; related: Related }) {
  const readOnly = useApp(selectReadOnly);
  const [showArchived, setShowArchived] = useState(false);
  const linked = useRecords('activity').filter((v) => isRelatedTo(v.record, related));
  const active = linked.filter((v) => v.record.archivedAt === null);
  const order = timeline((showArchived ? linked : active).map((v) => v.record));
  const versionOf = (id: string) => linked.find((v) => v.record.id === id)!;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2>Activity</h2>
        </CardTitle>
        {!readOnly && (
          <Link to="/activities/new" search={{ related: relatedKey(related) }} className={linkButton({ variant: 'outline', size: 'sm' })}>
            <Plus aria-hidden />
            Log activity
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {order.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol aria-label={`Activity with ${name}`} className="flex flex-col divide-y">
            {order.map((activity) => (
              <ActivityItem key={activity.id} saved={versionOf(activity.id)} />
            ))}
          </ol>
        )}
        <ArchivedToggle hidden={linked.length - active.length} showing={showArchived} singular="activity" plural="activities" onToggle={() => setShowArchived(!showArchived)} />
      </CardContent>
    </Card>
  );
}

function ActivityItem({ saved }: { saved: VersionedRecord<Activity> }) {
  const readOnly = useApp(selectReadOnly);
  const canWrite = useApp(selectCanWrite);
  const archive = useArchive(saved);
  const activity = saved.record;
  return (
    <li className="flex flex-col gap-1 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{kindLabel(activity.kind)}</span>
        <span className="text-muted-foreground">{formatDateTime(activity.occurredAt)}</span>
        {archive.archived && <ArchivedBadge />}
        {!readOnly && (
          <span className="ml-auto flex gap-1">
            <Link to="/activities/$activityId/edit" params={{ activityId: activity.id }} className={linkButton({ variant: 'ghost', size: 'sm' })}>
              Edit<span className="sr-only"> {kindLabel(activity.kind).toLowerCase()} from {formatDateTime(activity.occurredAt)}</span>
            </Link>
            <Button variant="ghost" size="sm" disabled={!canWrite} onClick={() => void archive.toggle()}>
              {archive.saving ? 'Saving…' : archive.archived ? 'Restore' : 'Archive'}
              <span className="sr-only"> {kindLabel(activity.kind).toLowerCase()} from {formatDateTime(activity.occurredAt)}</span>
            </Button>
          </span>
        )}
      </div>
      {/* React puts the body in a text node: tags in a note show as typed and never run. */}
      <p className="break-words whitespace-pre-wrap">{activity.body}</p>
      {archive.message && <Problem>{archive.message}</Problem>}
    </li>
  );
}
