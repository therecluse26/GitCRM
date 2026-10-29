// Typed access to the records in the current snapshot.
import { useMemo } from 'react';
import { useApp } from '@/app/store.ts';
import type { RecordOf, RecordType } from '@/core/schemas.ts';
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

export function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp));
}
