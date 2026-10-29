// Home (docs/08): counts of active records. Pipeline, tasks, and recent activity come with their slices.
import { Link } from '@tanstack/react-router';
import { useApp } from '@/app/store.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecordType } from '@/core/schemas.ts';

const COUNTED: { type: RecordType; label: string; to?: '/contacts' | '/companies' }[] = [
  { type: 'contact', label: 'Contacts', to: '/contacts' },
  { type: 'company', label: 'Companies', to: '/companies' },
  { type: 'opportunity', label: 'Opportunities' },
];

export function HomePage() {
  const snapshot = useApp((s) => s.snapshot);
  const active = (type: RecordType) => snapshot?.records.filter(({ record }) => record.type === type && record.archivedAt === null).length ?? 0;
  const issues = snapshot?.issues.length ?? 0;

  return (
    <>
      <h1 className="text-2xl font-semibold">{snapshot?.workspace?.config.name}</h1>
      {issues > 0 && (
        <p className="text-sm">
          {issues === 1 ? '1 file in the repository needs attention.' : `${issues} files in the repository need attention.`}{' '}
          <Link to="/settings" className="underline">See Settings</Link>.
        </p>
      )}
      <section aria-label="Active records" className="grid gap-4 sm:grid-cols-3">
        {COUNTED.map(({ type, label, to }) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {to ? (
                  <Link to={to} className="underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{active(type)}</CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
