// Filtering and sorting for record lists (specs 02 and 14): search in memory, archived records
// hidden unless asked for (spec 06), filters on any field, and a sort by any column.
import { isCalendarDate } from '@/core/schemas.ts';

// Case and accents do not matter: "zoe" finds "Zoë".
export const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
// Every word of a search must appear in a record's search text.
export const searchWords = (query: string) => fold(query).split(/\s+/).filter(Boolean);

// How a list reads a field of a record. Text is a list of values, such as the emails of a contact;
// a choice is an option ID; a date is YYYY-MM-DD. `sortKey` replaces the value in a sort, such as
// the first email or the full time of a change.
type FieldOf<K extends string, V, R> = { id: string; label: string; kind: K; value: (record: R) => V };
export type ChoiceOption = { id: string; label: string };
export type ListField<R> =
  | (FieldOf<'text', string[], R> & { sortKey?: (record: R) => string | null })
  | (FieldOf<'choice', string | null, R> & { options: ChoiceOption[] })
  | FieldOf<'number', number | null, R>
  | (FieldOf<'date', string | null, R> & { sortKey?: (record: R) => string | null })
  | FieldOf<'checkbox', boolean, R>;
export type FieldKind = ListField<unknown>['kind'];

export const CONDITIONS = {
  text: { contains: 'contains', is: 'is', empty: 'is empty', notEmpty: 'is not empty' },
  choice: { is: 'is', isNot: 'is not', empty: 'is empty', notEmpty: 'is not empty' },
  number: { is: 'is', atLeast: 'at least', atMost: 'at most', empty: 'is empty', notEmpty: 'is not empty' },
  date: { is: 'is', onOrAfter: 'on or after', onOrBefore: 'on or before', empty: 'is empty', notEmpty: 'is not empty' },
  checkbox: { checked: 'is checked', notChecked: 'is not checked' },
} as const;
export type Condition = { [K in FieldKind]: keyof (typeof CONDITIONS)[K] }[FieldKind];
const NO_VALUE = new Set<Condition>(['empty', 'notEmpty', 'checked', 'notChecked']);
export const needsValue = (condition: Condition) => !NO_VALUE.has(condition);

// `id` keeps a row's inputs when an earlier row goes away.
export type Filter = { id: number; field: string; condition: Condition; value: string };
export type Sort = { field: string; direction: 'ascending' | 'descending' };
export type ListView = { query: string; showArchived: boolean; sort: Sort; filters: Filter[]; page: number };
// A list's fields, its first sort, and the fields that break a tie, before the ID.
export type ListSpec<R> = { fields: ListField<R>[]; start: Sort; ties: string[] };

export const nameSort: Sort = { field: 'name', direction: 'ascending' };
export const DEFAULT_LIST_VIEW: ListView = { query: '', showArchived: false, sort: nameSort, filters: [], page: 0 };

export const nextFilterId = (filters: Filter[]) => Math.max(0, ...filters.map((f) => f.id)) + 1;

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

// The value a filter compares with, or null when the filter does not apply yet.
function operand(field: ListField<unknown>, { condition, value }: Filter): string | number | null {
  if (!(condition in CONDITIONS[field.kind])) return null;
  if (!needsValue(condition)) return '';
  const typed = value.trim();
  if (typed === '') return null;
  if (field.kind === 'number') return Number.isFinite(Number(typed)) ? Number(typed) : null;
  if (field.kind === 'date') return isCalendarDate(typed) ? typed : null;
  return field.kind === 'text' ? fold(typed) : typed;
}

export function matches<R>(field: ListField<R>, filter: Filter, record: R): boolean {
  const want = operand(field as ListField<unknown>, filter);
  if (want === null) return true;
  const { condition } = filter;
  if (field.kind === 'text') {
    const values = field.value(record).map(fold);
    if (condition === 'empty') return values.length === 0;
    if (condition === 'notEmpty') return values.length > 0;
    return values.some((v) => (condition === 'is' ? v === want : v.includes(want as string)));
  }
  if (field.kind === 'checkbox') return field.value(record) === (condition === 'checked');
  const value = field.value(record);
  if (condition === 'empty') return value === null;
  if (condition === 'notEmpty') return value !== null;
  if (condition === 'isNot') return value !== want;
  if (value === null) return false;
  if (condition === 'atLeast' || condition === 'onOrAfter') return value >= want;
  if (condition === 'atMost' || condition === 'onOrBefore') return value <= want;
  return value === want;
}

export function filterRecords<R>(records: R[], filters: Filter[], fields: ListField<R>[]): R[] {
  const active = filters.flatMap((filter) => {
    const field = fields.find((f) => f.id === filter.field);
    return field && operand(field as ListField<unknown>, filter) !== null ? [{ field, filter }] : [];
  });
  if (active.length === 0) return records;
  return records.filter((record) => active.every(({ field, filter }) => matches(field, filter, record)));
}

type Key = string | number | null;

// A field's sort key for a record: null when empty. A choice sorts by option position, and an
// unknown option after the known ones.
function sortKey<R>(field: ListField<R>, record: R): Key {
  switch (field.kind) {
    case 'text': {
      if (field.sortKey) return field.sortKey(record) || null;
      const values = field.value(record);
      return values.length > 0 ? values.join(', ') : null;
    }
    case 'choice': {
      const value = field.value(record);
      if (value === null) return null;
      const at = field.options.findIndex((o) => o.id === value);
      return at === -1 ? field.options.length : at;
    }
    case 'date':
      return field.sortKey ? field.sortKey(record) : field.value(record);
    case 'checkbox':
      return field.value(record) ? 1 : 0;
    default:
      return field.value(record);
  }
}

// Empty last; text by the collator, so case and accents do not matter.
function compareKeys(a: Key, b: Key, text: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (text) return collator.compare(a as string, b as string);
  return a < b ? -1 : a > b ? 1 : 0;
}

// A new array; the same order on every load, because the ID breaks the last tie.
export function sortRecords<R extends { id: string }>(records: R[], sort: Sort, spec: ListSpec<R>): R[] {
  const find = (id: string) => spec.fields.find((f) => f.id === id);
  const by = find(sort.field) ? sort : spec.start;
  const order = [{ field: find(by.field)!, sign: by.direction === 'descending' ? -1 : 1 }, ...spec.ties.flatMap((id) => (find(id) ? [{ field: find(id)!, sign: 1 }] : []))];
  const keyed = records.map((record) => ({ record, keys: order.map(({ field }) => sortKey(field, record)) }));
  keyed.sort((a, b) => {
    for (const [i, { field, sign }] of order.entries()) {
      const [ka, kb] = [a.keys[i], b.keys[i]];
      const c = compareKeys(ka, kb, field.kind === 'text');
      // An empty value is last in both directions.
      if (c !== 0) return ka === null || kb === null ? c : c * sign;
    }
    return a.record.id < b.record.id ? -1 : 1;
  });
  return keyed.map(({ record }) => record);
}

// `hiddenArchived` counts the archived records that match but are not shown.
export function listRecords<R extends { id: string; archivedAt: string | null }>(
  records: R[],
  view: Pick<ListView, 'query' | 'showArchived' | 'sort' | 'filters'>,
  searchText: (record: R) => string[],
  spec: ListSpec<R>,
): { shown: R[]; hiddenArchived: number } {
  const words = searchWords(view.query);
  const found = records.filter((record) => {
    const text = fold(searchText(record).join('\n'));
    return words.every((word) => text.includes(word));
  });
  const matching = filterRecords(found, view.filters, spec.fields);
  const shown = view.showArchived ? matching : matching.filter((record) => record.archivedAt === null);
  return { shown: sortRecords(shown, view.sort, spec), hiddenArchived: matching.length - shown.length };
}
