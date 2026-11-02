import { describe, expect, it } from 'vitest';
import type { CustomField } from '@/core/custom-fields.ts';
import { newRecord } from '@/core/records.ts';
import { companySpec, contactSpec, customListField, localDate, opportunitySpec } from './list-fields.ts';
import { filterRecords, sortRecords, type ListField } from './list-query.ts';

const now = new Date('2026-11-02T15:00:00Z');
const ids = { ava: '0d3f8a2c-5d39-4a52-9a43-0a4f3c1f9e01', ben: '0d3f8a2c-5d39-4a52-9a43-0a4f3c1f9e02', acme: '0d3f8a2c-5d39-4a52-9a43-0a4f3c1f9e03', deal: '0d3f8a2c-5d39-4a52-9a43-0a4f3c1f9e04', yen: '0d3f8a2c-5d39-4a52-9a43-0a4f3c1f9e05' };
const empty = { emails: [], phones: [], companyId: null, tags: [] };
const ava = newRecord('contact', { ...empty, name: 'Ava', emails: ['b@example.test', 'a@example.test'], companyId: ids.acme, address: { street: '1 Main St\nUnit 4', city: 'Portland', region: null, postalCode: null, country: 'USA' } }, { now, id: ids.ava });
const ben = newRecord('contact', { ...empty, name: 'Ben', jobTitle: 'Buyer' }, { now, id: ids.ben });
const acme = newRecord('company', { name: 'Acme', website: 'https://acme.example', tags: [] }, { now, id: ids.acme });
const stages = [
  { id: 'won', label: 'Won', position: 2 },
  { id: 'lead', label: 'Lead', position: 0 },
  { id: 'lost', label: 'Lost', position: 3 },
  { id: 'qualified', label: 'Qualified', position: 1 },
];
const deal = newRecord('opportunity', { title: 'Big deal', stageId: 'qualified', companyId: ids.acme, contactIds: [ids.ben, ids.ava], valueMinor: 100000, currency: 'USD', expectedCloseDate: '2026-11-30' }, { now, id: ids.deal });
const yen = newRecord('opportunity', { title: 'Yen deal', stageId: 'lead', companyId: null, contactIds: [], valueMinor: 500, currency: 'JPY', expectedCloseDate: null }, { now, id: ids.yen });

const custom = (type: CustomField['type'], options: CustomField['options'] = []): CustomField => ({ id: 'extra', label: 'Extra', type, position: 0, archived: false, options });
const value = <R>(fields: ListField<R>[], id: string, record: R) => fields.find((f) => f.id === id)!.value(record);
const names = { company: (id: string | null) => (id === ids.acme ? 'Acme' : ''), contacts: (list: string[]) => list.map((id) => (id === ids.ava ? 'Ava' : 'Ben')) };

describe('contactSpec', () => {
  const spec = contactSpec({ companyName: names.company, custom: [custom('text')] });

  it('has every contact field, then the custom fields, and starts by name', () => {
    expect(spec.fields.map((f) => f.label)).toEqual(['Name', 'Job title', 'Company', 'Email', 'Phone', 'Profiles', 'Address', 'Source', 'Tags', 'Updated', 'Extra']);
    expect(spec.start).toEqual({ field: 'name', direction: 'ascending' });
  });

  it('reads the company name, every email, the address as one line, and the date of the change', () => {
    expect(value(spec.fields, 'company', ava)).toEqual(['Acme']);
    expect(value(spec.fields, 'company', ben)).toEqual([]);
    expect(value(spec.fields, 'emails', ava)).toEqual(['b@example.test', 'a@example.test']);
    expect(value(spec.fields, 'address', ava)).toEqual(['1 Main St, Unit 4, Portland, USA']);
    expect(value(spec.fields, 'jobTitle', ava)).toEqual([]);
    expect(value(spec.fields, 'updated', ava)).toBe(localDate(ava.updatedAt));
  });

  it('sorts the email column by the first email, the one the cell shows', () => {
    const other = { ...ben, emails: ['a@example.test'] };
    expect(sortRecords([ava, other], { field: 'emails', direction: 'ascending' }, spec).map((c) => c.name)).toEqual(['Ben', 'Ava']);
  });
});

describe('companySpec', () => {
  const spec = companySpec({ contactCount: (id) => (id === ids.acme ? 2 : 0), custom: [] });

  it('has every company field, with the contact count as a number', () => {
    expect(spec.fields.map((f) => f.label)).toEqual(['Name', 'Industry', 'Website', 'Phone', 'Address', 'Contacts', 'Tags', 'Updated']);
    expect(value(spec.fields, 'contacts', acme)).toBe(2);
    expect(value(spec.fields, 'website', acme)).toEqual(['https://acme.example']);
  });
});

describe('opportunitySpec', () => {
  const spec = opportunitySpec({ stages, companyName: names.company, contactNames: names.contacts, custom: [] });

  it('has every opportunity field, starts by stage, and breaks ties by close date, then title', () => {
    expect(spec.fields.map((f) => f.label)).toEqual(['Opportunity', 'Stage', 'Value', 'Company', 'Contacts', 'Expected close', 'Updated']);
    expect(spec.start).toEqual({ field: 'stage', direction: 'ascending' });
    expect(spec.ties).toEqual(['expectedClose', 'title']);
  });

  it('offers the stages in pipeline order', () => {
    const stage = spec.fields.find((f) => f.id === 'stage')!;
    expect(stage.kind === 'choice' && stage.options.map((o) => o.label)).toEqual(['Lead', 'Qualified', 'Won', 'Lost']);
  });

  it('reads the value as an amount in its currency, not in minor units', () => {
    expect(value(spec.fields, 'value', deal)).toBe(1000);
    expect(value(spec.fields, 'value', yen)).toBe(500);
    expect(value(spec.fields, 'contacts', deal)).toEqual(['Ben', 'Ava']);
  });

  it('starts in pipeline order', () => {
    expect(sortRecords([deal, yen], spec.start, spec).map((o) => o.title)).toEqual(['Yen deal', 'Big deal']);
  });
});

describe('customListField', () => {
  const withValue = (stored: string | number | boolean | null) => ({ ...ben, customFields: { extra: stored } });

  it('reads text and a web address as text, and a value that does not fit as none', () => {
    expect(customListField(custom('text')).value(withValue('Gold'))).toEqual(['Gold']);
    expect(customListField(custom('url')).value(withValue('https://a.example'))).toEqual(['https://a.example']);
    expect(customListField(custom('text')).value(withValue(3))).toEqual([]);
    expect(customListField(custom('text')).value(ben)).toEqual([]);
  });

  it('reads a number, a date, and a checkbox', () => {
    expect(customListField(custom('number')).value(withValue(12.5))).toBe(12.5);
    expect(customListField(custom('number')).value(withValue('12'))).toBeNull();
    expect(customListField(custom('date')).value(withValue('2026-11-02'))).toBe('2026-11-02');
    expect(customListField(custom('checkbox')).value(withValue(true))).toBe(true);
    expect(customListField(custom('checkbox')).value(ben)).toBe(false);
  });

  it('reads a choice by option ID, and a removed option as none', () => {
    const field = customListField(
      custom('select', [
        { id: 'gold', label: 'Gold', archived: false },
        { id: 'old', label: 'Old', archived: true },
      ]),
    );
    expect(field.id).toBe('custom.extra');
    expect(field.kind === 'choice' && field.options.map((o) => o.id)).toEqual(['gold']);
    expect(field.value(withValue('gold'))).toBe('gold');
    expect(field.value(withValue('old'))).toBeNull();
    expect(field.value(withValue('gone'))).toBeNull();
  });

  it('filters by a custom checkbox', () => {
    const spec = contactSpec({ companyName: names.company, custom: [custom('checkbox')] });
    const checked = filterRecords([withValue(true), ava], [{ id: 1, field: 'custom.extra', condition: 'checked', value: '' }], spec.fields);
    expect(checked.map((c) => c.name)).toEqual(['Ben']);
  });
});

describe('localDate', () => {
  it('writes the date of a time on this device clock', () => {
    const time = new Date(2026, 10, 2, 23, 30);
    expect(localDate(time.toISOString())).toBe('2026-11-02');
  });
});
