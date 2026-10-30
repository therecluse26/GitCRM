// Spec 08: the skip link, focus after a page change, phone width, one save at a time, and field
// errors on every form, against the fake GitHub.
import { expect, test, type Page } from '@playwright/test';
import { connect } from './connect-page.ts';
import { routeFakeGitHub } from './fake-route.ts';
import { activity, company, contact, field, go, homeHeading, open, openContact, opportunity, status, task } from './workspace.ts';

test.use({ timezoneId: 'America/New_York', locale: 'en-US' });

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

// Ava's page is long enough to scroll on a phone.
function avasRecords() {
  const northwind = company('Northwind Traders');
  const ava = contact('Ava Bennett', { companyId: northwind.id });
  const related = { type: 'contact', id: ava.id } as const;
  const deal = opportunity('Website rebuild', 'proposal', { companyId: northwind.id, contactIds: [ava.id] });
  const tasks = Array.from({ length: 10 }, (_, i) => task(`Follow-up ${i + 1}`, { related }));
  const notes = Array.from({ length: 6 }, (_, i) => activity(`Call notes ${i + 1}\nline two\nline three`, { related, occurredAt: `2026-10-2${i}T16:15:00Z` }));
  return { ava, records: [northwind, ava, deal, ...tasks, ...notes] };
}

test('the first Tab reaches "Skip to main content", which skips the navigation', async ({ page }) => {
  await open(page, avasRecords().records);
  const skip = page.getByRole('button', { name: 'Skip to main content' });
  await expect(skip).not.toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('main') !== null)).toBe(true);
});

test('after a link, a save, or Back, focus is on the main heading, and the scroll position stays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, avasRecords().records);

  await go(page, 'Contacts');
  await expect(heading(page, 'Contacts')).toBeFocused();
  await page.getByRole('list', { name: 'Contacts' }).getByRole('link', { name: 'Ava Bennett' }).click();
  await expect(heading(page, 'Ava Bennett')).toBeFocused();

  const lastTask = page.getByRole('list', { name: 'Tasks for Ava Bennett' }).getByRole('link').last();
  const title = (await lastTask.textContent())!;
  await lastTask.scrollIntoViewIfNeeded();
  const scrolled = await scrollY(page);
  expect(scrolled).toBeGreaterThan(0);
  await lastTask.click();
  await expect(heading(page, title)).toBeFocused();
  expect(await scrollY(page)).toBe(0);

  await page.goBack();
  await expect(heading(page, 'Ava Bennett')).toBeFocused();
  await expect.poll(() => scrollY(page)).toBe(scrolled);

  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(heading(page, 'Edit Ava Bennett')).toBeFocused();
  await field(page, 'Name').fill('Ava B. Bennett');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(heading(page, 'Ava B. Bennett')).toBeFocused();
});

test('the main navigation marks the current section', async ({ page }) => {
  await open(page, avasRecords().records);
  await openContact(page, 'Ava Bennett');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Contacts' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});

test('an address that matches no page says so, inside the app', async ({ page }) => {
  await open(page);
  await page.goto('/#/nowhere');
  await expect(heading(page, 'Page not found')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Go to Home' }).click();
  await expect(homeHeading(page)).toBeVisible();
});

test('at 390 pixels wide, no page scrolls sideways, and the navigation shows every link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { ava, records } = avasRecords();
  await open(page, records);
  for (const path of ['/', '/contacts', `/contacts/${ava.id}`, '/companies', '/pipeline', '/tasks', '/search', '/settings', '/contacts/new', '/tasks/new', '/activities/new']) {
    await page.goto(`/#${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBe(0);
  }

  const links = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all();
  expect(links).toHaveLength(7);
  for (const link of links) {
    await expect(link).toBeInViewport();
    const box = (await link.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
  }
});

test('while a save runs, the other controls that save are disabled, and a form says why', async ({ page }) => {
  const fake = await open(page, avasRecords().records);
  await openContact(page, 'Ava Bennett');
  let land = () => {};
  fake.failNext('PUT', /\/contents\//, { run: () => new Promise<void>((resolve) => (land = resolve)) });
  await page.getByRole('checkbox', { name: 'Complete Follow-up 1', exact: true }).click();

  await expect(page.getByRole('list', { name: 'Tasks for Ava Bennett' })).toContainText('Saving…');
  await expect(page.getByRole('checkbox', { name: 'Complete Follow-up 2' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  const archives = await page.getByRole('button', { name: /^Archive/ }).all();
  expect(archives.length).toBeGreaterThan(1); // the contact and its activities
  for (const archive of archives) await expect(archive).toBeDisabled();

  await go(page, 'Pipeline');
  await expect(page.getByLabel('Move Website rebuild to stage')).toBeDisabled();
  await openContact(page, 'Ava Bennett');
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save contact' })).toBeDisabled();
  await expect(page.getByText('You can save when the other save finishes.')).toBeVisible();

  land();
  await expect(status(page)).toHaveText('Saved · View commit');
  await expect(page.getByRole('button', { name: 'Save contact' })).toBeEnabled();
  await expect(page.getByText('You can save when the other save finishes.')).toBeHidden();
});

const requiredFields: { form: string; start: (page: Page) => Promise<void>; submit: string; field: string; error: string }[] = [
  { form: 'new contact', start: (page) => go(page, 'Contacts').then(() => page.getByRole('link', { name: 'New contact' }).click()), submit: 'Save contact', field: 'Name', error: 'Enter a name.' },
  { form: 'new company', start: (page) => go(page, 'Companies').then(() => page.getByRole('link', { name: 'New company' }).click()), submit: 'Save company', field: 'Name', error: 'Enter a name.' },
  { form: 'new opportunity', start: (page) => go(page, 'Pipeline').then(() => page.getByRole('link', { name: 'New opportunity' }).click()), submit: 'Save opportunity', field: 'Title', error: 'Enter a title.' },
  { form: 'new task', start: (page) => go(page, 'Tasks').then(() => page.getByRole('link', { name: 'New task' }).click()), submit: 'Save task', field: 'Title', error: 'Enter a title.' },
  { form: 'activity form', start: (page) => page.getByRole('link', { name: 'Log activity' }).click(), submit: 'Save activity', field: 'What happened', error: 'Enter what happened.' },
  { form: 'stage editor', start: (page) => go(page, 'Settings'), submit: 'Add stage', field: 'New stage name', error: 'Enter a stage name.' },
];

for (const required of requiredFields) {
  test(`${required.form}: an empty "${required.field}" is marked, read with its error, and focused`, async ({ page }) => {
    await open(page);
    await required.start(page);
    await page.getByRole('button', { name: required.submit }).click();
    const input = field(page, required.field);
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(required.error);
  });
}

test('connect screen: each empty field is marked and read with its error, the first gets focus, and nothing is sent', async ({ page }) => {
  const fake = await routeFakeGitHub(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect' }).click();
  const repo = field(page, 'Repository');
  const token = field(page, 'Fine-grained personal access token');
  await expect(repo).toBeFocused();
  await expect(repo).toHaveAttribute('aria-invalid', 'true');
  await expect(repo).toHaveAccessibleDescription(/^Enter the repository as owner\/repo, for example octo-dev\/crm\./);
  await expect(token).toHaveAttribute('aria-invalid', 'true');
  await expect(token).toHaveAccessibleDescription('Paste the token from GitHub.');

  await repo.fill(`${fake.owner}/${fake.repo}`);
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(token).toBeFocused();
  await expect(repo).toHaveAttribute('aria-invalid', 'false');
  expect(fake.requests).toHaveLength(0);
});

test('workspace setup: an empty name is marked, read with its error, and focused', async ({ page }) => {
  const fake = await routeFakeGitHub(page);
  await connect(page, fake);
  await expect(page.getByRole('heading', { name: 'Set up a GitCRM workspace' })).toBeVisible();
  const name = field(page, 'Workspace name');
  await name.fill('');
  await page.getByRole('button', { name: 'Set up workspace' }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription('Enter a name for the workspace.');
});
