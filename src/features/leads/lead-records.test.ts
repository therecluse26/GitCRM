// A lead becomes a contact and a note (spec 15).
import { describe, expect, it } from 'vitest';
import { serializeRecord } from '@/core/record-file.ts';
import { activitySchema, contactSchema } from '@/core/schemas.ts';
import type { Lead } from '@/inbox/inbox.ts';
import { leadIds, leadSummary, leadToRecords } from './lead-records.ts';

const now = new Date('2026-11-02T20:00:00Z');
const source = { service: 'formcarry', formId: 'exampleForm1' };
const lead = (fields: Record<string, string>, id = 'a1b2c3d4e5f60718293a4b5c'): Lead => ({
  id,
  receivedAt: '2026-11-02T15:30:00.123Z',
  fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
});
const convert = (fields: Record<string, string>) => leadToRecords(lead(fields), { ...source, now });

describe('leadToRecords', () => {
  it('makes a contact and a note from a full lead', async () => {
    const { contact, note } = await convert({ name: 'Ava Bennett', email: 'ava@example.com', phone: '555-0100', company: 'Northwind', message: 'Hello there' });
    expect(contact).toMatchObject({ name: 'Ava Bennett', emails: ['ava@example.com'], phones: ['555-0100'], source: 'Lead form', companyId: null, tags: [], createdAt: '2026-11-02T20:00:00Z', archivedAt: null });
    expect(note).toMatchObject({ kind: 'note', body: 'Hello there\n\nCompany: Northwind', occurredAt: '2026-11-02T15:30:00Z', related: { type: 'contact', id: contact.id } });
    // Both records pass their schemas and serialize.
    expect(() => [contactSchema.parse(contact), activitySchema.parse(note), serializeRecord(contact), serializeRecord(note)]).not.toThrow();
  });

  it('matches the keys name, email, phone, and message without case', async () => {
    const { contact, note } = await convert({ Name: 'Ava', EMAIL: 'ava@example.com', Phone: '555-0100', MESSAGE: 'Hi' });
    expect(contact).toMatchObject({ name: 'Ava', emails: ['ava@example.com'], phones: ['555-0100'] });
    expect(note.body).toBe('Hi');
  });

  it('names the contact by the email when the name is blank, and "New lead" when both are', async () => {
    expect((await convert({ name: '  ', email: 'ava@example.com' })).contact).toMatchObject({ name: 'ava@example.com', emails: ['ava@example.com'] });
    expect((await convert({ message: 'Call me' })).contact).toMatchObject({ name: 'New lead', emails: [], phones: [] });
  });

  it('keeps an email that is not valid in the note, not in the contact', async () => {
    const { contact, note } = await convert({ name: 'Ava', email: 'not-an-email', message: 'Hi' });
    expect(contact.emails).toEqual([]);
    expect(note.body).toBe('Hi\n\nEmail: not-an-email');
  });

  it('writes every other field as "Label: value", in the order they came, and skips blank values', async () => {
    const { note } = await convert({ name: 'Ava', how_did_you_hear: 'A friend', budget: '  ', 'job-title': 'Owner', message: ' Hi ' });
    expect(note.body).toBe('Hi\n\nHow did you hear: A friend\nJob title: Owner');
  });

  it('writes only the extra fields when there is no message', async () => {
    expect((await convert({ name: 'Ava', company: 'Northwind' })).note.body).toBe('Company: Northwind');
  });

  it('says so when there is no message and no other field', async () => {
    expect((await convert({ name: 'Ava', email: 'ava@example.com' })).note.body).toBe('Lead form entry with no message.');
  });

  it('uses the first field when a key comes twice, and shows the second as an extra', async () => {
    const { contact, note } = await leadToRecords(
      { id: 'x', receivedAt: '2026-11-02T15:30:00.000Z', fields: [{ key: 'name', value: 'Ava' }, { key: 'name', value: 'Ava B' }] },
      { ...source, now },
    );
    expect(contact.name).toBe('Ava');
    expect(note.body).toBe('Name: Ava B');
  });
});

describe('leadIds', () => {
  it('makes the same IDs for the same lead, so a second try meets the first', async () => {
    expect(await leadIds(source, lead({}))).toEqual(await leadIds(source, lead({ name: 'Other fields do not matter' })));
  });

  it('makes different IDs for the contact and the note, and for another lead, form, or service', async () => {
    const base = await leadIds(source, lead({}));
    expect(base.contactId).not.toBe(base.noteId);
    const others = [
      await leadIds(source, lead({}, 'another')),
      await leadIds({ ...source, formId: 'otherForm' }, lead({})),
      await leadIds({ ...source, service: 'relay' }, lead({})),
    ];
    for (const other of others) expect([other.contactId, other.noteId]).not.toContain(base.contactId);
    expect(new Set([base, ...others].flatMap((ids) => [ids.contactId, ids.noteId])).size).toBe(8);
  });

  // Pinned, and checked against Python's hashlib: a release that changed these would make a retry add
  // a second contact for a lead.
  it('keeps the IDs it made before', async () => {
    expect(await leadIds(source, lead({}))).toEqual({
      contactId: '9f4370bb-dcad-4264-9250-6d960cf4f819',
      noteId: 'aa451c7f-8b31-4260-9180-a44dcbc9d722',
    });
  });

  it('writes version 4 UUIDs that the schemas accept', async () => {
    const { contactId, noteId } = await leadIds(source, lead({}));
    for (const id of [contactId, noteId]) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('leadSummary', () => {
  it('names the lead as the contact will be named, and gives the other values as sent', () => {
    expect(leadSummary(lead({ Name: ' Ava ', email: 'not-an-email', phone: '555-0100', message: ' Hi ' }))).toEqual({ name: 'Ava', email: 'not-an-email', phone: '555-0100', message: 'Hi' });
    expect(leadSummary(lead({ email: 'ava@example.com' }))).toEqual({ name: 'ava@example.com', email: 'ava@example.com', phone: '', message: '' });
    expect(leadSummary(lead({ company: 'Northwind' })).name).toBe('New lead');
  });
});
