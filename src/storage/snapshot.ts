// Reads main into a validated in-memory snapshot with the chunked GraphQL tree walk (ADR-022).
// Every expression is pinned to one commit SHA, so all records come from the same commit.
import { parseRecordPath, WORKSPACE_PATH } from '../core/paths.ts';
import { parseRecordFile, parseWorkspaceFile, unrecognizedPath, type FileIssue } from '../core/record-file.ts';
import { base64ToUtf8 } from './encoding.ts';
import { SnapshotError } from './errors.ts';
import { GitHubError, type GitHubClient } from './github-client.ts';
import type { VersionedRecord, WorkspaceSnapshot } from './workspace-repository.ts';

// S-04: about 100 files per query; one query of 800 files timed out.
const FILES_PER_QUERY = 100;
const PARALLEL_QUERIES = 10;

export type RepoLocation = { owner: string; repo: string; branch: string };
type FileText = { oid: string; text: string | null; isTruncated: boolean };
type TreeResult = { entries: { name: string; oid: string; object: { text?: string | null; isTruncated?: boolean } }[] } | null;

export function repoPath({ owner, repo }: RepoLocation): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export async function readHead(client: GitHubClient, location: RepoLocation): Promise<{ sha: string; tree: string }> {
  const branch = location.branch.split('/').map(encodeURIComponent).join('/');
  const ref = await client.rest<{ object: { sha: string } }>('GET', `${repoPath(location)}/git/ref/heads/${branch}`);
  const commit = await client.rest<{ tree: { sha: string } }>('GET', `${repoPath(location)}/git/commits/${ref.object.sha}`);
  return { sha: ref.object.sha, tree: commit.tree.sha };
}

// Every file on main: path -> blob SHA.
export async function readTree(client: GitHubClient, location: RepoLocation, treeSha: string): Promise<Map<string, string>> {
  const tree = await client.rest<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(
    'GET',
    `${repoPath(location)}/git/trees/${treeSha}?recursive=1`,
  );
  // GitHub cuts off very large trees; reading on would silently omit records.
  if (tree.truncated) throw new SnapshotError('The repository tree is too large to read in one request, so GitCRM cannot load every record');
  return new Map(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.sha]));
}

export async function loadSnapshot(client: GitHubClient, location: RepoLocation): Promise<WorkspaceSnapshot> {
  const head = await readHead(client, location);
  const files = await readTree(client, location, head.tree);
  const issues: FileIssue[] = [];

  let workspace: WorkspaceSnapshot['workspace'] = null;
  const configSha = files.get(WORKSPACE_PATH);
  if (configSha) {
    const blob = await client.rest<{ content: string }>('GET', `${repoPath(location)}/git/blobs/${configSha}`);
    const parsed = parseWorkspaceFile(base64ToUtf8(blob.content));
    if (parsed.ok) workspace = { config: parsed.config, blobSha: configSha };
    else issues.push(parsed.issue);
  }

  const wanted = new Map<string, string>();
  for (const [path, sha] of files) {
    if (!path.startsWith('data/')) continue;
    if (parseRecordPath(path)) wanted.set(path, sha);
    else issues.push(unrecognizedPath(path));
  }

  const texts = await readFiles(client, location, head.sha, [...wanted.keys()]);
  const records: VersionedRecord[] = [];
  for (const [path, sha] of wanted) {
    const file = texts.get(path);
    if (!file || file.oid !== sha) throw new SnapshotError(`GitHub did not return ${path}, so GitCRM cannot load every record`);
    if (file.isTruncated) issues.push({ path, code: 'too-large', message: 'GitHub cut this file off because it is too large' });
    else if (file.text === null) issues.push({ path, code: 'invalid-json', message: 'The file is binary, not JSON' });
    else {
      const parsed = parseRecordFile(path, file.text);
      if (parsed.ok) records.push({ record: parsed.record, path, blobSha: sha, commitSha: head.sha });
      else issues.push(parsed.issue);
    }
  }

  const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : 1);
  return { commitSha: head.sha, workspace, records: records.sort(byPath), issues: issues.sort(byPath) };
}

async function readFiles(client: GitHubClient, location: RepoLocation, commitSha: string, paths: string[]): Promise<Map<string, FileText>> {
  const results = new Map<string, FileText>();
  const chunks = chunkByFolder(paths);
  let next = 0;
  let failed = false;

  async function worker() {
    while (!failed && next < chunks.length) {
      const dirs = chunks[next++];
      try {
        for (const [path, file] of await queryFolders(client, location, commitSha, dirs)) results.set(path, file);
      } catch (error) {
        failed = true; // stop the other workers from sending more queries
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_QUERIES, chunks.length) }, worker));
  return results;
}

// Packs whole shard folders into chunks of about FILES_PER_QUERY files.
function chunkByFolder(paths: string[]): string[][] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const [dir, count] of counts) {
    if (current.length > 0 && size + count > FILES_PER_QUERY) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(dir);
    size += count;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function queryFolders(client: GitHubClient, location: RepoLocation, commitSha: string, dirs: string[], retry = true): Promise<Map<string, FileText>> {
  try {
    const query = `query($owner: String!, $name: String!, ${dirs.map((_, i) => `$e${i}: String!`).join(', ')}) {
      repository(owner: $owner, name: $name) { ${dirs.map((_, i) => `d${i}: object(expression: $e${i}) { ...Files }`).join(' ')} }
    } fragment Files on Tree { entries { name oid object { ... on Blob { text isTruncated } } } }`;
    const variables = { owner: location.owner, name: location.repo, ...Object.fromEntries(dirs.map((dir, i) => [`e${i}`, `${commitSha}:${dir}`])) };
    const data = await client.graphql<{ repository: Record<string, TreeResult> }>(query, variables);
    const files = new Map<string, FileText>();
    dirs.forEach((dir, i) => {
      for (const entry of data.repository[`d${i}`]?.entries ?? []) {
        files.set(`${dir}/${entry.name}`, { oid: entry.oid, text: entry.object.text ?? null, isTruncated: entry.object.isTruncated ?? false });
      }
    });
    return files;
  } catch (error) {
    // GitHub ends a query that runs over 10 s with 502 or 504 (S-04): split it and retry once.
    const timedOut = error instanceof GitHubError && (error.status === 502 || error.status === 504);
    if (!retry || !timedOut) throw error;
    if (dirs.length === 1) return queryFolders(client, location, commitSha, dirs, false);
    const half = Math.ceil(dirs.length / 2);
    const first = await queryFolders(client, location, commitSha, dirs.slice(0, half), false);
    const second = await queryFolders(client, location, commitSha, dirs.slice(half), false);
    return new Map([...first, ...second]);
  }
}
