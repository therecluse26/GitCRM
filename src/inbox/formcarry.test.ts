// The Formcarry adapter against a fake Formcarry (spec 15, S-10).
import { describe, expect, it } from 'vitest';
import { serveFakeFormcarry } from '@/test/msw.ts';
import { createFormcarryInbox } from './formcarry.ts';
import { InboxError } from './inbox.ts';

const fake = serveFakeFormcarry();
const inbox = (changes: { formId?: string; key?: string } = {}) => createFormcarryInbox({ formId: fake().formId, key: fake().key, ...changes });

async function failure(promise: Promise<unknown>): Promise<InboxError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(InboxError);
  return error as InboxError;
}

describe('createFormcarryInbox', () => {
  it('refuses a form ID that is not a plain ID', () => {
    for (const formId of ['', 'abc', '../x', 'a b c d', 'x'.repeat(65), '<script>']) expect(() => createFormcarryInbox({ formId, key: 'k' })).toThrow();
  });
});

describe('check', () => {
  it('accepts a key with both scopes that can open the form', async () => {
    await expect(inbox().check()).resolves.toBeUndefined();
  });

  it('says the key is wrong', async () => {
    const error = await failure(inbox({ key: 'fc_live_other' }).check());
    expect(error.kind).toBe('key');
    expect(error.message).toBe('Formcarry does not accept this key. Check that you copied all of it.');
  });

  it('names the scope a key lacks, before any lead is imported', async () => {
    fake().scopes = ['submissions:read'];
    const error = await failure(inbox().check());
    expect(error.kind).toBe('scope');
    expect(error.message).toBe('The key needs the scopes submissions:read and submissions:write.');
    expect(fake().count('GET', /submissions$/)).toBe(0);
  });

  it('says the form is not found', async () => {
    const error = await failure(inbox({ formId: 'someOtherForm' }).check());
    expect(error.kind).toBe('form');
    expect(error.message).toBe('This key cannot open that form. Check the form ID, and that the key may use this form.');
  });

  it('says the plan does not allow it', async () => {
    fake().failNext('GET', /\/v1\/me$/, { status: 403, body: { error: { type: 'permission_error', code: 'plan_restricted', message: 'Upgrade' } } });
    const error = await failure(inbox().check());
    expect(error.kind).toBe('plan');
    expect(error.message).toBe('Your Formcarry plan does not allow this.');
  });
});

describe('list', () => {
  it('returns the leads oldest first, with the fields in order and no visitor details', async () => {
    fake().addLead({ name: 'Ava Bennett', email: 'ava@example.com', message: 'Hello' }, { createdAt: '2026-11-02T15:00:00.123Z' });
    fake().addLead({ name: 'Ben Carter', email: 'ben@example.com' }, { createdAt: '2026-11-02T14:00:00.000Z' });
    const { leads, unreadable, more } = await inbox().list();
    expect(unreadable).toBe(0);
    expect(more).toBe(false);
    expect(leads.map((l) => l.fields[0].value)).toEqual(['Ben Carter', 'Ava Bennett']);
    expect(leads[1]).toEqual({
      id: fake().leads[0].id,
      receivedAt: '2026-11-02T15:00:00.123Z',
      fields: [
        { key: 'name', value: 'Ava Bennett' },
        { key: 'email', value: 'ava@example.com' },
        { key: 'message', value: 'Hello' },
      ],
    });
    expect(JSON.stringify(leads)).not.toMatch(/203\.0\.113|Mozilla|example\.com\/contact|attachments|country/);
  });

  it('asks for the inbox, oldest first, 100 at a time', async () => {
    await inbox().list();
    const [request] = fake().requests;
    expect(new URL(request.url).search).toBe('?status=inbox&order=oldest&limit=100');
  });

  it('leaves out spam', async () => {
    fake().addLead({ name: 'Ava' });
    fake().addLead({ name: 'Bot' }, { spam: true });
    const { leads } = await inbox().list();
    expect(leads.map((l) => l.fields[0].value)).toEqual(['Ava']);
  });

  it('skips a lead it cannot read, and counts it', async () => {
    fake().addLead({ name: 'Ava' });
    fake().leads.push({ id: '0'.repeat(24), createdAt: 'not a time', spam: false, fields: [] });
    fake().leads.push({ id: '1'.repeat(24), createdAt: '2026-11-02T16:00:00.000Z', spam: false, fields: [{ key: 'name', value: 5 as unknown as string }] });
    const { leads, unreadable } = await inbox().list();
    expect(leads).toHaveLength(1);
    expect(unreadable).toBe(2);
  });

  it('follows the cursor to the next page', async () => {
    for (let i = 0; i < 230; i += 1) fake().addLead({ name: `Lead ${i}` });
    const { leads, more } = await inbox().list();
    expect(leads).toHaveLength(230);
    expect(more).toBe(false);
    expect(fake().count('GET', /submissions$/)).toBe(3);
  });

  it('reads at most 5 pages, and says there are more', async () => {
    for (let i = 0; i < 520; i += 1) fake().addLead({ name: `Lead ${i}` });
    const { leads, more } = await inbox().list();
    expect(leads).toHaveLength(500);
    expect(more).toBe(true);
    expect(fake().count('GET', /submissions$/)).toBe(5);
  });

  it('waits when Formcarry asks, and sends no second request', async () => {
    fake().failNext('GET', /submissions$/, { status: 429, body: { error: { type: 'rate_limit_error', code: 'rate_limited', message: 'Slow down' } }, headers: { 'retry-after': '30' } });
    const error = await failure(inbox().list());
    expect(error.kind).toBe('rate-limit');
    expect(error.waitSeconds).toBe(30);
    expect(error.message).toBe('Formcarry asks you to wait 30 seconds. Then select "Check for leads" again.');
    expect(fake().count('GET', /submissions$/)).toBe(1);
  });

  it('says so when the answer has no wait time', async () => {
    fake().failNext('GET', /submissions$/, { status: 429, body: {} });
    const error = await failure(inbox().list());
    expect(error.kind).toBe('rate-limit');
    expect(error.waitSeconds).toBeUndefined();
    expect(error.message).toBe('Formcarry asks you to wait. Try again in a minute.');
  });

  it('reports a server error, an answer it does not understand, and a lost connection', async () => {
    fake().failNext('GET', /submissions$/, { status: 500, body: {} });
    expect((await failure(inbox().list())).message).toBe('Formcarry answered with an error (HTTP 500). Try again later.');
    fake().failNext('GET', /submissions$/, { status: 200, body: { unexpected: true } });
    expect((await failure(inbox().list())).message).toBe('Formcarry sent an answer that GitCRM does not understand.');
    fake().failNext('GET', /submissions$/, 'network');
    const error = await failure(inbox().list());
    expect(error.kind).toBe('network');
    expect(error.message).toBe('GitCRM could not reach Formcarry. Check your connection and try again.');
  });
});

describe('remove', () => {
  it('deletes the lead on Formcarry', async () => {
    fake().addLead({ name: 'Ava' });
    fake().addLead({ name: 'Ben' });
    const { leads } = await inbox().list();
    await inbox().remove(leads[0]);
    expect(fake().leads.map((l) => l.fields[0].value)).toEqual(['Ben']);
  });

  it('counts a lead that is already gone as removed', async () => {
    fake().addLead({ name: 'Ava' });
    const { leads } = await inbox().list();
    await inbox().remove(leads[0]);
    await expect(inbox().remove(leads[0])).resolves.toBeUndefined();
  });

  it('does not count a missing form as removed', async () => {
    fake().addLead({ name: 'Ava' });
    const { leads } = await inbox().list();
    const error = await failure(inbox({ formId: 'someOtherForm' }).remove(leads[0]));
    expect(error.kind).toBe('form');
  });

  it('names the scope a key lacks', async () => {
    fake().addLead({ name: 'Ava' });
    const { leads } = await inbox().list();
    fake().scopes = ['submissions:read'];
    const error = await failure(inbox().remove(leads[0]));
    expect(error.kind).toBe('scope');
    expect(fake().leads).toHaveLength(1);
  });

  it('does not take an answer without deleted: true as done', async () => {
    fake().addLead({ name: 'Ava' });
    const { leads } = await inbox().list();
    fake().failNext('DELETE', /submissions\//, { status: 200, body: { id: leads[0].id, deleted: false } });
    expect((await failure(inbox().remove(leads[0]))).kind).toBe('service');
  });
});

describe('the key', () => {
  it('goes only to api.formcarry.com, as a Bearer header, never in an address', async () => {
    fake().addLead({ name: 'Ava' });
    const { leads } = await inbox().list();
    await inbox().check();
    await inbox().remove(leads[0]);
    expect(fake().requests.length).toBeGreaterThan(3);
    for (const request of fake().requests) {
      expect(new URL(request.url).host).toBe('api.formcarry.com');
      expect(request.authorization).toBe(`Bearer ${fake().key}`);
      expect(request.url).not.toContain(fake().key);
    }
  });
});
