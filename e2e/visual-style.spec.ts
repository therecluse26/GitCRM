// Spec 12 (visual style): dark by default, a Light choice stored only with a remembered connection,
// the top bar with tabs, and bundled fonts.
import { expect, test, type Page } from './fixtures.ts';
import { connect } from './connect-page.ts';
import { routeFakeGitHub } from './fake-route.ts';
import { go, open, seedWorkspace } from './workspace.ts';

const theme = (page: Page) => page.evaluate(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const stored = (page: Page) => page.evaluate(() => ({ ...localStorage }));
const connectHeading = (page: Page) => page.getByRole('heading', { name: /Connect GitCRM/ });

async function chooseLight(page: Page) {
  await go(page, 'Settings');
  await page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).check();
}

test('dark by default, on the connect screen and after connecting', async ({ page }) => {
  const fake = await routeFakeGitHub(page);
  await seedWorkspace(fake, []);
  await page.goto('./');
  await expect(connectHeading(page)).toBeVisible();
  expect(await theme(page)).toBe('dark');
  expect(await background(page)).toBe('rgb(11, 14, 17)');

  await connect(page, fake);
  await go(page, 'Contacts');
  expect(await theme(page)).toBe('dark');
  await go(page, 'Settings');
  await expect(page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toBeChecked();
});

test('Light on a remembered connection applies at once and stays after a reload', async ({ page }) => {
  await open(page);
  await chooseLight(page);
  expect(await theme(page)).toBe('light');
  expect(await background(page)).toBe('rgb(255, 255, 255)');
  expect((await stored(page))['gitcrm.theme']).toBe('light');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await theme(page)).toBe('light');
});

test('without "Remember on this device", Light stores nothing, and a reload is dark again', async ({ page }) => {
  const fake = await routeFakeGitHub(page);
  await seedWorkspace(fake, []);
  await connect(page, fake, { remember: false });
  await chooseLight(page);
  expect(await theme(page)).toBe('light');
  expect(await stored(page)).toEqual({});

  await page.reload();
  await expect(connectHeading(page)).toBeVisible();
  expect(await theme(page)).toBe('dark');
});

test('Disconnect removes the theme, and the connect screen is dark', async ({ page }) => {
  await open(page);
  await chooseLight(page);
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('button', { name: 'Confirm disconnect' }).click();

  await expect(connectHeading(page)).toBeVisible();
  expect(await theme(page)).toBe('dark');
  expect(await stored(page)).toEqual({});
});

test('the top bar holds the navigation as tabs, and the repository in a monospace font', async ({ page }) => {
  await open(page);
  await go(page, 'Contacts');
  const banner = page.getByRole('banner');
  const nav = banner.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Contacts' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current', 'page');
  await expect(banner.getByText('octo-dev/crm', { exact: true })).toHaveCSS('font-family', /IBM Plex Mono/);
  await expect(page.locator('body')).toHaveCSS('font-family', /IBM Plex Sans/);
});

test('every font comes from the app itself', async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await open(page);
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((url) => !url.startsWith(new URL(baseURL!).origin))).toEqual([]);
});
