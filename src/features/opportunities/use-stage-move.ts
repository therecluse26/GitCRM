// Moving an opportunity to another stage (spec 03): one commit to that opportunity's file. The
// move shows as pending until the commit lands; on failure the card goes back and says why.
import { useState } from 'react';
import { useApp } from '@/app/store.ts';
import { editRecord } from '@/core/records.ts';
import type { Opportunity } from '@/core/schemas.ts';
import { stateForError } from '@/storage/operation-state.ts';
import type { VersionedRecord } from '@/storage/workspace-repository.ts';

export function useStageMove() {
  const [pending, setPending] = useState<{ id: string; stageId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function move(saved: VersionedRecord<Opportunity>, stageId: string) {
    if (pending || stageId === saved.record.stageId) return;
    setPending({ id: saved.record.id, stageId });
    setMessage(null);
    try {
      await useApp.getState().saveRecord(editRecord(saved.record, { stageId }, new Date()), saved.blobSha);
    } catch (error) {
      const state = stateForError(error);
      const why =
        state.status === 'conflict'
          ? 'Someone else changed it after it was loaded. The board shows their version; move it again if you still want to.'
          : 'message' in state
            ? state.message
            : '';
      setMessage(`${saved.record.title} was not moved. ${why}`);
    } finally {
      setPending(null);
    }
  }

  return { pending, message, move };
}
