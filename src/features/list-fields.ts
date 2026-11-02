// The fields that each list sorts and filters by (spec 14): every built-in field of the record
// type, then the active custom fields. Pages build them once per snapshot.
import { fits, type CustomField, type StoredValues } from '@/core/custom-fields.ts';
import { fractionDigits } from '@/core/money.ts';
import type { Company, Contact, Opportunity } from '@/core/schemas.ts';
import { sortStages, type Stage } from '@/core/stages.ts';
import { nameSort, type ListField, type ListSpec } from './list-query.ts';
import { DEFAULT_PIPELINE_VIEW } from './opportunities/pipeline.ts';
import { addressText } from './record-form.ts';

const two = (n: number) => String(n).padStart(2, '0');

// The YYYY-MM-DD date of a moment, on this device's clock: the day that "Updated" shows.
export function localDate(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

const texts = (...values: (string | null)[]) => values.filter((v): v is string => v !== null && v !== '');

function text<R>(id: string, label: string, read: (record: R) => (string | null)[], sortKey?: (record: R) => string | null): ListField<R> {
  return { id, label, kind: 'text', value: (record) => texts(...read(record)), sortKey };
}

const name = <R extends { name: string }>(): ListField<R> => text('name', 'Name', (r) => [r.name]);
const phones = <R extends { phones: string[] }>(): ListField<R> => text('phones', 'Phone', (r) => r.phones, (r) => r.phones[0] ?? null);
const address = <R extends Pick<Contact, 'address'>>(): ListField<R> => text('address', 'Address', (r) => [addressText(r.address)]);
const tags = <R extends { tags: string[] }>(): ListField<R> => text('tags', 'Tags', (r) => r.tags);
const updated = <R extends { updatedAt: string }>(): ListField<R> => ({ id: 'updated', label: 'Updated', kind: 'date', value: (r) => localDate(r.updatedAt), sortKey: (r) => r.updatedAt });

// A stored value that does not fit its field reads as none, the same as an empty one. So does a
// removed option, as on the record page.
export function customListField<R extends { customFields?: StoredValues }>(field: CustomField): ListField<R> {
  const id = `custom.${field.id}`;
  const { label } = field;
  const stored = (record: R) => {
    const value = record.customFields?.[field.id];
    return value === undefined || value === null || !fits(field, value) ? null : value;
  };
  switch (field.type) {
    case 'number':
      return { id, label, kind: 'number', value: (r) => stored(r) as number | null };
    case 'date':
      return { id, label, kind: 'date', value: (r) => stored(r) as string | null };
    case 'checkbox':
      return { id, label, kind: 'checkbox', value: (r) => stored(r) === true };
    case 'select': {
      const options = field.options.filter((o) => !o.archived);
      return { id, label, kind: 'choice', options, value: (r) => (options.some((o) => o.id === stored(r)) ? (stored(r) as string) : null) };
    }
    default:
      return text(id, label, (r) => [stored(r) as string | null]);
  }
}

const customs = <R extends { customFields?: StoredValues }>(fields: CustomField[]) => fields.map((field) => customListField<R>(field));

export function contactSpec({ companyName, custom }: { companyName: (id: string | null) => string; custom: CustomField[] }): ListSpec<Contact> {
  const fields: ListField<Contact>[] = [
    name(),
    text('jobTitle', 'Job title', (c) => [c.jobTitle]),
    text('company', 'Company', (c) => [companyName(c.companyId)]),
    text('emails', 'Email', (c) => c.emails, (c) => c.emails[0] ?? null),
    phones(),
    text('profiles', 'Profiles', (c) => c.profiles),
    address(),
    text('source', 'Source', (c) => [c.source]),
    tags(),
    updated(),
    ...customs<Contact>(custom),
  ];
  return { fields, start: nameSort, ties: ['name'] };
}

export function companySpec({ contactCount, custom }: { contactCount: (id: string) => number; custom: CustomField[] }): ListSpec<Company> {
  const fields: ListField<Company>[] = [
    name(),
    text('industry', 'Industry', (c) => [c.industry]),
    text('website', 'Website', (c) => [c.website]),
    phones(),
    address(),
    { id: 'contacts', label: 'Contacts', kind: 'number', value: (c) => contactCount(c.id) },
    tags(),
    updated(),
    ...customs<Company>(custom),
  ];
  return { fields, start: nameSort, ties: ['name'] };
}

// Value is the amount in the currency's main unit, so a sort or a filter ignores the currency.
export function opportunitySpec({ stages, companyName, contactNames, custom }: { stages: Stage[]; companyName: (id: string | null) => string; contactNames: (ids: string[]) => string[]; custom: CustomField[] }): ListSpec<Opportunity> {
  const fields: ListField<Opportunity>[] = [
    text('title', 'Opportunity', (o) => [o.title]),
    { id: 'stage', label: 'Stage', kind: 'choice', options: sortStages(stages), value: (o) => o.stageId },
    { id: 'value', label: 'Value', kind: 'number', value: (o) => (o.valueMinor === null ? null : o.valueMinor / 10 ** fractionDigits(o.currency)) },
    text('company', 'Company', (o) => [companyName(o.companyId)]),
    text('contacts', 'Contacts', (o) => contactNames(o.contactIds)),
    { id: 'expectedClose', label: 'Expected close', kind: 'date', value: (o) => o.expectedCloseDate },
    updated(),
    ...customs<Opportunity>(custom),
  ];
  return { fields, start: DEFAULT_PIPELINE_VIEW.sort, ties: ['expectedClose', 'title'] };
}
