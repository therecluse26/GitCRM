// A lead becomes a contact and a note (spec 15). Pure: the caller passes the clock.
import { isoTimestamp, newRecord } from '@/core/records.ts';
import { contactSchema, type Activity, type Contact } from '@/core/schemas.ts';
import type { Lead } from '@/inbox/inbox.ts';

export const LEAD_SOURCE = 'Lead form';
const NO_MESSAGE = 'Lead form entry with no message.';
const NEW_LEAD = 'New lead';

const validEmail = (value: string) => contactSchema.shape.emails.element.safeParse(value).success;

// A field key as a label: "how_did_you_hear" becomes "How did you hear".
const label = (key: string) => {
  const words = key.replace(/[_-]+/g, ' ').trim() || 'Field';
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// A version 4 UUID made from a SHA-256 hash, so the same lead always gets the same IDs. A second
// try after a partial failure then meets the records of the first try instead of adding new ones.
async function uuidFrom(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// These IDs must never change between releases: a changed ID would let a retry add a second contact.
export async function leadIds({ service, formId }: { service: string; formId: string }, lead: Lead): Promise<{ contactId: string; noteId: string }> {
  const [contactId, noteId] = await Promise.all(['contact', 'note'].map((kind) => uuidFrom([service, formId, lead.id, kind].join('\n'))));
  return { contactId, noteId };
}

// The fields a lead gives the contact, matched by key without case. A blank value counts as none.
function readLead(lead: Lead) {
  const filled = lead.fields.filter((f) => f.value.trim() !== '');
  const first = (key: string) => filled.find((f) => f.key.toLowerCase() === key);
  const name = first('name');
  const email = first('email');
  const goodEmail = email !== undefined && validEmail(email.value.trim()) ? email : undefined;
  return { filled, name, email, goodEmail, phone: first('phone'), message: first('message') };
}

// What the Leads table shows for a lead. The name follows the contact's: the name, else the email.
export function leadSummary(lead: Lead): { name: string; email: string; phone: string; message: string } {
  const { name, email, phone, message } = readLead(lead);
  return { name: name?.value.trim() ?? email?.value.trim() ?? NEW_LEAD, email: email?.value.trim() ?? '', phone: phone?.value.trim() ?? '', message: message?.value.trim() ?? '' };
}

export async function leadToRecords(lead: Lead, { service, formId, now }: { service: string; formId: string; now: Date }): Promise<{ contact: Contact; note: Activity }> {
  const { contactId, noteId } = await leadIds({ service, formId }, lead);
  const { filled, name, goodEmail, phone, message } = readLead(lead);

  // The fields that are not in the contact or the message go into the note, in the order they came.
  const used = new Set([name, goodEmail, phone, message]);
  const extras = filled.filter((f) => !used.has(f)).map((f) => `${label(f.key)}: ${f.value.trim()}`);
  const body = [message?.value.trim(), extras.join('\n')].filter(Boolean).join('\n\n') || NO_MESSAGE;

  const contact = newRecord(
    'contact',
    {
      name: leadSummary(lead).name,
      emails: goodEmail ? [goodEmail.value.trim()] : [],
      phones: phone ? [phone.value.trim()] : [],
      companyId: null,
      tags: [],
      source: LEAD_SOURCE,
    },
    { now, id: contactId },
  );
  const note = newRecord('activity', { kind: 'note', body, occurredAt: isoTimestamp(new Date(lead.receivedAt)), related: { type: 'contact', id: contactId } }, { now, id: noteId });
  return { contact, note };
}
