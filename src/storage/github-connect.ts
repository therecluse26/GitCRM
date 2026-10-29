// The connect checks (docs/05-AUTH-AND-ONBOARDING.md): identity, repo metadata, then a write check.
import { GitHubError, type GitHubClient } from './github-client.ts';

export type RepoCheck = {
  login: string;
  ownerType: string; // 'User' or 'Organization'
  private: boolean;
  archived: boolean;
  defaultBranch: string;
  canWrite: boolean;
};

// 401 and 404 come back as GitHubError. A 404 means a wrong name, a repo outside the token,
// or a token with no permissions (S-02, S-08).
export async function inspectRepository(client: GitHubClient, owner: string, repo: string): Promise<RepoCheck> {
  const user = await client.rest<{ login: string }>('GET', '/user');
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const meta = await client.rest<{ private: boolean; archived: boolean; default_branch: string; owner: { type: string } }>('GET', base);
  const check: RepoCheck = { login: user.login, ownerType: meta.owner.type, private: meta.private, archived: meta.archived, defaultBranch: meta.default_branch, canWrite: false };
  // Never write to a public repo; an archived repo refuses writes anyway (S-08).
  if (!meta.private || meta.archived) return check;
  try {
    // `permissions` shows the user's role, not the token's (S-02), so a real write decides.
    // The blob is in no tree and on no branch.
    await client.rest('POST', `${base}/git/blobs`, { content: 'gitcrm write check', encoding: 'utf-8' });
    return { ...check, canWrite: true };
  } catch (error) {
    if (error instanceof GitHubError && error.kind === 'forbidden') return check;
    throw error;
  }
}
