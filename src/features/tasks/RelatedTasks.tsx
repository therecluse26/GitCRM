// The tasks linked to a contact, a company, or an opportunity, on that record's page (spec 04).
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedToggle, Problem } from '@/ui/record-page.tsx';
import { useRecords } from '../records.ts';
import { useToday } from '../use-today.ts';
import { isRelatedTo, relatedKey, type Related } from '../related.ts';
import { compareOpen } from './task-list.ts';
import { TaskItem } from './TaskItem.tsx';
import { useCompletion } from './use-completion.ts';

export function RelatedTasks({ name, related }: { name: string; related: Related }) {
  const readOnly = useApp(selectReadOnly);
  const completion = useCompletion();
  const [showArchived, setShowArchived] = useState(false);
  const linked = useRecords('task').filter((v) => isRelatedTo(v.record, related));
  const shown = linked
    .filter((v) => showArchived || v.record.archivedAt === null)
    // Open tasks first, by due date; then completed tasks, the latest first.
    .sort((a, b) => {
      const [x, y] = [a.record, b.record];
      if ((x.completedAt === null) !== (y.completedAt === null)) return x.completedAt === null ? -1 : 1;
      return x.completedAt === null ? compareOpen(x, y) : Date.parse(y.completedAt!) - Date.parse(x.completedAt!);
    });
  const today = useToday();

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <h2>Tasks</h2>
        </CardTitle>
        {!readOnly && (
          <Link to="/tasks/new" search={{ related: relatedKey(related) }} className={linkButton({ variant: 'outline', size: 'sm' })}>
            <Plus aria-hidden />
            Add task
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {completion.message && <Problem>{completion.message}</Problem>}
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ul aria-label={`Tasks for ${name}`} className="flex flex-col divide-y">
            {shown.map((saved) => (
              <TaskItem key={saved.record.id} saved={saved} today={today} completion={completion} showRelated={false} />
            ))}
          </ul>
        )}
        <ArchivedToggle hidden={linked.length - linked.filter((v) => v.record.archivedAt === null).length} showing={showArchived} singular="task" plural="tasks" onToggle={() => setShowArchived(!showArchived)} />
      </CardContent>
    </Card>
  );
}
