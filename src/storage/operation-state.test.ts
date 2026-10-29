import { describe, expect, it } from 'vitest';
import { recordPath } from '../core/paths.ts';
import { ConflictError, InvalidFileError, SnapshotError, UnknownOutcomeError } from './errors.ts';
import { GitHubError } from './github-client.ts';
import { stateForError } from './operation-state.ts';

describe('stateForError', () => {
  it('maps a conflict and keeps the remote version for comparison', () => {
    const error = new ConflictError(null, 'Someone else changed this record');
    expect(stateForError(error)).toEqual({ status: 'conflict', remote: null, message: 'Someone else changed this record' });
  });

  it('maps unauthorized and rate-limited GitHub errors to their own states', () => {
    expect(stateForError(new GitHubError('unauthorized', 401, 'GET /user', 'Bad credentials'))).toMatchObject({ status: 'unauthorized' });
    expect(stateForError(new GitHubError('rate-limited', 429, 'GET /user', 'slow down', 30))).toMatchObject({ status: 'rate-limited', retryAfterSeconds: 30 });
  });

  it.each([
    [new GitHubError('network', null, 'PUT /x'), /Could not reach GitHub/],
    [new GitHubError('forbidden', 403, 'PUT /x', 'Repository was archived so is read-only.'), /Repository was archived so is read-only\./],
    [new GitHubError('not-found', 404, 'GET /x', 'Not Found'), /not found/i],
    [new GitHubError('server', 502, 'POST /graphql', 'Server Error'), /GitHub had an error/],
    [new UnknownOutcomeError(), /may or may not have been saved/],
    [new InvalidFileError({ path: recordPath('contact', 'd13d0f69-0a4c-4192-9009-9e36a51c42c0'), code: 'invalid-json', message: 'The file is not valid JSON' }), /not valid JSON/],
    [new SnapshotError('The repository tree is too large to read in one request'), /too large/],
  ])('maps %o to a failed state with a plain message', (error, message) => {
    const state = stateForError(error);
    expect(state.status).toBe('failed');
    expect(state.status === 'failed' && state.message).toMatch(message);
  });

  it('maps an unexpected error to failed', () => {
    expect(stateForError(new TypeError('boom'))).toEqual({ status: 'failed', message: 'Unexpected error: boom' });
  });
});
