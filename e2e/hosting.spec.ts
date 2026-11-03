// Spec 09: the same build runs from any folder on a static host. The "github-pages" project serves
// it from /GitCRM/ with no custom headers, the way GitHub Pages serves a project site.
import { routeFakeFormcarry } from './fake-route.ts';
import { expect, test } from './fixtures.ts';
import { company, field, go, open } from './workspace.ts';

test("every request goes to the app's own folder or to api.github.com, and the address keeps the folder", async ({ page, baseURL }) => {
  const folder = new URL('./', baseURL).href;
  const requests: string[] = [];
  page.on('request', (request) => void requests.push(request.url()));
  await open(page, [company('Acme Corp')]);
  for (const name of ['Contacts', 'Companies', 'Pipeline', 'Tasks', 'Search', 'Settings']) {
    await go(page, name);
    await expect(page).toHaveURL(`${folder}#/${name.toLowerCase()}`);
  }
  expect(requests.filter((url) => url.startsWith(folder)).length).toBeGreaterThan(2); // the page, the script, the stylesheet
  expect(requests.filter((url) => !url.startsWith(folder) && !url.startsWith('https://api.github.com/'))).toEqual([]);
});

// Spec 15: the link in Settings points to lead.html in the app's own folder, and the page asks only
// that folder and Formcarry.
test('the lead form link opens the form page from the same folder', async ({ page, baseURL }) => {
  const folder = new URL('./', baseURL).href;
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await go(page, 'Settings');
  await field(page, 'Form ID').fill(fc.formId);
  await field(page, 'API key').fill(fc.key);
  await page.getByRole('button', { name: 'Save and check' }).click();
  const link = `${folder}lead.html#form=${fc.formId}`;
  await expect(page.getByLabel('Link to the form page')).toHaveValue(link);

  const requests: string[] = [];
  page.on('request', (request) => void requests.push(request.url()));
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: 'Contact us' })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Ava');
  await page.getByLabel('Email', { exact: true }).fill('ava@example.com');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toHaveText('Thank you. We received your message.');
  expect(requests.filter((url) => url.startsWith(folder)).length).toBeGreaterThan(1); // the page, the script, the stylesheet
  expect(requests.filter((url) => !url.startsWith(folder) && !url.startsWith('https://formcarry.com/'))).toEqual([]);
});
