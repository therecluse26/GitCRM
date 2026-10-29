// Parts that the record lists and detail pages share.
import type { ReactNode } from 'react';
import { useApp, type AppState } from '@/app/store.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selectClassName } from './form-fields.tsx';

export function ListToolbar({ type, plural }: { type: keyof AppState['lists']; plural: string }) {
  const view = useApp((s) => s.lists[type]);
  const set = (changes: Partial<typeof view>) => useApp.getState().setListView(type, changes);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor="list-search">Search {plural}</Label>
        <Input id="list-search" type="search" autoComplete="off" value={view.query} onChange={(e) => set({ query: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="list-sort">Sort by</Label>
        <select id="list-sort" className={selectClassName} value={view.sort} onChange={(e) => set({ sort: e.target.value as typeof view.sort })}>
          <option value="name">Name</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>
      <div className="flex h-8 items-center gap-2">
        <Checkbox id="show-archived" aria-labelledby="show-archived-label" checked={view.showArchived} onCheckedChange={(checked) => set({ showArchived: checked === true })} />
        <Label id="show-archived-label" htmlFor="show-archived">Show archived</Label>
      </div>
    </div>
  );
}

export function ListSummary({ shown, hiddenArchived, singular, plural }: { shown: number; hiddenArchived: number; singular: string; plural: string }) {
  const count = (n: number, archived = '') => `${n} ${archived}${n === 1 ? singular : plural}`;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {count(shown)}
      {hiddenArchived > 0 && `. ${count(hiddenArchived, 'archived ')} hidden.`}
    </p>
  );
}

export function ArchivedBadge() {
  return <Badge variant="secondary">Archived</Badge>;
}

export function Problem({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function RecordNotFound({ singular, back }: { singular: string; back: ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p>
        This {singular} is not in the workspace. Someone may have deleted it, or the link is wrong. {back}
      </p>
    </>
  );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline">{tag}</Badge>
      ))}
    </span>
  );
}
