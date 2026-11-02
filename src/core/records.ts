// Pure record creation and editing. Callers pass the clock, so results are deterministic.
import { serializeRecord } from './record-file.ts';
import { RECORD_VERSIONS, recordSchemas, VERSION_2_FIELDS, type CRMRecord, type RecordOf, type RecordType } from './schemas.ts';

export type RecordFields<T extends RecordType> = Omit<RecordOf<T>, 'schemaVersion' | 'type' | 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>;
type Version2Key<T extends RecordType> = T extends keyof typeof VERSION_2_FIELDS ? keyof (typeof VERSION_2_FIELDS)[T & keyof typeof VERSION_2_FIELDS] & keyof RecordFields<T> : never;
// The version 2 fields of a contact or company (ADR-028) may be left out; they start empty.
export type NewRecordFields<T extends RecordType> = Omit<RecordFields<T>, Version2Key<T>> & Partial<Pick<RecordFields<T>, Version2Key<T>>>;
export type RecordChanges<R extends CRMRecord> = Partial<Omit<R, 'schemaVersion' | 'type' | 'id' | 'createdAt' | 'updatedAt'>>;

export function isoTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function newRecord<T extends RecordType>(type: T, fields: NewRecordFields<T>, { now, id = crypto.randomUUID() }: { now: Date; id?: string }): RecordOf<T> {
  const at = isoTimestamp(now);
  const kind: RecordType = type;
  const empty = kind === 'contact' || kind === 'company' ? VERSION_2_FIELDS[kind] : {};
  return recordSchemas[type].parse({ schemaVersion: RECORD_VERSIONS[type], type, id, ...empty, ...fields, createdAt: at, updatedAt: at, archivedAt: null }) as RecordOf<T>;
}

// Sets updatedAt only when the content changes, so an unchanged form never makes a commit.
export function editRecord<R extends CRMRecord>(record: R, changes: RecordChanges<R>, now: Date): R {
  const merged = { ...record, ...changes } as R;
  if (serializeRecord(merged) === serializeRecord(record)) return record;
  return { ...merged, updatedAt: isoTimestamp(now) };
}
