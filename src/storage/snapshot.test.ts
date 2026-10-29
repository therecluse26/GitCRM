import { describe, expect, it } from 'vitest';
import { recordPath, WORKSPACE_PATH } from '../core/paths.ts';
import { serializeRecord, serializeWorkspace } from '../core/record-file.ts';
import { newRecord } from '../core/records.ts';
import type { WorkspaceConfig } from '../core/schemas.ts';
import { serveFakeGitHub } from '../test/msw.ts';
import { SnapshotError } from './errors.ts';
import { createGitHubClient } from './github-client.ts';
import { loadSnapshot } from './snapshot.ts';

const github = serveFakeGitHub();
const now = new Date('2026-10-28T12:00:00Z');

const config: WorkspaceConfig = {
  schemaVersion: 1,
  workspaceId: 'f81d4fae-7dec-4c1d-ae0c-0d04ef1a7291',
  name: 'Example Studio',
  defaultCurrency: 'USD',
  pipelineStages: [
    { id: 'lead', label: 'Lead', position: 0 },
    { id: 'won', label: 'Won', position: 1 },
    { id: 'lost', label: 'Lost', position: 2 },
  ],
};

function load() {
  const fake = github();
  return loadSnapshot(createGitHubClient(fake.token), { owner: fake.owner, repo: fake.repo, branch: fake.branch });
}

// Contacts with IDs spread across shards: the shard is the first two hex characters.
function contactId(n: number): string {
  return `${n.toString(16).padStart(8, '0')}-0a4c-4192-9009-9e36a51c42c0`;
}

async function seedContacts(count: number, shardOf = (n: number) => n % 256) {
  for (let n = 0; n < count; n++) {
    const shard = shardOf(n).toString(16).padStart(2, '0');
    const id = `${shard}${contactId(n).slice(2)}`;
    const record = newRecord('contact', { name: `Contact ${n}`, emails: [], phones: [], companyId: null, tags: [] }, { now, id });
    await github().seed(recordPath('contact', id), serializeRecord(record));
  }
}

describe('loadSnapshot', () => {
  it('loads the workspace and every record, pinned to one commit', async () => {
    const configSha = await github().seed(WORKSPACE_PATH, serializeWorkspace(config));
    await seedContacts(3);
    const snapshot = await load();
    expect(snapshot.commitSha).toBe(github().head);
    expect(snapshot.workspace).toEqual({ config, blobSha: configSha });
    expect(snapshot.records.map((r) => r.record.type === 'contact' && r.record.name)).toEqual(['Contact 0', 'Contact 1', 'Contact 2']);
    expect(snapshot.records.every((r) => r.commitSha === snapshot.commitSha && r.blobSha.length === 40)).toBe(true);
    expect(snapshot.issues).toEqual([]);
  });

  it('reports a missing workspace config as null, without an issue', async () => {
    const snapshot = await load();
    expect(snapshot.workspace).toBeNull();
    expect(snapshot.issues).toEqual([]);
  });

  it('reports an invalid workspace config as an issue', async () => {
    await github().seed(WORKSPACE_PATH, '{"schemaVersion": 2}');
    const snapshot = await load();
    expect(snapshot.workspace).toBeNull();
    expect(snapshot.issues).toMatchObject([{ path: WORKSPACE_PATH, code: 'unsupported-version' }]);
  });

  it('reports bad files and still loads the good ones', async () => {
    await seedContacts(2);
    const broken = recordPath('contact', `ff${contactId(9).slice(2)}`);
    await github().seed(broken, '{ not json');
    await github().seed('data/contacts/README.md', 'notes');
    await github().seed('README.md', 'files outside data/ are not read');
    const snapshot = await load();
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.issues).toEqual([
      expect.objectContaining({ path: 'data/contacts/README.md', code: 'unrecognized-path' }),
      expect.objectContaining({ path: broken, code: 'invalid-json' }),
    ]);
  });

  it('reads at most about 100 files per GraphQL query', async () => {
    await seedContacts(250);
    const snapshot = await load();
    expect(snapshot.records).toHaveLength(250);
    expect(github().count('POST', /graphql/)).toBe(3);
  });

  it('makes a bounded number of requests: ref, commit, tree, config blob, then one query per chunk', async () => {
    await github().seed(WORKSPACE_PATH, serializeWorkspace(config));
    await seedContacts(20);
    await load();
    expect(github().requests.map((r) => `${r.method} ${r.path.replace(/[0-9a-f]{40}/, '<sha>')}`)).toEqual([
      'GET /repos/octo-dev/crm/git/ref/heads/main',
      'GET /repos/octo-dev/crm/git/commits/<sha>',
      'GET /repos/octo-dev/crm/git/trees/<sha>',
      'GET /repos/octo-dev/crm/git/blobs/<sha>',
      'POST /graphql',
    ]);
  });

  it('splits a chunk that times out with 502 and retries each half once', async () => {
    await seedContacts(40);
    github().failNext('POST', /graphql/, { respond: { status: 502, body: { message: 'Server Error' } } });
    const snapshot = await load();
    expect(snapshot.records).toHaveLength(40);
    expect(github().count('POST', /graphql/)).toBe(3);
  });

  it('fails the whole load when a retried chunk fails again', async () => {
    await seedContacts(1);
    github().failNext('POST', /graphql/, { respond: { status: 502 } });
    github().failNext('POST', /graphql/, { respond: { status: 502 } });
    await expect(load()).rejects.toMatchObject({ kind: 'server' });
  });

  it('refuses a truncated tree instead of omitting records', async () => {
    await seedContacts(1);
    github().truncateTrees = true;
    await expect(load()).rejects.toBeInstanceOf(SnapshotError);
  });
});
