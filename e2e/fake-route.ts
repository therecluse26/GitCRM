// Serves a FakeGitHub to the page through Playwright routing; nothing reaches the real GitHub.
// Routing a browser context serves every tab in it from the same fake.
import type { BrowserContext, Page, Route } from '@playwright/test';
import { FakeFormcarry, type FakeFormcarryOptions } from '../src/test/fake-formcarry.ts';
import { FakeGitHub, type FakeGitHubOptions } from '../src/test/fake-github.ts';

export async function routeFakeGitHub(target: Page | BrowserContext, options: FakeGitHubOptions = {}): Promise<FakeGitHub> {
  const fake = new FakeGitHub(options);
  await target.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const response = await fake.handle(
      new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), body: request.postData() ?? undefined }),
    );
    if (response === 'network-error') return route.abort('failed');
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  return fake;
}

// Serves a FakeFormcarry: the API the Leads page reads, and the public address a visitor's form posts to.
export async function routeFakeFormcarry(target: Page | BrowserContext, options: FakeFormcarryOptions = {}): Promise<FakeFormcarry> {
  const fake = new FakeFormcarry(options);
  const serve = async (route: Route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const response = await fake.handle(new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), body: body ? new Uint8Array(body) : undefined }));
    if (response === 'network-error') return route.abort('failed');
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  };
  await target.route('https://api.formcarry.com/**', serve);
  await target.route('https://formcarry.com/**', serve);
  return fake;
}

// ADR-025: each copy runs at <owner>.github.io/<app repo>/. The route serves the same build there.
export const PAGES_SITE = 'https://octo-dev.github.io/gitcrm/';

export async function servePagesSite(page: Page, baseURL: string): Promise<void> {
  await page.route(`${PAGES_SITE}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/gitcrm/', '');
    await route.fulfill({ response: await route.fetch({ url: new URL(path, baseURL).href }) });
  });
}
