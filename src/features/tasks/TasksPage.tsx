// Tasks (spec 04): open tasks grouped into Overdue and Upcoming, or the completed tasks.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { selectReadOnly, useApp } from '@/app/store.ts';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { selectClassName } from '@/ui/form-fields.tsx';
import { linkButton } from '@/ui/link-button.ts';
import { ListSummary, Problem } from '@/ui/record-page.tsx';
import { useRecords } from '../records.ts';
import { useToday } from '../use-today.ts';
import { listTasks, type TaskView } from './task-list.ts';
import { TaskItem } from './TaskItem.tsx';
import { useCompletion } from './use-completion.ts';

export function TasksPage() {
  const view = useApp((s) => s.tasks);
  const readOnly = useApp(selectReadOnly);
  const saved = useRecords('task');
  const completion = useCompletion();
  const today = useToday();
  const { groups, shown, hiddenArchived } = listTasks(saved.map((v) => v.record), today, view);
  const versionOf = (id: string) => saved.find((v) => v.record.id === id)!;
  const set = useApp.getState().setTaskView;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        {!readOnly && (
          <Link to="/tasks/new" className={linkButton()}>
            <Plus aria-hidden />
            New task
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tasks-show">Show</Label>
          <select id="tasks-show" className={selectClassName} value={view.show} onChange={(e) => set({ show: e.target.value as TaskView['show'] })}>
            <option value="open">Open tasks</option>
            <option value="completed">Completed tasks</option>
          </select>
        </div>
        <div className="flex h-8 items-center gap-2">
          <Checkbox id="tasks-archived" aria-labelledby="tasks-archived-label" checked={view.showArchived} onCheckedChange={(checked) => set({ showArchived: checked === true })} />
          <Label id="tasks-archived-label" htmlFor="tasks-archived">Show archived</Label>
        </div>
      </div>
      <ListSummary shown={shown} hiddenArchived={hiddenArchived} singular={view.show === 'open' ? 'open task' : 'completed task'} plural={view.show === 'open' ? 'open tasks' : 'completed tasks'} />
      {completion.message && <Problem>{completion.message}</Problem>}
      {groups.map((group) => (
        <section key={group.name} aria-labelledby={`tasks-${group.name}`} className="flex flex-col gap-1">
          <h2 id={`tasks-${group.name}`} className="text-lg font-medium">{group.name}</h2>
          <ul className="flex flex-col divide-y">
            {group.tasks.map((task) => (
              <TaskItem key={task.id} saved={versionOf(task.id)} today={today} completion={completion} showRelated />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
