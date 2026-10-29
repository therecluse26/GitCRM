// Serves a FakeGitHub to the page through Playwright routing; nothing reaches the real GitHub.
import type { Page } from '@playwright/test';
import { FakeGitHub, type FakeGitHubOptions } from '../src/test/fake-github.ts';

export async function routeFakeGitHub(page: Page, options: FakeGitHubOptions = {}): Promise<FakeGitHub> {
  const fake = new FakeGitHub(options);
  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const response = await fake.handle(
      new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), body: request.postData() ?? undefined }),
    );
    if (response === 'network-error') return route.abort('failed');
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  return fake;
}
