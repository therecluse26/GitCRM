// Navigation, the connected repo, and sync status around every page (docs/08).
import { Link } from '@tanstack/react-router';
import { Lock, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '@/app/store.ts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/settings', label: 'Settings' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const repoName = useApp((s) => s.repoName);
  const workspaceName = useApp((s) => s.snapshot?.workspace?.config.name);
  const access = useApp((s) => s.session?.access);
  const sync = useApp((s) => s.sync);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <span className="font-semibold">GitCRM</span>
        <span className="text-muted-foreground">{workspaceName}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1" title="Private GitHub repository">
            <Lock className="size-3.5" aria-hidden />
            <span>Connected to {repoName}</span>
          </span>
          {access?.kind === 'read-only' && <Badge variant="secondary">Read-only</Badge>}
          <span role="status" className="text-muted-foreground">
            {sync.status === 'loading' ? 'Syncing…' : sync.status === 'loaded' ? 'Up to date' : 'Not synced'}
          </span>
          <Button variant="outline" size="sm" disabled={sync.status === 'loading'} onClick={() => void useApp.getState().refresh()}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Main" className="flex gap-1 border-b p-2 md:w-48 md:flex-col md:border-r md:border-b-0">
          {NAV.map(({ to, label }) => (
            <Link key={to} to={to} className="rounded-md px-3 py-1.5 text-sm hover:bg-muted" activeProps={{ className: 'bg-muted font-medium' }} activeOptions={{ exact: true }}>
              {label}
            </Link>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          {'message' in sync && (
            <Alert role="alert">
              <AlertDescription>{sync.message} GitCRM is showing the records it has, read-only, until a refresh succeeds.</AlertDescription>
            </Alert>
          )}
          {access?.kind === 'read-only' && (
            <Alert>
              <AlertDescription>{access.message}</AlertDescription>
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
