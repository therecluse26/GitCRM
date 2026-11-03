// Spec 15, the public form page (lead.html), against the fake Formcarry. A Content Security Policy
// violation fails each test (e2e/fixtures.ts).
import { expect, test, type Page } from './fixtures.ts';
import { routeFakeFormcarry } from './fake-route.ts';

const FORM = 'exampleForm1';
const open = (page: Page, hash = `#form=${FORM}`) => page.goto(`./lead.html${hash}`);
const send = (page: Page) => page.getByRole('button', { name: 'Send' });

test('a visitor sends the form, and Formcarry receives the fields', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Contact us' })).toBeVisible();
  await expect(page.getByText(`Sent through Formcarry, form ${FORM}.`)).toBeVisible();

  await page.getByLabel('Name', { exact: true }).fill('Ava Bennett');
  await page.getByLabel('Email', { exact: true }).fill('ava@example.com');
  await page.getByLabel('Message (optional)').fill('I would like a quote.');
  await send(page).click();

  const thanks = page.getByRole('status');
  await expect(thanks).toHaveText('Thank you. We received your message.');
  await expect(thanks).toBeFocused();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  expect(fc.leads).toHaveLength(1);
  expect(fc.leads[0].spam).toBe(false);
  expect(fc.leads[0].fields).toEqual([
    { key: 'name', value: 'Ava Bennett' },
    { key: 'email', value: 'ava@example.com' },
    { key: 'phone', value: '' },
    { key: 'message', value: 'I would like a quote.' },
  ]);
  // The page keeps nothing: no storage, no cookie. It shares the app's address, which holds the token.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
});

test('the page asks only the form, and nothing else off its own site', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  const hosts = new Set<string>();
  page.on('request', (request) => hosts.add(new URL(request.url()).host));
  await open(page);
  await page.getByLabel('Name', { exact: true }).fill('Ava');
  await page.getByLabel('Email', { exact: true }).fill('ava@example.com');
  await send(page).click();
  await expect(page.getByRole('status')).toHaveText('Thank you. We received your message.');
  expect([...hosts].sort()).toEqual(['formcarry.com', new URL(page.url()).host].sort());
  expect(fc.requests.every((r) => new URL(r.url).host === 'formcarry.com' && r.authorization === null)).toBe(true);
});

test('says what is missing, and sends nothing until the form is right', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await send(page).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await expect(page.getByText('Enter your email address.')).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Name', { exact: true }).fill('Ava');
  await page.getByLabel('Email', { exact: true }).fill('ava');
  await send(page).click();
  await expect(page.getByText('Enter your name.')).toBeHidden();
  await expect(page.getByText('Enter a valid email address, such as ava@example.com.')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  expect(fc.requests).toHaveLength(0);
});

test('a link with a bad form ID shows no form', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  for (const hash of ['', '#form=%3Cscript%3E', '#form=abc', '#form=a/b/c/d']) {
    await open(page, hash);
    await page.reload();
    await expect(page.getByText('This form link is not valid.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0);
    await expect(page.getByText('Sent through Formcarry')).toBeHidden();
  }
  expect(fc.requests).toHaveLength(0);
});

test('a bot that fills the hidden field is sent as spam', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await page.getByLabel('Name', { exact: true }).fill('Bot');
  await page.getByLabel('Email', { exact: true }).fill('bot@example.com');
  await page.evaluate(() => (document.querySelector<HTMLInputElement>('[name="_gotcha"]')!.value = 'gotcha'));
  await send(page).click();
  await expect(page.getByRole('status')).toHaveText('Thank you. We received your message.');
  expect(fc.leads).toHaveLength(1);
  expect(fc.leads[0].spam).toBe(true);
  // The honeypot is out of the tab order and hidden from a screen reader.
  await expect(page.locator('[name="_gotcha"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[name="_gotcha"]')).toHaveAttribute('tabindex', '-1');
});

test('keeps the answers when sending fails, and sends on the next try', async ({ page }) => {
  const fc = await routeFakeFormcarry(page);
  await open(page);
  await page.getByLabel('Name', { exact: true }).fill('Ava');
  await page.getByLabel('Email', { exact: true }).fill('ava@example.com');
  for (const fault of [{ status: 500, body: {} }, 'network'] as const) {
    fc.failNext('POST', /\/s\//, fault);
    await send(page).click();
    await expect(page.getByRole('status')).toHaveText('Your message could not be sent. Check your connection and try again.');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Ava');
    await expect(send(page)).toBeEnabled();
  }
  expect(fc.leads).toHaveLength(0);
  await send(page).click();
  await expect(page.getByRole('status')).toHaveText('Thank you. We received your message.');
  expect(fc.leads).toHaveLength(1);
});
