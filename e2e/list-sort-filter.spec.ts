// Spec 14 (list sort, filters, and columns), against the fake GitHub: Contacts, Companies, and the
// Pipeline board and list.
import { withCustomFields, type CustomField, type CustomFieldSets } from '../src/core/custom-fields.ts';
import { expect, test, type Page } from './fixtures.ts';
import { company, contact, exampleConfig, field, go, open, opportunity } from './workspace.ts';

const def = (id: string, label: string, type: CustomField['type'], position = 0): CustomField => ({ id, label, type, position, archived: false, options: [] });
const withFields = (sets: Partial<CustomFieldSets>) => withCustomFields(exampleConfig(), { contact: [], company: [], opportunity: [], ...sets });

const contactsTable = (page: Page) => page.getByRole('table', { name: 'Contacts' });
const names = (page: Page, table = contactsTable(page)) => table.locator('tbody tr td:first-child a');
const header = (page: Page, name: string) => page.getByRole('columnheader', { name, exact: true });
const listStatus = (page: Page) => page.getByRole('main').getByRole('status').first();
const filters = (page: Page) => page.getByRole('group', { name: 'Filters' });

async function addFilter(page: Page, n: number, fieldName: string, condition: string, value?: string) {
  await page.getByRole('button', { name: 'Add filter' }).click();
  await expect(field(page, `Filter ${n} field`)).toBeFocused();
  await field(page, `Filter ${n} field`).selectOption({ label: fieldName });
  await field(page, `Filter ${n} condition`).selectOption({ label: condition });
  if (value === undefined) return;
  const input = field(page, `Filter ${n} value`);
  if ((await input.evaluate((el) => el.tagName)) === 'SELECT') await input.selectOption({ label: value });
  else await input.fill(value);
}

test('sorts by a column header, in both directions, with empty values last', async ({ page }) => {
  await open(page, [contact('Ava Bennett', { jobTitle: 'Owner' }), contact('Ben Carter', { jobTitle: 'Buyer' }), contact('Cy Dale')]);
  await go(page, 'Contacts');
  await expect(names(page)).toHaveText(['Ava Bennett', 'Ben Carter', 'Cy Dale']);
  await expect(header(page, 'Name')).toHaveAttribute('aria-sort', 'ascending');
  await expect(header(page, 'Job title')).not.toHaveAttribute('aria-sort');

  const jobTitle = page.getByRole('button', { name: 'Job title', exact: true });
  await jobTitle.click();
  await expect(names(page)).toHaveText(['Ben Carter', 'Ava Bennett', 'Cy Dale']);
  await expect(header(page, 'Job title')).toHaveAttribute('aria-sort', 'ascending');
  await expect(header(page, 'Name')).not.toHaveAttribute('aria-sort');

  await jobTitle.click();
  await expect(names(page)).toHaveText(['Ava Bennett', 'Ben Carter', 'Cy Dale']);
  await expect(header(page, 'Job title')).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0);
});

test('filters by a field without a column, with every filter to match, and a filter with no value', async ({ page }) => {
  await open(page, [
    contact('Ava Bennett', { source: 'Referral', tags: ['vip'] }),
    contact('Ben Carter', { source: 'Event', tags: ['vip'], jobTitle: 'Buyer' }),
    contact('Cy Dale', { tags: ['vip'] }),
  ]);
  await go(page, 'Contacts');

  await addFilter(page, 1, 'Source', 'is');
  await expect(names(page)).toHaveCount(3);
  await field(page, 'Filter 1 value').fill('referral');
  await expect(names(page)).toHaveText(['Ava Bennett']);
  await expect(listStatus(page)).toHaveText('1 contact');

  await field(page, 'Filter 1 field').selectOption({ label: 'Tags' });
  await expect(field(page, 'Filter 1 condition')).toHaveValue('contains');
  await expect(field(page, 'Filter 1 value')).toHaveValue('');
  await field(page, 'Filter 1 value').fill('vip');
  await addFilter(page, 2, 'Job title', 'is empty');
  await expect(field(page, 'Filter 2 value')).toHaveCount(0);
  await expect(names(page)).toHaveText(['Ava Bennett', 'Cy Dale']);

  await page.getByRole('button', { name: 'Remove filter 1' }).click();
  await expect(page.getByRole('button', { name: 'Add filter' })).toBeFocused();
  await expect(filters(page).getByRole('combobox')).toHaveCount(2);
  await expect(field(page, 'Filter 1 condition')).toHaveValue('empty');
  await page.getByRole('button', { name: 'Remove filter 1' }).click();
  await expect(names(page)).toHaveCount(3);
});

test('a filter keeps after a record page, and a new value starts at page 1', async ({ page }) => {
  await open(page, Array.from({ length: 60 }, (_, i) => contact(`Contact ${String(i + 1).padStart(3, '0')}`, { tags: i < 55 ? ['vip'] : [] })));
  await go(page, 'Contacts');
  await page.getByRole('navigation', { name: 'Contacts pages' }).getByRole('button', { name: 'Next page' }).click();
  await expect(listStatus(page)).toHaveText('Showing 51–60 of 60 contacts');
  await addFilter(page, 1, 'Tags', 'contains', 'vip');
  await expect(listStatus(page)).toHaveText('Showing 1–50 of 55 contacts');

  await page.getByRole('link', { name: 'Contact 001' }).click();
  await page.goBack();
  await expect(field(page, 'Filter 1 value')).toHaveValue('vip');
  await expect(listStatus(page)).toHaveText('Showing 1–50 of 55 contacts');
});

test('the Pipeline list sorts by value, and a stage filter changes the board and the list', async ({ page }) => {
  const acme = company('Acme Corp');
  await open(page, [
    acme,
    opportunity('Small', 'qualified', { valueMinor: 50000, expectedCloseDate: '2026-11-10' }),
    opportunity('Large', 'lead', { valueMinor: 200000, companyId: acme.id, expectedCloseDate: '2026-12-10' }),
    opportunity('Unpriced', 'lead'),
  ]);
  await go(page, 'Pipeline');
  await addFilter(page, 1, 'Stage', 'is not', 'Lead');
  const board = page.getByRole('main');
  await expect(board.getByRole('link', { name: 'Small' })).toBeVisible();
  await expect(board.getByRole('link', { name: 'Large' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Filter 1 value' })).toHaveValue('lead');

  await field(page, 'View').selectOption('List');
  const table = page.getByRole('table', { name: 'Opportunities' });
  await expect(names(page, table)).toHaveText(['Small']);
  await page.getByRole('button', { name: 'Remove filter 1' }).click();
  await expect(names(page, table)).toHaveText(['Large', 'Unpriced', 'Small']);
  await expect(header(page, 'Stage')).toHaveAttribute('aria-sort', 'ascending');

  await page.getByRole('button', { name: 'Value', exact: true }).click();
  await expect(names(page, table)).toHaveText(['Small', 'Large', 'Unpriced']);
  await page.getByRole('button', { name: 'Value', exact: true }).click();
  await expect(names(page, table)).toHaveText(['Large', 'Small', 'Unpriced']);

  await addFilter(page, 1, 'Expected close', 'on or before', '2026-11-30');
  await expect(names(page, table)).toHaveText(['Small']);
  await field(page, 'Filter 1 condition').selectOption({ label: 'is empty' });
  await expect(names(page, table)).toHaveText(['Unpriced']);
  await field(page, 'Filter 1 field').selectOption({ label: 'Company' });
  await field(page, 'Filter 1 value').fill('acme');
  await expect(names(page, table)).toHaveText(['Large']);
});

test('filters by a custom checkbox, and shows a custom number as a column that sorts', async ({ page }) => {
  const config = withFields({ contact: [def('newsletter', 'Newsletter', 'checkbox')], company: [def('employees', 'Employees', 'number')] });
  await open(
    page,
    [
      contact('Ava Bennett', { customFields: { newsletter: true } }),
      contact('Ben Carter'),
      company('Acme Corp', { customFields: { employees: 1200 } }),
      company('Beta LLC', { customFields: { employees: 40 } }),
      company('Gamma Inc'),
    ],
    {},
    config,
  );
  await go(page, 'Contacts');
  await addFilter(page, 1, 'Newsletter', 'is checked');
  await expect(names(page)).toHaveText(['Ava Bennett']);

  await go(page, 'Companies');
  const table = page.getByRole('table', { name: 'Companies' });
  await expect(header(page, 'Employees')).toHaveCount(0);
  await page.getByText('Columns', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Employees' }).click();
  await expect(table.getByRole('columnheader')).toHaveText(['Name', 'Industry', 'Website', 'Contacts', 'Tags', 'Updated', 'Employees']);
  await expect(table.getByRole('row', { name: /Acme Corp/ }).getByRole('cell').last()).toHaveText('1,200');

  await page.getByRole('button', { name: 'Employees', exact: true }).click();
  await expect(names(page, table)).toHaveText(['Beta LLC', 'Acme Corp', 'Gamma Inc']);

  await page.getByRole('checkbox', { name: 'Employees' }).click();
  await expect(header(page, 'Employees')).toHaveCount(0);
  await expect(header(page, 'Name')).toHaveAttribute('aria-sort', 'ascending');
});

test('the column choice stays after a reload, and Disconnect removes it', async ({ page }) => {
  await open(page, [company('Acme Corp', { customFields: { employees: 12 } })], {}, withFields({ company: [def('employees', 'Employees', 'number')] }));
  await go(page, 'Companies');
  await page.getByText('Columns', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Employees' }).click();
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.columns'))).toBe('{"contact":[],"company":["employees"],"opportunity":[]}');

  await page.reload();
  await expect(header(page, 'Employees')).toBeVisible();

  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('button', { name: 'Confirm disconnect' }).click();
  await expect(page.getByRole('heading', { name: /Connect GitCRM/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gitcrm.columns'))).toBeNull();
});
