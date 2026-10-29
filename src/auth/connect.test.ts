import { describe, expect, it } from 'vitest';
import { serveFakeGitHub } from '../test/msw.ts';
import { createGitHubClient } from '../storage/github-client.ts';
import { inspectRepository } from './connect.ts';

const github = serveFakeGitHub();

function inspect(token = github().token, repo = github().repo) {
  return inspectRepository(createGitHubClient(token), github().owner, repo);
}

describe('inspectRepository', () => {
  it('reports a private, writable repo and its default branch', async () => {
    expect(await inspect()).toEqual({ login: 'octo-dev', ownerType: 'User', private: true, archived: false, defaultBranch: 'main', canWrite: true });
    expect(github().count('POST', /git\/blobs/)).toBe(1);
  });

  it('detects a read-only token with the write check (S-02)', async () => {
    github().canWrite = false;
    expect(await inspect()).toMatchObject({ canWrite: false });
  });

  it('sends no write check to a public or archived repo', async () => {
    github().private = false;
    expect(await inspect()).toMatchObject({ private: false, canWrite: false });
    github().private = true;
    github().archived = true;
    expect(await inspect()).toMatchObject({ archived: true, canWrite: false });
    expect(github().count('POST')).toBe(0);
  });

  it('fails with unauthorized for a bad token', async () => {
    await expect(inspect('wrong-token')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('fails with not-found for a repo the token cannot see', async () => {
    await expect(inspect(undefined, 'someone-elses-repo')).rejects.toMatchObject({ kind: 'not-found' });
  });
});
