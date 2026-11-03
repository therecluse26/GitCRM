// Serves a FakeGitHub or a FakeFormcarry to fetch in Vitest through MSW. Unhandled requests fail the test.
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { FakeFormcarry, type FakeFormcarryOptions } from './fake-formcarry.ts';
import { FakeGitHub, type FakeGitHubOptions } from './fake-github.ts';

export function serveFakeGitHub(options: FakeGitHubOptions = {}): () => FakeGitHub {
  let fake = new FakeGitHub(options);
  const server = setupServer(
    http.all('https://api.github.com/*', async ({ request }) => {
      const response = await fake.handle(request);
      return response === 'network-error' ? HttpResponse.error() : response;
    }),
  );
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => {
    fake = new FakeGitHub(options);
  });
  afterAll(() => server.close());
  return () => fake;
}

export function serveFakeFormcarry(options: FakeFormcarryOptions = {}): () => FakeFormcarry {
  let fake = new FakeFormcarry(options);
  const serve = async ({ request }: { request: Request }) => {
    const response = await fake.handle(request);
    return response === 'network-error' ? HttpResponse.error() : response;
  };
  const server = setupServer(http.all('https://api.formcarry.com/*', serve), http.all('https://formcarry.com/*', serve));
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => {
    fake = new FakeFormcarry(options);
  });
  afterAll(() => server.close());
  return () => fake;
}
