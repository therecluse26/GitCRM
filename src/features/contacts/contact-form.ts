// The contact form (spec 02): form values to contact fields, with an error for each bad field.
// Custom fields (spec 10) come after the built-in fields.
import { formValues, readCustomValues, type CustomField, type FormValue } from '@/core/custom-fields.ts';
import { contactSchema, type Contact } from '@/core/schemas.ts';
import {
  addressValues,
  cleanList,
  listRows,
  optionalText,
  readAddress,
  readWebAddresses,
  splitTags,
  type AddressValues,
  type FieldErrors,
  type FormResult,
} from '../record-form.ts';

export type ContactFields = Pick<Contact, 'name' | 'jobTitle' | 'emails' | 'phones' | 'profiles' | 'address' | 'companyId' | 'source' | 'tags' | 'customFields'>;
export type ContactFormValues = {
  name: string;
  jobTitle: string;
  emails: string[];
  phones: string[];
  profiles: string[];
  address: AddressValues;
  companyId: string;
  source: string;
  tags: string;
  custom: Record<string, FormValue>;
};

export function contactFields({ name, jobTitle, emails, phones, profiles, address, companyId, source, tags, customFields }: Contact): ContactFields {
  return { name, jobTitle, emails, phones, profiles, address, companyId, source, tags, customFields };
}

// `custom` holds the custom fields the form shows.
export function contactValues(fields: ContactFields | null, custom: CustomField[] = []): ContactFormValues {
  return {
    name: fields?.name ?? '',
    jobTitle: fields?.jobTitle ?? '',
    emails: listRows(fields?.emails ?? []),
    phones: listRows(fields?.phones ?? []),
    profiles: listRows(fields?.profiles ?? []),
    address: addressValues(fields?.address ?? null),
    companyId: fields?.companyId ?? '',
    source: fields?.source ?? '',
    tags: fields?.tags.join(', ') ?? '',
    custom: formValues(custom, fields?.customFields),
  };
}

// `companies` holds the IDs a contact may link to. The contact's current link may stay, even to a
// missing company, so that an unrelated edit still saves. `stored` holds the custom field values
// the form started from.
export function readContactForm(
  values: ContactFormValues,
  { companies, currentCompanyId, custom = [], stored }: { companies: ReadonlySet<string>; currentCompanyId: string | null; custom?: CustomField[]; stored?: Contact['customFields'] },
): FormResult<ContactFields> {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!contactSchema.shape.name.safeParse(name).success) errors.name = 'Enter a name.';
  values.emails.forEach((email, i) => {
    if (email.trim() && !contactSchema.shape.emails.element.safeParse(email.trim()).success) {
      errors[`emails.${i}`] = 'Enter a valid email address, such as ava@example.com.';
    }
  });
  const profiles = readWebAddresses('profiles', values.profiles, errors, 'Enter a web address, such as https://example.com/ava.');
  const companyId = values.companyId || null;
  if (companyId && companyId !== currentCompanyId && !companies.has(companyId)) errors.companyId = 'Choose a company from the list.';
  const customFields = readCustomValues(custom, values.custom, stored);
  if (!customFields.ok) Object.assign(errors, customFields.errors);
  if (!customFields.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      name,
      jobTitle: optionalText(values.jobTitle),
      emails: cleanList(values.emails),
      phones: cleanList(values.phones),
      profiles,
      address: readAddress(values.address),
      companyId,
      source: optionalText(values.source),
      tags: splitTags(values.tags),
      customFields: customFields.customFields,
    },
  };
}

// Duplicates are allowed (spec 02); the form only warns about an exact email match, ignoring case.
export function duplicateEmails(emails: string[], contacts: Contact[], selfId: string | null): { email: string; contact: Contact }[] {
  return cleanList(emails).flatMap((email) => {
    const contact = contacts.find((c) => c.id !== selfId && c.emails.some((e) => e.toLowerCase() === email.toLowerCase()));
    return contact ? [{ email, contact }] : [];
  });
}
