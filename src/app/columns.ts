// The custom field columns that each list shows (spec 14). The store keeps the choice here only
// while the connection is remembered, the same as the theme (spec 12).
import type { CustomRecordType } from '@/core/custom-fields.ts';

const KEY = 'gitcrm.columns';

export type Columns = Record<CustomRecordType, string[]>;
export const NO_COLUMNS: Columns = { contact: [], company: [], opportunity: [] };

// The stored text can come from an older copy or a hand edit: only lists of field IDs count.
export function readColumns(text: string | null): Columns {
  let value: unknown;
  try {
    value = JSON.parse(text ?? 'null');
  } catch {
    return NO_COLUMNS;
  }
  if (typeof value !== 'object' || value === null) return NO_COLUMNS;
  const ids = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === 'string'))] : []);
  const stored = value as Partial<Record<CustomRecordType, unknown>>;
  return { contact: ids(stored.contact), company: ids(stored.company), opportunity: ids(stored.opportunity) };
}

export function storedColumns(): Columns {
  try {
    return readColumns(localStorage.getItem(KEY));
  } catch {
    return NO_COLUMNS; // blocked storage
  }
}

export function storeColumns(columns: Columns): void {
  try {
    if (Object.values(columns).every((ids) => ids.length === 0)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(columns));
  } catch {
    // Blocked storage: the choice lasts until the page reloads.
  }
}

export function forgetColumns(): void {
  storeColumns(NO_COLUMNS);
}
