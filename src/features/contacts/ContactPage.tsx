// One contact (spec 02): details, its company and opportunities, Edit, and Archive or Restore.
import { Link, useParams } from '@tanstack/react-router';
import { selectCanWrite, selectReadOnly, useApp } from '@/app/store.ts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge, Detail, Problem, RecordNotFound, Tags } from '@/ui/record-page.tsx';
import { RelatedOpportunities } from '../opportunities/RelatedOpportunities.tsx';
import { formatDate, useRecord } from '../records.ts';
import { useArchive } from '../use-archive.ts';

function List({ items, href }: { items: string[]; href: (item: string) => string }) {
  if (items.length === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <a className="underline" href={href(item)}>{item}</a>
        </li>
      ))}
    </ul>
  );
}

export function ContactPage() {
  const { contactId } = useParams({ from: '/contacts/$contactId' });
  const saved = useRecord('contact', contactId);
  const company = useRecord('company', saved?.record.companyId ?? '');
  const readOnly = useApp(selectReadOnly);
  const canWrite = useApp(selectCanWrite);
  const archive = useArchive(saved);
  if (!saved) return <RecordNotFound singular="contact" back={<Link to="/contacts" className="underline">Back to contacts</Link>} />;
  const contact = saved.record;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold break-words">{contact.name}</h1>
        {archive.archived && <ArchivedBadge />}
        {!readOnly && (
          <div className="ml-auto flex gap-2">
            <Link to="/contacts/$contactId/edit" params={{ contactId }} className={linkButton({ variant: 'outline' })}>Edit</Link>
            <Button variant="outline" disabled={!canWrite} onClick={() => void archive.toggle()}>
              {archive.saving ? 'Saving…' : archive.archived ? 'Restore' : 'Archive'}
            </Button>
          </div>
        )}
      </div>
      {archive.message && <Problem>{archive.message}</Problem>}
      <Card>
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <Detail label="Email">
              <List items={contact.emails} href={(email) => `mailto:${email}`} />
            </Detail>
            <Detail label="Phone">
              <List items={contact.phones} href={(phone) => `tel:${phone.replace(/[^\d+]/g, '')}`} />
            </Detail>
            <Detail label="Company">
              {company ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Link to="/companies/$companyId" params={{ companyId: company.record.id }} className="underline">{company.record.name}</Link>
                  {company.record.archivedAt && <ArchivedBadge />}
                </span>
              ) : contact.companyId ? (
                <span>
                  Missing company (ID {contact.companyId.slice(0, 8)}). <Link to="/settings" className="underline">See Settings</Link>.
                </span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Detail>
            <Detail label="Tags">
              <Tags tags={contact.tags} />
            </Detail>
            <Detail label="Last updated">{formatDate(contact.updatedAt)}</Detail>
          </dl>
        </CardContent>
      </Card>
      <RelatedOpportunities name={contact.name} linked={(o) => o.contactIds.includes(contactId)} search={{ contactId }} />
    </>
  );
}
