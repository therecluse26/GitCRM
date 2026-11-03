// Add a lead as a contact and a note, then remove it from the lead inbox (spec 15). The IDs come
// from the lead (lead-records.ts), so a second try after a failure meets what the first try saved.
import type { Activity, Contact, RecordType } from '@/core/schemas.ts';
import type { Lead, LeadInbox } from '@/inbox/inbox.ts';
import { ConflictError } from '@/storage/errors.ts';
import { leadToRecords } from './lead-records.ts';

// The step that failed. After 'note' the contact is saved; after 'remove' both records are.
export class AddLeadError extends Error {
  readonly step: 'contact' | 'note' | 'remove';
  readonly contactId: string;

  constructor(step: 'contact' | 'note' | 'remove', contactId: string, cause: unknown) {
    super(`Could not add the lead: the ${step} step failed`, { cause });
    this.step = step;
    this.contactId = contactId;
  }
}

export type AddLeadDeps = {
  service: string;
  formId: string;
  now: () => Date;
  exists: (type: RecordType, id: string) => boolean; // the workspace already holds this record
  create: (record: Contact | Activity) => Promise<unknown>; // saves a new record, as store.saveRecord(record, null)
  inbox: Pick<LeadInbox, 'remove'>;
};

export async function addLead(lead: Lead, { service, formId, now, exists, create, inbox }: AddLeadDeps): Promise<{ contactId: string; name: string }> {
  let records: { contact: Contact; note: Activity };
  try {
    records = await leadToRecords(lead, { service, formId, now: now() });
  } catch (error) {
    throw new AddLeadError('contact', '', error);
  }
  const { contact, note } = records;

  async function save(record: Contact | Activity, step: 'contact' | 'note') {
    if (exists(record.type, record.id)) return;
    try {
      await create(record);
    } catch (error) {
      // GitHub already holds this record, made by a first try that GitCRM did not see finish.
      if (error instanceof ConflictError && error.remote?.record.type === record.type && error.remote.record.id === record.id) return;
      throw new AddLeadError(step, contact.id, error);
    }
  }

  await save(contact, 'contact');
  await save(note, 'note');
  try {
    await inbox.remove(lead);
  } catch (error) {
    throw new AddLeadError('remove', contact.id, error);
  }
  return { contactId: contact.id, name: contact.name };
}
