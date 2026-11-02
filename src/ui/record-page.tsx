// Parts that the record lists and detail pages share.
import type { ReactNode, RefObject } from 'react';
import { useApp, type AppState } from '@/app/store.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '@/core/custom-fields.ts';
import { ADDRESS_PARTS, type Address } from '@/core/schemas.ts';
import type { Page } from '@/features/list-page.ts';
import type { ListField } from '@/features/list-query.ts';
import { ColumnsMenu, Filters } from './list-controls.tsx';

// Search, "Show archived", the Columns menu, and the filter rows of Contacts and Companies (spec 14).
export function ListToolbar<R>({ type, plural, fields, custom }: { type: keyof AppState['lists']; plural: string; fields: ListField<R>[]; custom: CustomField[] }) {
  const view = useApp((s) => s.lists[type]);
  const columns = useApp((s) => s.columns[type]);
  const set = (changes: Partial<typeof view>) => useApp.getState().setListView(type, changes);
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="list-search">Search {plural}</Label>
          <Input id="list-search" type="search" autoComplete="off" value={view.query} onChange={(e) => set({ query: e.target.value })} />
        </div>
        <div className="flex h-8 items-center gap-2">
          <Checkbox id="show-archived" aria-labelledby="show-archived-label" checked={view.showArchived} onCheckedChange={(checked) => set({ showArchived: checked === true })} />
          <Label id="show-archived-label" htmlFor="show-archived">Show archived</Label>
        </div>
        <ColumnsMenu fields={custom} shown={columns} onChange={(ids) => useApp.getState().setColumns(type, ids)} />
      </div>
      <Filters fields={fields} filters={view.filters} onChange={(filters) => set({ filters })} />
    </>
  );
}

// With `page`, a list longer than one page says which rows show: "Showing 51–100 of 120 contacts".
export function ListSummary({ shown, hiddenArchived, singular, plural, page }: { shown: number; hiddenArchived: number; singular: string; plural: string; page?: Page<unknown> }) {
  const count = (n: number, archived = '') => `${n} ${archived}${n === 1 ? singular : plural}`;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {page && page.count > 1 ? `Showing ${page.from}–${page.to} of ${count(shown)}` : count(shown)}
      {hiddenArchived > 0 && `. ${count(hiddenArchived, 'archived ')} hidden.`}
    </p>
  );
}

// Previous and Next for a list in pages (spec 08). Focus moves to the list, so a screen reader reads
// the new rows, and the list's first row scrolls into view.
export function Pager({ page, label, list, onPage }: { page: Page<unknown>; label: string; list: RefObject<HTMLElement | null>; onPage: (index: number) => void }) {
  if (page.count <= 1) return null;
  const go = (index: number) => {
    onPage(index);
    list.current?.focus({ preventScroll: true });
    list.current?.scrollIntoView({ block: 'start' });
  };
  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center gap-2 text-sm">
      <Button type="button" variant="outline" size="sm" disabled={page.index === 0} onClick={() => go(page.index - 1)}>
        Previous page
      </Button>
      <span className="text-muted-foreground">
        Page {page.index + 1} of {page.count}
      </span>
      <Button type="button" variant="outline" size="sm" disabled={page.index === page.count - 1} onClick={() => go(page.index + 1)}>
        Next page
      </Button>
    </nav>
  );
}

// On a record page, a card hides its archived items until asked (spec 06).
export function ArchivedToggle({ hidden, showing, singular, plural, onToggle }: { hidden: number; showing: boolean; singular: string; plural: string; onToggle: () => void }) {
  if (hidden === 0) return null;
  const count = `${hidden} archived ${hidden === 1 ? singular : plural}`;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {showing ? `Showing ${count}.` : `${count} hidden.`}
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onToggle}>
        {showing ? 'Hide archived' : 'Show archived'}
      </Button>
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

const none = <span className="text-muted-foreground">None</span>;

// Email addresses, phone numbers, or web addresses as links. A web address opens in a new tab.
export function LinkList({ items, href, newTab = false }: { items: string[]; href: (item: string) => string; newTab?: boolean }) {
  if (items.length === 0) return none;
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <a className="underline" href={href(item)} {...(newTab && { target: '_blank', rel: 'noopener noreferrer' })}>{item}</a>
        </li>
      ))}
    </ul>
  );
}

export function PhoneList({ phones }: { phones: string[] }) {
  return <LinkList items={phones} href={(phone) => `tel:${phone.replace(/[^\d+]/g, '')}`} />;
}

export function TextOrNone({ text }: { text: string | null }) {
  return text === null ? none : <span className="whitespace-pre-line">{text}</span>;
}

// One part per line, in the stored order; a street keeps its own lines.
export function AddressLines({ address }: { address: Address | null }) {
  if (!address) return none;
  return (
    <address className="not-italic">
      {ADDRESS_PARTS.flatMap((part) => address[part]?.split('\n') ?? []).map((line, i) => (
        <span key={i} className="block">{line}</span>
      ))}
    </address>
  );
}
