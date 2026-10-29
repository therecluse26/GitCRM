// Pure helpers that the record forms share: list and tag input, and the compare and rebase that
// a conflict needs (spec 07).

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

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function changedFields<F extends object>(fields: F, base: F): Partial<F> {
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => !same(value, base[key as keyof F]))) as Partial<F>;
}

// After a conflict: the remote version with my changes on top. A retry then keeps what someone
// else changed in the fields I did not touch.
export function rebaseFields<F extends object>(fields: F, base: F, remote: F): F {
  return { ...remote, ...changedFields(fields, base) };
}

export type ConflictRow<F> = { key: keyof F; mine: F[keyof F]; remote: F[keyof F]; changedByMe: boolean; changedRemotely: boolean };

// The fields that I or someone else changed since `base`, the version the form started from.
export function conflictRows<F extends object>(fields: F, base: F, remote: F): ConflictRow<F>[] {
  return (Object.keys(fields) as (keyof F)[])
    .map((key) => ({ key, mine: fields[key], remote: remote[key], changedByMe: !same(fields[key], base[key]), changedRemotely: !same(remote[key], base[key]) }))
    .filter((row) => row.changedByMe || row.changedRemotely);
}
