// Pure helpers that the record forms share: list, tag, and address input, and the compare and
// rebase that a conflict needs (spec 07).
import { ADDRESS_PARTS, isWebsite, withScheme, type Address } from '@/core/schemas.ts';

export type FieldErrors = Record<string, string>;
export type FormResult<F> = { ok: true; fields: F } | { ok: false; errors: FieldErrors };

// "referral, VIP,, vip" -> ["referral", "VIP"]: a repeated tag counts once, ignoring case.
export function splitTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '' && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
}

export function cleanList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== '');
}

// The values other records use, for suggestions (spec 13): each once, ignoring case, sorted. Of
// two spellings, the more used one shows; a tie goes to the first in code point order.
export function usedValues(values: (string | null)[]): string[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const value of values) {
    if (!value?.trim()) continue;
    const counts = spellings.get(value.toLowerCase()) ?? new Map<string, number>();
    spellings.set(value.toLowerCase(), counts.set(value, (counts.get(value) ?? 0) + 1));
  }
  const best = (counts: Map<string, number>) => [...counts].sort(([a, n], [b, m]) => m - n || (a < b ? -1 : 1))[0][0];
  return [...spellings.values()].map(best).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// A list input always shows at least one row.
export const listRows = (values: string[]) => (values.length > 0 ? values : ['']);

// Blank text stores null (spec 13).
export const optionalText = (text: string) => text.trim() || null;

// Web addresses, one per row: a row with no scheme gets https://, and a bad row gets an error.
export function readWebAddresses(name: string, values: string[], errors: FieldErrors, message: string): string[] {
  return values.flatMap((value, i) => {
    const typed = value.trim();
    if (typed === '') return [];
    if (!isWebsite(withScheme(typed))) errors[`${name}.${i}`] = message;
    return [withScheme(typed)];
  });
}

export type AddressValues = Record<(typeof ADDRESS_PARTS)[number], string>;

export function addressValues(address: Address | null): AddressValues {
  return Object.fromEntries(ADDRESS_PARTS.map((part) => [part, address?.[part] ?? ''])) as AddressValues;
}

// Each street line is trimmed, and empty lines go. An address with no part is null.
export function readAddress(values: AddressValues): Address | null {
  const street = cleanList(values.street.split('\n')).join('\n') || null;
  const parts = Object.fromEntries(ADDRESS_PARTS.map((part) => [part, part === 'street' ? street : optionalText(values[part])])) as Address;
  return Object.values(parts).some((part) => part !== null) ? parts : null;
}

// One line for a page or a compare row: "12 Main St, Suite 4, Portland, USA".
export const addressText = (address: Address | null) => (address ? ADDRESS_PARTS.flatMap((part) => address[part]?.split('\n') ?? []).join(', ') : '');

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Each custom field counts as its own field (spec 10): `customFields.linkedin` and
// `customFields.source` are compared, merged, and listed one by one.
const CUSTOM = 'customFields';
const customOf = (fields: object): Record<string, unknown> => (fields as { customFields?: Record<string, unknown> }).customFields ?? {};

function flat(fields: object): Map<string, unknown> {
  const entries = Object.entries(fields).flatMap(([key, value]) =>
    key === CUSTOM ? Object.entries(customOf(fields)).map(([id, v]): [string, unknown] => [`${CUSTOM}.${id}`, v]) : [[key, value] as [string, unknown]],
  );
  return new Map(entries);
}

export function changedKeys(fields: object, base: object): string[] {
  const [a, b] = [flat(fields), flat(base)];
  return [...new Set([...a.keys(), ...b.keys()])].filter((key) => !same(a.get(key), b.get(key)));
}

// The fields in a group mean something only together, such as an amount and its currency. When I
// changed one of them, all of them count as mine.
export type FieldGroups<F> = (keyof F)[][];

function myChanges<F extends object>(fields: F, base: F, groups: FieldGroups<F>): Set<string> {
  const mine = new Set(changedKeys(fields, base));
  for (const group of groups) if (group.some((key) => mine.has(key as string))) for (const key of group) mine.add(key as string);
  return mine;
}

// After a conflict: the remote version with my changes on top. A retry then keeps what someone
// else changed in the fields, and the custom fields, that I did not touch.
export function rebaseFields<F extends object>(fields: F, base: F, remote: F, groups: FieldGroups<F> = []): F {
  const result = { ...remote } as Record<string, unknown>;
  const custom = { ...customOf(remote) };
  let customChanged = false;
  for (const key of myChanges(fields, base, groups)) {
    if (!key.startsWith(`${CUSTOM}.`)) {
      result[key] = fields[key as keyof F];
      continue;
    }
    const id = key.slice(CUSTOM.length + 1);
    const value = customOf(fields)[id];
    if (value === undefined) delete custom[id];
    else custom[id] = value;
    customChanged = true;
  }
  if (customChanged) result[CUSTOM] = Object.keys(custom).length > 0 ? custom : undefined;
  return result as F;
}

// `customId` names the custom field of a `customFields` row.
export type ConflictRow<F> = { key: keyof F; customId?: string; mine: unknown; remote: unknown; changedByMe: boolean; changedRemotely: boolean };

// The fields that I or someone else changed since `base`, the version the form started from.
export function conflictRows<F extends object>(fields: F, base: F, remote: F, groups: FieldGroups<F> = []): ConflictRow<F>[] {
  const mine = myChanges(fields, base, groups);
  const [mineFlat, baseFlat, remoteFlat] = [flat(fields), flat(base), flat(remote)];
  return (Object.keys(fields) as (keyof F & string)[])
    .flatMap((key): { key: keyof F; customId?: string; flatKey: string }[] => {
      if (key !== CUSTOM) return [{ key, flatKey: key }];
      const ids = [...new Set([fields, base, remote].flatMap((f) => Object.keys(customOf(f))))].sort();
      return ids.map((id) => ({ key, customId: id, flatKey: `${CUSTOM}.${id}` }));
    })
    .map(({ flatKey, ...row }): ConflictRow<F> => ({
      ...row,
      mine: mineFlat.get(flatKey),
      remote: remoteFlat.get(flatKey),
      changedByMe: mine.has(flatKey),
      changedRemotely: !same(remoteFlat.get(flatKey), baseFlat.get(flatKey)),
    }))
    .filter((row) => row.changedByMe || row.changedRemotely);
}
