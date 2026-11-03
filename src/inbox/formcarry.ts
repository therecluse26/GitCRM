// The Formcarry adapter (spec 15, S-10): the lead inbox on Formcarry's Free plan. The facts here
// come from Formcarry's OpenAPI file (api.formcarry.com/docs-json). The key goes only to
// api.formcarry.com, as a Bearer header.
import { z } from 'zod';
import { isFormId } from './form-id.ts';
import { InboxError, type InboxErrorKind, type Lead, type LeadInbox } from './inbox.ts';

const BASE = 'https://api.formcarry.com/v1';
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const SCOPES = ['submissions:read', 'submissions:write'];

const MESSAGES = {
  key: 'Formcarry does not accept this key. Check that you copied all of it.',
  scope: `The key needs the scopes ${SCOPES.join(' and ')}.`,
  form: 'This key cannot open that form. Check the form ID, and that the key may use this form.',
  plan: 'Your Formcarry plan does not allow this.',
  unknown: 'Formcarry sent an answer that GitCRM does not understand.',
  network: 'GitCRM could not reach Formcarry. Check your connection and try again.',
} as const;

const KIND_BY_CODE: Record<string, 'key' | 'scope' | 'form' | 'plan'> = {
  missing_bearer: 'key',
  invalid_key: 'key',
  wrong_audience: 'key',
  insufficient_scope: 'scope',
  form_access_restricted: 'form',
  form_not_found: 'form',
  plan_restricted: 'plan',
};

const errorBody = z.object({ error: z.object({ code: z.string() }) });
const me = z.object({ scopes: z.array(z.string()) });
const page = z.object({ data: z.array(z.unknown()), has_more: z.boolean(), next_cursor: z.string().nullable() });
const deleted = z.object({ deleted: z.boolean() });
// Zod drops the keys it does not name, so the visitor's IP address, browser, referring page, and
// files never reach a Lead.
const entry = z.object({
  id: z.string().min(1),
  created_at: z.iso.datetime(),
  spam: z.boolean().optional(),
  fields: z.array(z.object({ key: z.string(), value: z.string() })),
});

const unknown = () => new InboxError('service', MESSAGES.unknown);

async function send(method: 'GET' | 'DELETE', path: string, key: string): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
  } catch {
    throw new InboxError('network', MESSAGES.network);
  }
}

async function errorCode(response: Response): Promise<string | null> {
  const parsed = errorBody.safeParse(await response.clone().json().catch(() => null));
  return parsed.success ? parsed.data.error.code : null;
}

async function failure(response: Response): Promise<InboxError> {
  if (response.status === 429) {
    const wait = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    return Number.isFinite(wait) && wait > 0
      ? new InboxError('rate-limit', `Formcarry asks you to wait ${wait} seconds. Then select "Check for leads" again.`, wait)
      : new InboxError('rate-limit', 'Formcarry asks you to wait. Try again in a minute.');
  }
  const code = await errorCode(response);
  const kind: InboxErrorKind | undefined = (code && KIND_BY_CODE[code]) || (response.status === 401 ? 'key' : undefined);
  if (kind === 'key' || kind === 'scope' || kind === 'form' || kind === 'plan') return new InboxError(kind, MESSAGES[kind]);
  return new InboxError('service', `Formcarry answered with an error (HTTP ${response.status}). Try again later.`);
}

async function get<T>(path: string, key: string, schema: z.ZodType<T>): Promise<T> {
  const response = await send('GET', path, key);
  if (!response.ok) throw await failure(response);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw unknown();
  return parsed.data;
}

export function createFormcarryInbox({ formId, key }: { formId: string; key: string }): LeadInbox {
  if (!isFormId(formId)) throw new Error('The form ID may hold only letters, digits, - and _, 4 to 64 characters');
  const submissions = `/forms/${formId}/submissions`;

  return {
    async check() {
      const { scopes } = await get('/me', key, me);
      if (!SCOPES.every((scope) => scopes.includes(scope))) throw new InboxError('scope', MESSAGES.scope);
      await get(`${submissions}?limit=1`, key, page);
    },

    async list() {
      const leads: Lead[] = [];
      let unreadable = 0;
      let cursor: string | null = null;
      let more = false;
      for (let pages = 0; pages < MAX_PAGES; pages += 1) {
        const query = new URLSearchParams({ status: 'inbox', order: 'oldest', limit: String(PAGE_SIZE) });
        if (cursor !== null) query.set('cursor', cursor);
        const result: z.infer<typeof page> = await get(`${submissions}?${query}`, key, page);
        for (const item of result.data) {
          const parsed = entry.safeParse(item);
          if (!parsed.success) unreadable += 1;
          else if (parsed.data.spam !== true) leads.push({ id: parsed.data.id, receivedAt: new Date(parsed.data.created_at).toISOString(), fields: parsed.data.fields });
        }
        more = result.has_more;
        cursor = result.next_cursor;
        if (!more || cursor === null) break;
      }
      return { leads, unreadable, more };
    },

    async remove(lead) {
      const response = await send('DELETE', `${submissions}/${encodeURIComponent(lead.id)}`, key);
      // A lead that is already gone counts as removed, so a second try after a lost answer works.
      // Formcarry's OpenAPI file lists a 404 for a missing lead and no code: this one is assumed.
      if (response.status === 404 && (await errorCode(response)) === 'submission_not_found') return;
      if (!response.ok) throw await failure(response);
      const parsed = deleted.safeParse(await response.json().catch(() => null));
      if (!parsed.success || !parsed.data.deleted) throw unknown();
    },
  };
}
