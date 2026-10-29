// Every state a load or a save can be in. The UI renders each one explicitly.
import { ConflictError, InvalidFileError, SnapshotError, UnknownOutcomeError } from './errors.ts';
import { GitHubError, type GitHubErrorKind } from './github-client.ts';
import type { VersionedRecord } from './workspace-repository.ts';

export type OperationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'unsaved' }
  | { status: 'saving' }
  | { status: 'committed'; commitSha: string | null }
  | { status: 'conflict'; remote: VersionedRecord | null; message: string }
  | { status: 'unauthorized'; message: string }
  | { status: 'rate-limited'; retryAfterSeconds: number | null; message: string }
  | { status: 'failed'; message: string };

const MESSAGES: Partial<Record<GitHubErrorKind, string>> = {
  network: 'Could not reach GitHub. Check the connection, then try again.',
  'not-found': 'Not found: the repository or file does not exist, or the token cannot see it.',
  server: 'GitHub had an error. Try again later.',
};

export function stateForError(error: unknown): OperationState {
  if (error instanceof ConflictError) return { status: 'conflict', remote: error.remote, message: error.message };
  if (error instanceof GitHubError) {
    if (error.kind === 'unauthorized') return { status: 'unauthorized', message: 'The token expired or was revoked. Connect again with a new token.' };
    if (error.kind === 'rate-limited') {
      const wait = error.retryAfterSeconds === null ? 'later' : `in ${Math.ceil(error.retryAfterSeconds / 60)} min`;
      return { status: 'rate-limited', retryAfterSeconds: error.retryAfterSeconds, message: `GitHub asked GitCRM to slow down. Try again ${wait}.` };
    }
    return { status: 'failed', message: MESSAGES[error.kind] ?? `GitHub refused the request: ${error.githubMessage ?? error.status}` };
  }
  if (error instanceof UnknownOutcomeError) {
    return { status: 'failed', message: 'GitHub did not answer, so the change may or may not have been saved. Reload before you try again.' };
  }
  if (error instanceof InvalidFileError || error instanceof SnapshotError) return { status: 'failed', message: error.message };
  return { status: 'failed', message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
}
