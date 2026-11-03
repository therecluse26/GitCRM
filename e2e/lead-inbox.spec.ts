// Spec 15, the Settings card and the Leads page, against the fake GitHub and the fake Formcarry.
import { connect } from './connect-page.ts';
import { routeFakeFormcarry, routeFakeGitHub } from './fake-route.ts';
import { expect, test, type Page } from './fixtures.ts';
import { field, go, homeHeading, open, seedWorkspace } from './workspace.ts';
import type { FakeFormcarry } from '../src/test/fake-formcarry.ts';

const leadsTab = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' });
const leadsTable = (page: Page) => page.getByRole('table', { name: 'Leads' });
const leadsStatus = (page: Page) => page.getByRole('main').getByRole('status').first();

// Settings, "Lead form": enter the form ID and key, and check them. Unless the check should fail,
// it waits for the check to finish, so a later step never meets the check's own requests.
async function setUp(page: Page, fc: FakeFormcarry, { key = fc.key, formId = fc.formId, fails = false } = {}) {
  await go(page, 'Settings');
  await field(page, 'Form ID').fill(formId);
  await field(page, 'API key').fill(key);
  await page.getByRole('button', { name: 'Save and check' }).click();
  if (!fails) await expect(page.getByRole('button', { name: 'Remove lead form' })).toBeVisible();
}

const AVA = { name: 'Ava Bennett', email: 'ava@example.com', phone: '555-0100', company: 'Northwind', message: 'I would like a quote for 20 desks.' };

test('sets up the lead form in Settings, and shows the link and the snippet', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await expect(leadsTab(page)).toHaveCount(0);

  await go(page, 'Settings');
  await expect(page.getByRole('heading', { level: 2, name: 'Lead form' })).toBeVisible();
  await page.getByRole('button', { name: 'Save and check' }).click();
  await expect(page.getByText(/Use 4 to 64 letters, digits/)).toBeVisible();
  await expect(page.getByText('Enter the API key.')).toBeVisible();
  expect(fc.requests).toHaveLength(0);

  await setUp(page, fc, { key: 'fc_live_wrong', fails: true });
  await expect(page.getByRole('alert')).toHaveText('Formcarry does not accept this key. Check that you copied all of it.');
  fc.scopes = ['submissions:read'];
  await setUp(page, fc, { fails: true });
  await expect(page.getByRole('alert')).toHaveText('The key needs the scopes submissions:read and submissions:write.');
  await expect(leadsTab(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.leads'))).toBeNull();

  fc.scopes = ['submissions:read', 'submissions:write'];
  await setUp(page, fc);
  const link = `${new URL('./', page.url()).href}lead.html#form=${fc.formId}`;
  await expect(page.getByLabel('Link to the form page')).toHaveValue(link);
  const snippet = page.getByLabel('HTML for your own website');
  await expect(snippet).toHaveValue(new RegExp(`<form action="https://formcarry\\.com/s/${fc.formId}" method="post"`));
  await expect(snippet).toHaveValue(/name="_gotcha"/);
  await expect(field(page, 'API key')).toHaveCount(0);
  await expect(leadsTab(page)).toBeVisible();

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.getByRole('button', { name: 'Copy snippet' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Snippet copied.');

  await page.getByRole('button', { name: 'Remove lead form' }).click();
  await expect(field(page, 'API key')).toBeVisible();
  await expect(leadsTab(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.leads'))).toBeNull();
});

test('adds a lead as a contact with a note, and removes it from Formcarry', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA, { createdAt: '2026-11-02T15:30:00.000Z' });
  fc.addLead({ name: 'Spam Bot', message: 'Buy now' }, { spam: true });
  const github = await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
  await expect(leadsStatus(page)).toHaveText('1 new lead.');
  const row = leadsTable(page).getByRole('row', { name: /Ava Bennett/ });
  await expect(row).toContainText('ava@example.com');
  await expect(row).toContainText('555-0100');
  await expect(row).toContainText('I would like a quote for 20 desks.');
  await expect(page.getByText('Spam Bot')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add as contact for Ava Bennett' }).click();
  await expect(row.getByRole('status')).toContainText('Added:');
  await expect.poll(() => fc.leads.filter((l) => !l.spam).length).toBe(0); // the spam stays in Formcarry
  expect(github.count('PUT', /\/contents\/data\//)).toBe(2);

  await row.getByRole('link', { name: 'Ava Bennett' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ava Bennett' })).toBeVisible();
  await expect(page.getByText('Lead form', { exact: true })).toBeVisible();
  await expect(page.getByText('ava@example.com').first()).toBeVisible();
  await expect(page.getByText('555-0100').first()).toBeVisible();
  await expect(page.getByText('I would like a quote for 20 desks.')).toBeVisible();
  await expect(page.getByText('Company: Northwind')).toBeVisible();
  // The visitor's details are not copied.
  await expect(page.getByText(/203\.0\.113|Mozilla|example\.com\/contact/)).toHaveCount(0);
});

test('names a lead by the email when it has no name', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead({ email: 'cy@example.com' });
  await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();
  await page.getByRole('button', { name: 'Add as contact for cy@example.com' }).click();
  await expect(leadsTable(page).getByRole('link', { name: 'cy@example.com' })).toBeVisible();
});

test('discards a lead after a confirmation, and creates no contact', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  fc.addLead({ name: 'Ben Carter', email: 'ben@example.com' });
  const github = await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();
  await expect(leadsStatus(page)).toHaveText('2 new leads.');

  await page.getByRole('button', { name: 'Discard lead from Ava Bennett' }).click();
  await expect(page.getByRole('button', { name: 'Confirm discard for Ava Bennett' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Discard lead from Ava Bennett' })).toBeFocused();
  expect(fc.leads).toHaveLength(2);

  await page.getByRole('button', { name: 'Discard lead from Ava Bennett' }).click();
  await page.getByRole('button', { name: 'Confirm discard for Ava Bennett' }).click();
  await expect(leadsTable(page).getByRole('row', { name: /Ava Bennett/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check for leads' })).toBeFocused();
  await expect(leadsStatus(page)).toHaveText('1 new lead.');
  expect(fc.leads.map((l) => l.fields[0].value)).toEqual(['Ben Carter']);
  expect(github.count('PUT', /\/contents\/data\//)).toBe(0);
});

test('a second try after a failed note adds the note, not a second contact', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  const github = await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();
  github.failNext('PUT', /\/contents\/data\/activit/, { respond: { status: 500, body: { message: 'Server Error' } } });

  const add = page.getByRole('button', { name: 'Add as contact for Ava Bennett' });
  await add.click();
  await expect(page.getByRole('alert')).toHaveText('Contact added, note not saved. GitHub had an error. Try again later.');
  expect(fc.leads).toHaveLength(1);

  await add.click();
  await expect(leadsTable(page).getByRole('status')).toContainText('Added:');
  expect(fc.leads).toHaveLength(0);
  await go(page, 'Contacts');
  await expect(page.getByRole('table', { name: 'Contacts' }).locator('tbody tr')).toHaveCount(1);
});

test('when Formcarry cannot remove the lead, a second try only removes it', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  const github = await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();
  fc.failNext('DELETE', /submissions\//, 'network');

  await page.getByRole('button', { name: 'Add as contact for Ava Bennett' }).click();
  await expect(page.getByRole('alert')).toHaveText('Added. Formcarry still has this lead. GitCRM could not reach Formcarry. Check your connection and try again.');
  expect(fc.leads).toHaveLength(1);
  const saves = github.count('PUT', /\/contents\/data\//);
  expect(saves).toBe(2);

  await page.getByRole('button', { name: 'Add as contact for Ava Bennett' }).click();
  await expect(leadsTable(page).getByRole('status')).toContainText('Added:');
  expect(fc.leads).toHaveLength(0);
  expect(github.count('PUT', /\/contents\/data\//)).toBe(saves);
});

test('waits when Formcarry asks, and sends no second request by itself', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  await open(page);
  await setUp(page, fc);
  fc.failNext('GET', /submissions$/, { status: 429, body: { error: { type: 'rate_limit_error', code: 'rate_limited', message: 'Slow down' } }, headers: { 'retry-after': '30' } });
  await leadsTab(page).click();
  await expect(page.getByRole('alert')).toHaveText('Formcarry asks you to wait 30 seconds. Then select "Check for leads" again.');

  const requests = fc.count('GET', /submissions$/);
  await page.waitForTimeout(1500);
  expect(fc.count('GET', /submissions$/)).toBe(requests);

  await page.getByRole('button', { name: 'Check for leads' }).click();
  await expect(leadsStatus(page)).toHaveText('1 new lead.');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('counts a lead it cannot read, and says when Formcarry holds more than one check reads', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  for (let i = 0; i < 505; i += 1) fc.addLead({ name: `Lead ${String(i).padStart(3, '0')}`, email: `lead${i}@example.com` });
  fc.leads.push({ id: 'f'.repeat(24), createdAt: 'not a time', spam: false, fields: [] });
  await open(page);
  await setUp(page, fc);
  await leadsTab(page).click();
  await expect(leadsStatus(page)).toHaveText('500 new leads. Showing the oldest 500. Add or discard some, then check again.');

  fc.leads.splice(0, fc.leads.length - 1);
  await page.getByRole('button', { name: 'Check for leads' }).click();
  await expect(leadsStatus(page)).toHaveText('No new leads. 1 lead could not be read. It stays in Formcarry.');
});

test('a read-only token can discard leads and cannot add them', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  await open(page, [], { canWrite: false });
  await setUp(page, fc);
  await leadsTab(page).click();
  await expect(page.getByText('GitCRM is read-only here, so changes cannot be saved. You can still discard leads.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add as contact for Ava Bennett' })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard lead from Ava Bennett' }).click();
  await page.getByRole('button', { name: 'Confirm discard for Ava Bennett' }).click();
  await expect(leadsStatus(page)).toHaveText('No new leads.');
  expect(fc.leads).toHaveLength(0);
});

test('checks Formcarry only when the Leads page opens or the owner asks', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await setUp(page, fc);
  fc.requests.splice(0);

  await go(page, 'Contacts');
  await go(page, 'Companies');
  await go(page, 'Tasks');
  // The app checks GitHub when the tab comes back into focus. It must not check Formcarry.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1000);
  expect(fc.requests).toHaveLength(0);

  await leadsTab(page).click();
  await expect(leadsStatus(page)).toHaveText('No new leads.');
  expect(fc.requests.length).toBeGreaterThan(0);
});

test('keeps the setup on a remembered device, and Disconnect removes it', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  const github = await open(page);
  await setUp(page, fc);
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.leads'))).toBe(JSON.stringify({ service: 'formcarry', formId: fc.formId, key: fc.key }));

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(leadsTab(page)).toBeVisible();

  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('button', { name: 'Confirm disconnect' }).click();
  await expect(page.getByRole('heading', { name: /Connect GitCRM/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.leads'))).toBeNull();

  await connect(page, github);
  await expect(homeHeading(page)).toBeVisible();
  await expect(leadsTab(page)).toHaveCount(0);
});

test('stores nothing when the connection is not remembered', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  const github = await routeFakeGitHub(page);
  await seedWorkspace(github, []);
  await connect(page, github, { remember: false });
  await expect(homeHeading(page)).toBeVisible();
  await setUp(page, fc);
  await expect(leadsTab(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.leads'))).toBeNull();
  await expect(page.getByText('The form ID and key stay until the page reloads, because this browser stores nothing.')).toBeVisible();
});

test('the Formcarry key goes only to Formcarry, and the GitHub token only to GitHub', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  fc.addLead(AVA);
  const github = await open(page);
  const seen: { method: string; url: string; authorization: string | undefined }[] = [];
  const pending: Promise<void>[] = [];
  page.on('request', (request) => {
    pending.push(request.allHeaders().then((headers) => void seen.push({ method: request.method(), url: request.url(), authorization: headers.authorization })));
  });
  await setUp(page, fc);
  await leadsTab(page).click();
  await page.getByRole('button', { name: 'Add as contact for Ava Bennett' }).click();
  await expect(leadsTable(page).getByRole('status')).toContainText('Added:');
  await Promise.all(pending);

  const to = (host: string) => seen.filter((r) => new URL(r.url).host === host && r.method !== 'OPTIONS');
  expect(to('api.formcarry.com').length).toBeGreaterThan(3);
  expect(to('api.github.com').length).toBeGreaterThanOrEqual(2); // the contact and the note
  for (const r of to('api.formcarry.com')) expect(r.authorization).toBe(`Bearer ${fc.key}`);
  for (const r of to('api.github.com')) expect(r.authorization).toBe(`Bearer ${github.token}`);
  // Neither secret is in an address.
  for (const r of seen) expect(r.url).not.toContain(fc.key);
  for (const r of seen) expect(r.url).not.toContain(github.token);
});
