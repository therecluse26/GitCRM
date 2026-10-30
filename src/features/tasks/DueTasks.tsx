// Home's due and overdue tasks (docs/08). Each one can be completed from here.
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Problem } from '@/ui/record-page.tsx';
import { useRecords } from '../records.ts';
import { useToday } from '../use-today.ts';
import { compareOpen, isDue } from './task-list.ts';
import { TaskItem } from './TaskItem.tsx';
import { useCompletion } from './use-completion.ts';

export function DueTasks() {
  const today = useToday();
  const completion = useCompletion();
  // A task stays on the list while its completion is saving, so the checkbox does not jump away.
  const due = useRecords('task')
    .filter((v) => v.record.archivedAt === null && (isDue(v.record, today) || completion.pending === v.record.id))
    .sort((a, b) => compareOpen(a.record, b.record));

  return (
    <section aria-labelledby="due-tasks-heading">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <h2 id="due-tasks-heading">Tasks due</h2>
          </CardTitle>
          <Link to="/tasks" className="text-sm underline">All tasks</Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {completion.message && <Problem>{completion.message}</Problem>}
          {due.length === 0 ? (
            <p className="text-sm text-muted-foreground">No task is due today or overdue.</p>
          ) : (
            <ul aria-label="Tasks due" className="flex flex-col divide-y">
              {due.map((saved) => (
                <TaskItem key={saved.record.id} saved={saved} today={today} completion={completion} showRelated />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
