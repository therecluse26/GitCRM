// Typed access to the records and the pipeline stages in the current snapshot.
import { useMemo } from 'react';
import { useApp } from '@/app/store.ts';
import type { RecordOf, RecordType } from '@/core/schemas.ts';
import { sortStages, type Stage } from '@/core/stages.ts';
import type { VersionedRecord, WorkspaceSnapshot } from '@/storage/workspace-repository.ts';

export function recordsOf<T extends RecordType>(snapshot: WorkspaceSnapshot | null, type: T): VersionedRecord<RecordOf<T>>[] {
  return (snapshot?.records ?? []).filter((v): v is VersionedRecord<RecordOf<T>> => v.record.type === type);
}

export function useRecords<T extends RecordType>(type: T): VersionedRecord<RecordOf<T>>[] {
  const snapshot = useApp((s) => s.snapshot);
  return useMemo(() => recordsOf(snapshot, type), [snapshot, type]);
}

export function useRecord<T extends RecordType>(type: T, id: string): VersionedRecord<RecordOf<T>> | undefined {
  return useRecords(type).find((v) => v.record.id === id);
}

// The address of a new-record page can link the new record: "Add contact" on a company page passes
// companyId, and "Add task" passes related, such as "opportunity:<uuid>". Every new-record page
// shares this one shape. With one shape per route, this router version types its route IDs as
// any, and each page would see every route's search type.
export type NewRecordSearch = { companyId?: string; contactId?: string; related?: string };

export function readNewRecordSearch({ companyId, contactId, related }: Record<string, unknown>): NewRecordSearch {
  return {
    ...(typeof companyId === 'string' && { companyId }),
    ...(typeof contactId === 'string' && { contactId }),
    ...(typeof related === 'string' && { related }),
  };
}

// The selector returns the stored array, so the component re-renders only when the stages change.
export function useStages(): Stage[] {
  const stages = useApp((s) => s.snapshot?.workspace?.config.pipelineStages);
  return useMemo(() => sortStages(stages ?? []), [stages]);
}

export function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp));
}

// A moment in the user's time zone, such as when a call happened.
export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

// A YYYY-MM-DD calendar date, such as an expected close date: the same day in every time zone.
export function formatCalendarDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
