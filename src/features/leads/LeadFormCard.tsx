// Settings, "Lead form" (spec 15): the Formcarry form ID and key of this device, and what to share
// with visitors once the key is checked.
import { useState, type FormEvent } from 'react';
import { useApp } from '@/app/store.ts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { isFormId } from '@/inbox/form-id.ts';
import { InboxError } from '@/inbox/inbox.ts';
import { TextField } from '@/ui/form-fields.tsx';
import { leadFormLink, leadFormSnippet } from './lead-form-html.ts';
import { openInbox } from './open-inbox.ts';

export function LeadFormCard() {
  const setup = useApp((s) => s.leadSetup);
  const remember = useApp((s) => s.credentials?.remember ?? false);
  const [formId, setFormId] = useState('');
  const [key, setKey] = useState('');
  const [errors, setErrors] = useState<{ formId?: string; key?: string }>({});
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const id = formId.trim();
    const secret = key.trim();
    const next: typeof errors = {};
    if (!isFormId(id)) next.formId = 'Use 4 to 64 letters, digits, - or _. Formcarry shows the form ID on the form page.';
    if (secret === '') next.key = 'Enter the API key.';
    else if (/\s/.test(secret)) next.key = 'The key has no spaces. Copy it again.';
    setErrors(next);
    setProblem(null);
    if (next.formId || next.key) return;
    setChecking(true);
    try {
      await openInbox({ service: 'formcarry', formId: id, key: secret }).check();
      useApp.getState().setLeadSetup({ service: 'formcarry', formId: id, key: secret });
      setFormId('');
      setKey(''); // the key leaves the form once the store holds it
    } catch (error) {
      setProblem(error instanceof InboxError ? error.message : 'Something went wrong while checking Formcarry. Try again.');
    } finally {
      setChecking(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied.`);
    } catch {
      setCopied(`GitCRM could not copy the ${what.toLowerCase()}. Select the text and copy it.`);
    }
  }

  const link = setup ? leadFormLink(setup.formId, window.location) : '';
  const snippet = setup ? leadFormSnippet(setup.formId) : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Lead form</h2>
        </CardTitle>
        <CardDescription>
          Visitors send a form. Formcarry holds each lead until you add it as a contact or discard it.{' '}
          {remember ? 'The form ID and key stay in this browser until you disconnect.' : 'The form ID and key stay until the page reloads, because this browser stores nothing.'} The key goes only to Formcarry.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {setup ? (
          <>
            <p>
              Leads come from Formcarry form <code>{setup.formId}</code>. Open the Leads tab to review them.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-form-link">Link to the form page</Label>
              <input id="lead-form-link" readOnly value={link} className="h-8 w-full rounded-lg border border-input bg-background px-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <div>
                <Button variant="outline" size="sm" onClick={() => void copy(link, 'Link')}>
                  Copy link
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-form-snippet">HTML for your own website</Label>
              <textarea id="lead-form-snippet" readOnly rows={9} value={snippet} className="w-full rounded-lg border border-input bg-background p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <div>
                <Button variant="outline" size="sm" onClick={() => void copy(snippet, 'Snippet')}>
                  Copy snippet
                </Button>
              </div>
            </div>
            <p role="status" className="text-muted-foreground">
              {copied}
            </p>
            <p className="text-muted-foreground">Formcarry may delete leads after the time set in the form's retention setting, so add or discard leads in time.</p>
            <div>
              <Button variant="outline" onClick={() => useApp.getState().setLeadSetup(null)}>
                Remove lead form
              </Button>
              <p className="mt-1.5 text-muted-foreground">This clears the setup from this device. Nothing changes on Formcarry.</p>
            </div>
          </>
        ) : (
          <form noValidate onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
            <ol className="list-decimal pl-5">
              <li>
                Make a{' '}
                <a className="underline" href="https://formcarry.com" target="_blank" rel="noopener noreferrer">Formcarry</a> account (the Free plan needs no card) and one form.
              </li>
              <li>Make an API key with the scopes <code>submissions:read</code> and <code>submissions:write</code>, limited to that form.</li>
              <li>Enter the form ID and the key here.</li>
            </ol>
            <TextField id="lead-form-id" label="Form ID" value={formId} error={errors.formId} autoComplete="off" spellCheck={false} onChange={(e) => setFormId(e.target.value)} />
            <TextField id="lead-form-key" label="API key" type="password" value={key} error={errors.key} autoComplete="off" spellCheck={false} onChange={(e) => setKey(e.target.value)} />
            {problem && (
              <p role="alert" className="text-destructive">
                {problem}
              </p>
            )}
            <div>
              <Button type="submit" disabled={checking}>
                {checking ? 'Checking…' : 'Save and check'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
