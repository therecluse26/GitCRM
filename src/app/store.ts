// The app's in-memory state (ADR-012: Zustand): the connection, the snapshot, and the sync status.
// The token lives here in memory, and in localStorage only when "Remember on this device" is on.
import { create } from 'zustand';
import { assessRepository, describeConnectError, inspectRepository, type Access } from '../auth/connect.ts';
import { forgetConnection, readSavedConnection, saveConnection, type SavedConnection } from '../auth/credentials.ts';
import { WORKSPACE_PATH } from '../core/paths.ts';
import { serializeWorkspace } from '../core/record-file.ts';
import { newWorkspaceConfig } from '../core/workspace.ts';
import { createGitHubClient, GitHubError } from '../storage/github-client.ts';
import { createGitHubWorkspace } from '../storage/github-workspace.ts';
import { stateForError, type OperationState } from '../storage/operation-state.ts';
import { createRecordCache } from '../storage/record-cache.ts';
import { snapshotFromFiles, type SnapshotFiles } from '../storage/snapshot.ts';
import type { WorkspaceRepository, WorkspaceSnapshot } from '../storage/workspace-repository.ts';

export type Screen =
  | { name: 'starting' }
  | { name: 'connect'; problem: string | null; busy: boolean }
  | { name: 'initialize' }
  | { name: 'blocked'; problem: string }
  | { name: 'ready' };

export type Credentials = SavedConnection & { remember: boolean };

// What the connect checks found. Null until they pass, so writes stay disabled while a page loads.
type Session = {
  login: string;
  branch: string;
  access: Exclude<Access, { kind: 'refused' }>;
  workspace: WorkspaceRepository;
};

export type AppState = {
  screen: Screen;
  repoName: string; // owner/repo
  credentials: Credentials | null;
  session: Session | null;
  snapshot: WorkspaceSnapshot | null;
  files: SnapshotFiles | null; // what the record cache holds
  sync: OperationState;
  start(): Promise<void>;
  connect(credentials: Credentials): Promise<void>;
  refresh(): Promise<void>;
  initialize(input: { name: string; defaultCurrency: string }): Promise<void>;
  disconnect(): Promise<void>;
};

// Saves need a write-capable token and a finished sync (docs/04, "Page load with a cached snapshot").
export const selectCanWrite = (state: AppState) => state.session?.access.kind === 'write' && state.sync.status === 'loaded';

class RefusedError extends Error {}

const cache = createRecordCache();
const cacheKey = ({ owner, repo }: { owner: string; repo: string }) => `${owner}/${repo}`.toLowerCase();
const cleared = { session: null, snapshot: null, files: null, sync: { status: 'idle' } } satisfies Partial<AppState>;
let started = false; // StrictMode runs effects twice in development

export const useApp = create<AppState>()((set, get) => {
  function show(snapshot: WorkspaceSnapshot, files: SnapshotFiles) {
    set({ snapshot, files, sync: { status: 'loaded' }, screen: screenFor(snapshot) });
    if (get().credentials?.remember) void cache.write(cacheKey(get().credentials!), files);
  }

  // The connect checks (docs/05), then main, reusing the cached files.
  async function establish(credentials: Credentials, cached: SnapshotFiles | null) {
    const client = createGitHubClient(credentials.token);
    const check = await inspectRepository(client, credentials.owner, credentials.repo);
    const access = assessRepository(check);
    if (access.kind === 'refused') throw new RefusedError(access.message);
    const workspace = createGitHubWorkspace({ client, owner: credentials.owner, repo: credentials.repo, branch: check.defaultBranch });
    const loaded = await workspace.loadWorkspace(cached ?? undefined);
    set({ session: { login: check.login, branch: check.defaultBranch, access, workspace } });
    show(loaded.snapshot, loaded.files);
  }

  // What a failed connect, page load, or refresh leaves on screen.
  function fail(error: unknown, from: 'connect' | 'load') {
    const problem = error instanceof RefusedError ? error.message : describeConnectError(error, get().repoName);
    const tokenRejected = error instanceof GitHubError && (error.kind === 'unauthorized' || error.kind === 'not-found');
    if (from === 'connect' || tokenRejected) {
      if (tokenRejected) forgetConnection();
      set({ ...cleared, credentials: null, screen: { name: 'connect', problem, busy: false } });
    } else if (!(error instanceof RefusedError) && get().snapshot) {
      // GitHub is unreachable or slowing us down: keep the records on screen, read-only (ARCHITECTURE, "Offline model").
      set({ sync: stateForError(error) });
    } else {
      // A refusal here means the repo turned public: stop showing its records.
      set({ ...cleared, screen: { name: 'blocked', problem } });
    }
  }

  return {
    screen: { name: 'starting' },
    repoName: '',
    credentials: null,
    ...cleared,

    async start() {
      if (started) return;
      started = true;
      const saved = readSavedConnection();
      if (!saved) return set({ screen: { name: 'connect', problem: null, busy: false } });
      const credentials = { ...saved, remember: true };
      set({ credentials, repoName: `${saved.owner}/${saved.repo}` });
      const cached = await cache.read(cacheKey(saved));
      if (cached) {
        const snapshot = snapshotFromFiles(cached);
        if (snapshot.workspace) set({ snapshot, files: cached, sync: { status: 'loading' }, screen: { name: 'ready' } });
      }
      try {
        await establish(credentials, cached);
      } catch (error) {
        fail(error, 'load');
      }
    },

    async connect(credentials) {
      set({ ...cleared, credentials, repoName: `${credentials.owner}/${credentials.repo}`, screen: { name: 'connect', problem: null, busy: true } });
      try {
        if (!credentials.remember) {
          // A shared computer: store nothing in this browser.
          forgetConnection();
          await cache.clear();
        }
        await establish(credentials, credentials.remember ? await cache.read(cacheKey(credentials)) : null);
        if (credentials.remember) saveConnection({ owner: credentials.owner, repo: credentials.repo, token: credentials.token });
      } catch (error) {
        fail(error, 'connect');
      }
    },

    async refresh() {
      const { credentials, files } = get();
      if (!credentials) return;
      set({ sync: { status: 'loading' } });
      try {
        await establish(credentials, files);
      } catch (error) {
        fail(error, 'load');
      }
    },

    async initialize(input) {
      const { session, files } = get();
      if (session?.access.kind !== 'write') throw new Error('This token cannot write to the repository');
      const config = newWorkspaceConfig(input);
      const saved = await session.workspace.writeWorkspace(config, null);
      const next: SnapshotFiles = {
        commitSha: null,
        files: new Map(files?.files).set(WORKSPACE_PATH, { blobSha: saved.blobSha, text: serializeWorkspace(config), isTruncated: false }),
      };
      show(snapshotFromFiles(next), next);
    },

    async disconnect() {
      forgetConnection();
      await cache.clear();
      set({ ...cleared, credentials: null, repoName: '', screen: { name: 'connect', problem: null, busy: false } });
    },
  };
});

function screenFor(snapshot: WorkspaceSnapshot): Screen {
  const issue = snapshot.issues.find((i) => i.path === WORKSPACE_PATH);
  if (issue?.code === 'unsupported-version') {
    return { name: 'blocked', problem: 'A newer version of GitCRM set up this workspace. Open it with that version; this one will not change it.' };
  }
  if (issue) return { name: 'blocked', problem: `The workspace settings file, ${WORKSPACE_PATH}, is invalid: ${issue.message}. Fix it in the repository; GitCRM will not overwrite it.` };
  return snapshot.workspace ? { name: 'ready' } : { name: 'initialize' };
}
