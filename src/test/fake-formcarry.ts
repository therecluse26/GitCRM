// An in-memory Formcarry for tests: one form, one API key, and only the calls GitCRM makes
// (spec 15). Answers follow Formcarry's OpenAPI file (api.formcarry.com/docs-json, S-10). handle()
// takes a Fetch Request, so MSW (Vitest) and page.route (Playwright) can both serve it.

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'retry-after' };

export type FakeFormcarryOptions = { formId?: string; key?: string; scopes?: string[] };
export type StoredLead = { id: string; createdAt: string; spam: boolean; fields: { key: string; value: string }[] };
type Fault = { status: number; body?: unknown; headers?: Record<string, string> } | 'network';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS, ...headers } });

const failure = (status: number, type: string, code: string, message: string, extra: object = {}) => json(status, { error: { type, code, message, ...extra } });

export class FakeFormcarry {
  key: string; // tests change it to revoke the key
  readonly formId: string;
  scopes: string[];
  readonly leads: StoredLead[] = [];
  readonly requests: { method: string; url: string; authorization: string | null }[] = [];

  private readonly faults: { method: string; path: RegExp; fault: Fault }[] = [];
  private counter = 0;

  constructor({ formId = 'exampleForm1', key = 'fc_live_test_key', scopes = ['submissions:read', 'submissions:write'] }: FakeFormcarryOptions = {}) {
    this.formId = formId;
    this.key = key;
    this.scopes = scopes;
  }

  // A lead as Formcarry stores it, with visitor details the adapter must drop.
  addLead(fields: Record<string, string>, { spam = false, createdAt }: { spam?: boolean; createdAt?: string } = {}): StoredLead {
    this.counter += 1;
    const lead: StoredLead = {
      id: this.counter.toString(16).padStart(24, '0'),
      createdAt: createdAt ?? new Date(Date.UTC(2026, 10, 2, 15, this.counter)).toISOString(),
      spam,
      fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
    };
    this.leads.push(lead);
    return lead;
  }

  // The next request that matches gets this fault, once.
  failNext(method: string, path: RegExp, fault: Fault): void {
    this.faults.push({ method, path, fault });
  }

  count(method: string, path?: RegExp): number {
    return this.requests.filter((r) => r.method === method && (!path || path.test(new URL(r.url).pathname))).length;
  }

  async handle(request: Request): Promise<Response | 'network-error'> {
    const url = new URL(request.url);
    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'access-control-allow-headers': 'authorization, content-type, accept', 'access-control-allow-methods': 'GET, POST, DELETE' } });
    }
    this.requests.push({ method, url: request.url, authorization: request.headers.get('authorization') });

    const index = this.faults.findIndex((f) => f.method === method && f.path.test(url.pathname));
    const fault = index === -1 ? undefined : this.faults.splice(index, 1)[0].fault;
    if (fault === 'network') return 'network-error';
    if (fault) return json(fault.status, fault.body ?? {}, fault.headers);

    if (url.host === 'formcarry.com') return this.submit(method, url, request);
    if (url.host === 'api.formcarry.com') return this.api(method, url, request.headers.get('authorization'));
    return json(404, {});
  }

  // The public endpoint a visitor's form posts to. It needs no key.
  private async submit(method: string, url: URL, request: Request): Promise<Response> {
    const match = /^\/s\/([^/]+)$/.exec(url.pathname);
    if (method !== 'POST' || !match) return json(404, { code: 404, status: 'error', title: 'Not found', message: 'Not found' });
    if (match[1] !== this.formId) return json(404, { code: 404, status: 'error', title: 'Form not found', message: 'This form does not exist' });
    const type = request.headers.get('content-type') ?? '';
    const entries: [string, string][] = type.includes('json')
      ? Object.entries((await request.json()) as Record<string, string>)
      : [...(await request.formData()).entries()].map(([key, value]) => [key, String(value)]);
    // Formcarry marks a lead as spam when the honeypot field has a value, and does not keep the field.
    const spam = entries.some(([key, value]) => key === '_gotcha' && value !== '');
    this.addLead(Object.fromEntries(entries.filter(([key]) => key !== '_gotcha')), { spam });
    return json(200, { code: 200, status: 'success', title: 'Thank You!', message: 'We received your submission', return: false, returnUrl: '' });
  }

  private api(method: string, url: URL, authorization: string | null): Response {
    if (authorization === null) return failure(401, 'authentication_error', 'missing_bearer', 'No Authorization header.');
    if (authorization !== `Bearer ${this.key}`) return failure(401, 'authentication_error', 'invalid_key', 'The key is malformed, revoked, or does not exist.');
    const path = url.pathname;
    if (method === 'GET' && path === '/v1/me') return json(200, { type: 'key', key: { id: 'k1', name: 'GitCRM' }, app: null, scopes: this.scopes, teams: [] });

    const match = /^\/v1\/forms\/([^/]+)\/submissions(?:\/([^/]+))?$/.exec(path);
    if (!match) return json(404, {});
    if (match[1] !== this.formId) return failure(404, 'invalid_request_error', 'form_not_found', 'The form does not exist or is not visible to this key.');

    if (method === 'GET' && match[2] === undefined) {
      if (!this.scopes.includes('submissions:read')) return failure(403, 'permission_error', 'insufficient_scope', 'The key does not have the required scope.', { required: ['submissions:read'] });
      const status = url.searchParams.get('status') ?? 'inbox';
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      const matching = this.leads.filter((l) => (status === 'all' ? true : status === 'spam' ? l.spam : !l.spam));
      const oldestFirst = [...matching].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      const ordered = url.searchParams.get('order') === 'oldest' ? oldestFirst : oldestFirst.reverse();
      const page = ordered.slice(offset, offset + limit);
      const more = offset + limit < ordered.length;
      return json(200, {
        data: page.map((l) => ({
          id: l.id,
          form_id: this.formId,
          created_at: l.createdAt,
          spam: l.spam,
          read: false,
          ip: '203.0.113.7',
          country: 'US',
          user_agent: 'Mozilla/5.0 (test)',
          referer: 'https://example.com/contact',
          fields: l.fields,
          attachments: [],
        })),
        has_more: more,
        next_cursor: more ? String(offset + limit) : null,
      });
    }

    if (method === 'DELETE' && match[2] !== undefined) {
      if (!this.scopes.includes('submissions:write')) return failure(403, 'permission_error', 'insufficient_scope', 'The key does not have the required scope.', { required: ['submissions:write'] });
      const at = this.leads.findIndex((l) => l.id === match[2]);
      // The code for a missing lead is an assumption: the OpenAPI file lists a 404 and no code.
      if (at === -1) return failure(404, 'invalid_request_error', 'submission_not_found', 'The submission does not exist.');
      this.leads.splice(at, 1);
      return json(200, { id: match[2], deleted: true });
    }
    return json(404, {});
  }
}
