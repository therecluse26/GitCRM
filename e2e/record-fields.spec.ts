// Spec 13 (more contact and company fields), and the record versions of ADR-028.
import { recordPath } from '../src/core/paths.ts';
import { expect, test } from './fixtures.ts';
import { company, contact, field, go, open, openContact } from './workspace.ts';

const newData = (paths: string[]) => paths.filter((p) => p.startsWith('data/'));

test('saves the new contact fields as a version 2 file, and shows them', async ({ page }) => {
  const fake = await open(page);
  await go(page, 'Contacts');
  await page.getByRole('link', { name: 'New contact' }).click();
  await field(page, 'Name').fill('Ava Bennett');
  await field(page, 'Job title').fill('Head of Operations');
  await field(page, 'Profile 1').fill('linkedin.com/in/ava');
  await field(page, 'City').fill('Portland');
  await field(page, 'Country').fill('USA');
  await field(page, 'Source').fill('Referral');
  await page.getByRole('button', { name: 'Save contact' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ava Bennett' })).toBeVisible();
  const [path] = newData(fake.paths());
  expect(JSON.parse(fake.file(path)!)).toMatchObject({
    schemaVersion: 2,
    jobTitle: 'Head of Operations',
    profiles: ['https://linkedin.com/in/ava'],
    address: { street: null, city: 'Portland', region: null, postalCode: null, country: 'USA' },
    source: 'Referral',
  });

  const details = page.getByRole('main').locator('dl');
  await expect(details).toContainText('Head of Operations');
  await expect(details).toContainText('Referral');
  await expect(details.locator('address')).toHaveText('PortlandUSA');
  const profile = details.getByRole('link', { name: 'https://linkedin.com/in/ava' });
  await expect(profile).toHaveAttribute('href', 'https://linkedin.com/in/ava');
  await expect(profile).toHaveAttribute('target', '_blank');
  await expect(profile).toHaveAttribute('rel', 'noopener noreferrer');

  await go(page, 'Contacts');
  const row = page.getByRole('table', { name: 'Contacts' }).getByRole('row', { name: /Ava Bennett/ });
  await expect(row.getByRole('cell').nth(1)).toHaveText('Head of Operations');
});

test('clearing the only new field writes the file as version 1 again', async ({ page }) => {
  const ava = contact('Ava Bennett', { jobTitle: 'Head of Operations' });
  const fake = await open(page, [ava]);
  const path = recordPath('contact', ava.id);
  expect(JSON.parse(fake.file(path)!).schemaVersion).toBe(2);

  await openContact(page, 'Ava Bennett');
  await page.getByRole('link', { name: 'Edit' }).click();
  await field(page, 'Job title').fill('');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ava Bennett' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('status')).toHaveText('Saved · View commit');

  const json = JSON.parse(fake.file(path)!);
  expect(json.schemaVersion).toBe(1);
  expect(Object.keys(json)).not.toContain('jobTitle');
  expect(Object.keys(json)).not.toContain('address');
});

test('a bad profile shows a field error and saves nothing', async ({ page }) => {
  const fake = await open(page);
  await go(page, 'Contacts');
  await page.getByRole('link', { name: 'New contact' }).click();
  await field(page, 'Name').fill('Ava Bennett');
  await field(page, 'Profile 1').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(field(page, 'Profile 1')).toHaveAccessibleDescription('Enter a web address, such as https://example.com/ava.');
  expect(newData(fake.paths())).toEqual([]);
});

test('Source suggests the values other contacts use', async ({ page }) => {
  await open(page, [contact('Ava Bennett', { source: 'Referral' }), contact('Ben Ortiz', { source: 'Event' }), contact('Cy Lin', { source: 'referral' })]);
  await openContact(page, 'Cy Lin');
  await page.getByRole('link', { name: 'Edit' }).click();
  const list = await field(page, 'Source').getAttribute('list');
  await expect(page.locator(`datalist#${list} option`)).toHaveCount(2);
  expect(await page.locator(`datalist#${list} option`).evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value))).toEqual(['Event', 'Referral']);
});

test('saves the new company fields, and the Companies table shows the industry', async ({ page }) => {
  const fake = await open(page);
  await go(page, 'Companies');
  await page.getByRole('link', { name: 'New company' }).click();
  await field(page, 'Name').fill('Acme Corp');
  await field(page, 'Industry').fill('Manufacturing');
  await field(page, 'Phone 1').fill('+1 503 555 0188');
  await field(page, 'City').fill('Portland');
  await page.getByRole('button', { name: 'Save company' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Acme Corp' })).toBeVisible();
  const [path] = newData(fake.paths());
  expect(JSON.parse(fake.file(path)!)).toMatchObject({ schemaVersion: 2, industry: 'Manufacturing', phones: ['+1 503 555 0188'], address: { city: 'Portland' } });
  const details = page.getByRole('main').locator('dl');
  await expect(details.getByRole('link', { name: '+1 503 555 0188' })).toHaveAttribute('href', 'tel:+15035550188');
  await expect(details.locator('address')).toHaveText('Portland');

  await go(page, 'Companies');
  const row = page.getByRole('table', { name: 'Companies' }).getByRole('row', { name: /Acme Corp/ });
  await expect(row.getByRole('cell').nth(1)).toHaveText('Manufacturing');
});

test('version 1 files load with no issue, and search finds a new field', async ({ page }) => {
  const acme = company('Acme Corp');
  const ava = contact('Ava Bennett', { companyId: acme.id, jobTitle: 'Head of Operations' });
  const fake = await open(page, [acme, ava, contact('Ben Ortiz')]);
  expect(JSON.parse(fake.file(recordPath('company', acme.id))!).schemaVersion).toBe(1);

  await go(page, 'Settings');
  await expect(page.getByRole('list', { name: 'Files that need attention' })).toHaveCount(0);
  await go(page, 'Search');
  await field(page, 'Search records').fill('operations');
  await expect(page.getByRole('main').getByRole('link', { name: 'Ava Bennett' })).toBeVisible();
});

test('a contact file from a newer GitCRM is listed, not loaded', async ({ page }) => {
  const ava = contact('Ava Bennett');
  const path = recordPath('contact', ava.id);
  const fake = await open(page, [ava, contact('Ben Ortiz')]);
  await fake.seed(path, JSON.stringify({ ...JSON.parse(fake.file(path)!), schemaVersion: 3 }));
  await page.reload();
  await go(page, 'Settings');
  await expect(page.getByRole('list', { name: 'Files that need attention' })).toContainText(`${path}: Schema version 3 is newer than this app supports`);
});
