// Connect an existing private repo with a fine-grained PAT (docs/05, "Supported setup flow").
// A real login form, so password managers can save and fill the token.
import { useState, type FormEvent } from 'react';
import { useApp } from '@/app/store.ts';
import { parseRepoName, tokenLink } from '@/auth/connect.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ConnectScreen({ problem, busy }: { problem: string | null; busy: boolean }) {
  const [repoName, setRepoName] = useState(useApp.getState().repoName);
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [formProblem, setFormProblem] = useState<string | null>(null);
  const repo = parseRepoName(repoName);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!repo) return setFormProblem('Enter the repository as owner/repo, for example octo-dev/crm.');
    if (!token.trim()) return setFormProblem('Paste the token from GitHub.');
    setFormProblem(null);
    void useApp.getState().connect({ ...repo, token: token.trim(), remember });
  }

  const shown = formProblem ?? problem;
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">Connect GitCRM to a private GitHub repository</h1>
          </CardTitle>
          <CardDescription>
            Your data is stored in a private GitHub repository that you own. GitCRM runs in your browser and talks to GitHub directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repo">Repository</Label>
              <Input id="repo" name="username" autoComplete="username" placeholder="owner/repo" spellCheck={false} value={repoName} onChange={(e) => setRepoName(e.target.value)} />
              <p className="text-sm text-muted-foreground">
                An existing private repository, ideally one used only for GitCRM.{' '}
                <a className="underline" href="https://github.com/new" target="_blank" rel="noopener noreferrer">Create one on GitHub</a>.
              </p>
            </div>

            {repo && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  Open GitHub's{' '}
                  <a className="underline" href={tokenLink(repo.owner, repo.repo)} target="_blank" rel="noopener noreferrer">
                    token form, filled in for {repo.owner}
                  </a>
                  .
                </li>
                <li>Under Repository access, choose "Only select repositories" and pick {repo.owner}/{repo.repo}.</li>
                <li>Check that Repository permissions, Contents, is set to "Read and write".</li>
                <li>Generate the token, then paste it below. A short expiry is safest.</li>
              </ol>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token">Fine-grained personal access token</Label>
              <Input id="token" name="password" type="password" autoComplete="current-password" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" aria-labelledby="remember-label" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
                <Label id="remember-label" htmlFor="remember">Remember on this device</Label>
              </div>
              <p className="text-sm text-muted-foreground">Uncheck on a shared computer. GitCRM then stores nothing in this browser.</p>
            </div>

            {shown && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{shown}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={busy} className="self-start">
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
