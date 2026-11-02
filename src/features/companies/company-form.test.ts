import { describe, expect, it } from 'vitest';
import { companyValues, readCompanyForm } from './company-form.ts';

const noAddress = { street: '', city: '', region: '', postalCode: '', country: '' };
const empty = { industry: '', phones: [''], address: noAddress };
const none = { industry: null, phones: [], address: null };
const website = (value: string) => readCompanyForm({ name: 'Northwind Traders', website: value, tags: '', custom: {}, ...empty });

describe('companyValues', () => {
  it('starts a new company empty', () => {
    expect(companyValues(null)).toEqual({ name: '', website: '', tags: '', custom: {}, ...empty });
  });

  it('reads a saved company back into the form', () => {
    expect(companyValues({ name: 'Northwind Traders', website: 'https://northwind.example', tags: ['partner'], industry: 'Wholesale', phones: ['+1 555 0199'], address: { street: null, city: 'Seattle', region: null, postalCode: null, country: null } })).toEqual({
      name: 'Northwind Traders',
      industry: 'Wholesale',
      website: 'https://northwind.example',
      phones: ['+1 555 0199'],
      address: { ...noAddress, city: 'Seattle' },
      tags: 'partner',
      custom: {},
    });
  });
});

describe('readCompanyForm', () => {
  it('turns valid values into company fields', () => {
    expect(readCompanyForm({ name: ' Northwind Traders ', website: ' https://northwind.example/about ', tags: 'partner', custom: {}, ...empty })).toEqual({
      ok: true,
      fields: { name: 'Northwind Traders', website: 'https://northwind.example/about', tags: ['partner'], customFields: undefined, ...none },
    });
  });

  it('reads the industry, the phones, and the address (spec 13)', () => {
    const values = { name: 'Northwind Traders', website: '', tags: '', custom: {}, industry: ' Wholesale ', phones: [' +1 555 0199 ', ''], address: { ...noAddress, postalCode: ' 98101 ' } };
    expect(readCompanyForm(values)).toMatchObject({
      ok: true,
      fields: { industry: 'Wholesale', phones: ['+1 555 0199'], address: { street: null, city: null, region: null, postalCode: '98101', country: null } },
    });
  });

  it('stores no website when the field is empty', () => {
    expect(website('')).toEqual({ ok: true, fields: { name: 'Northwind Traders', website: null, tags: [], customFields: undefined, ...none } });
  });

  it('adds https:// to an address without a scheme', () => {
    const result = website('northwind.example');
    expect(result.ok && result.fields.website).toBe('https://northwind.example');
  });

  it.each(['javascript:alert(1)', 'ftp://northwind.example', 'https://', 'not a website'])('refuses %s', (value) => {
    expect(website(value)).toEqual({ ok: false, errors: { website: 'Enter a web address, such as https://example.com.' } });
  });

  it('requires a name', () => {
    expect(readCompanyForm({ name: '', website: '', tags: '', custom: {}, ...empty })).toEqual({ ok: false, errors: { name: 'Enter a name.' } });
  });
});
