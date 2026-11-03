// Add a lead as a contact and a note, then remove it from the lead inbox (spec 15).
import { describe, expect, it } from 'vitest';
import type { CRMRecord } from '@/core/schemas.ts';
import { InboxError, type Lead } from '@/inbox/inbox.ts';
import { ConflictError } from '@/storage/errors.ts';
import type { VersionedRecord } from '@/storage/workspace-repository.ts';
import { AddLeadError, addLead } from './add-lead.ts';
import { leadIds } from './lead-records.ts';

const lead: Lead = {
  id: 'a1b2c3d4e5f60718293a4b5c',
  receivedAt: '2026-11-02T15:30:00.000Z',
  fields: [
    { key: 'name', value: 'Ava Bennett' },
    { key: 'email', value: 'ava@example.com' },
    { key: 'message', value: 'Hello' },
  ],
};
const source = { service: 'formcarry', formId: 'exampleForm1' };

// A workspace and an inbox in memory. `fail` makes the named call throw once.
function setup(fail: { create?: Record<string, unknown>; remove?: unknown } = {}) {
  const log: string[] = [];
  const stored = new Map<string, CRMRecord>();
  const failures = { ...fail.create };
  const deps = {
    ...source,
    now: () => new Date('2026-11-02T20:00:00Z'),
    exists: (type: string, id: string) => stored.has(`${type}:${id}`),
    async create(record: CRMRecord) {
      log.push(`create ${record.type}`);
      const error = failures[record.type];
      if (error) {
        delete failures[record.type];
        throw error;
      }
      stored.set(`${record.type}:${record.id}`, record);
    },
    inbox: {
      async remove() {
        log.push('remove lead');
        if (fail.remove) throw fail.remove;
      },
    },
  };
  return { deps, log, stored };
}

async function failure(promise: Promise<unknown>): Promise<AddLeadError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AddLeadError);
  return error as AddLeadError;
}

describe('addLead', () => {
  it('saves the contact, then the note, then removes the lead', async () => {
    const { deps, log, stored } = setup();
    const result = await addLead(lead, deps);
    expect(log).toEqual(['create contact', 'create activity', 'remove lead']);
    expect(result.name).toBe('Ava Bennett');
    const { contactId, noteId } = await leadIds(source, lead);
    expect(result.contactId).toBe(contactId);
    expect([...stored.keys()]).toEqual([`contact:${contactId}`, `activity:${noteId}`]);
  });

  it('only removes the lead when both records are already there', async () => {
    const first = setup();
    await addLead(lead, first.deps);
    const second = setup({});
    for (const [key, record] of first.stored) second.stored.set(key, record);
    await addLead(lead, second.deps);
    expect(second.log).toEqual(['remove lead']);
  });

  it('counts a record that is already on GitHub with the same ID as saved', async () => {
    const { contactId } = await leadIds(source, lead);
    const remote = { record: { type: 'contact', id: contactId } } as unknown as VersionedRecord;
    const { deps, log } = setup({ create: { contact: new ConflictError(remote, 'The contact exists') } });
    const result = await addLead(lead, deps);
    expect(result.contactId).toBe(contactId);
    expect(log).toEqual(['create contact', 'create activity', 'remove lead']);
  });

  it('stops at the contact when it cannot be saved', async () => {
    const cause = new Error('GitHub had an error');
    const { deps, log } = setup({ create: { contact: cause } });
    const error = await failure(addLead(lead, deps));
    expect(error.step).toBe('contact');
    expect(error.cause).toBe(cause);
    expect(log).toEqual(['create contact']);
  });

  it('does not take a conflict with another record, or with no record, as saved', async () => {
    for (const remote of [null, { record: { type: 'contact', id: 'someone-else' } } as unknown as VersionedRecord]) {
      const { deps, log } = setup({ create: { contact: new ConflictError(remote, 'conflict') } });
      expect((await failure(addLead(lead, deps))).step).toBe('contact');
      expect(log).toEqual(['create contact']);
    }
  });

  it('keeps the contact and does not remove the lead when the note fails, and a second try adds only the note', async () => {
    const { deps, log, stored } = setup({ create: { activity: new Error('Could not reach GitHub') } });
    const error = await failure(addLead(lead, deps));
    expect(error.step).toBe('note');
    expect(error.contactId).toBe((await leadIds(source, lead)).contactId);
    expect(log).toEqual(['create contact', 'create activity']);
    expect(stored.size).toBe(1);

    log.length = 0;
    await addLead(lead, deps);
    expect(log).toEqual(['create activity', 'remove lead']);
    expect(stored.size).toBe(2);
  });

  it('keeps both records when the lead cannot be removed, and a second try only removes it', async () => {
    const cause = new InboxError('network', 'GitCRM could not reach Formcarry.');
    const { deps, log, stored } = setup({ remove: cause });
    const error = await failure(addLead(lead, deps));
    expect(error.step).toBe('remove');
    expect(error.cause).toBe(cause);
    expect(stored.size).toBe(2);

    log.length = 0;
    deps.inbox.remove = async () => {
      log.push('remove lead');
    };
    await addLead(lead, deps);
    expect(log).toEqual(['remove lead']);
  });
});
