// The company form (spec 02): form values to company fields, with an error for each bad field.
import { companySchema, type Company } from '@/core/schemas.ts';
import { splitTags, type FieldErrors, type FormResult } from '../record-form.ts';

export type CompanyFields = Pick<Company, 'name' | 'website' | 'tags'>;
export type CompanyFormValues = { name: string; website: string; tags: string };

// An address without a scheme, such as northwind.example, gets https://. Any other scheme stays
// as typed, so the schema refuses javascript: and the like.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function companyFields({ name, website, tags }: Company): CompanyFields {
  return { name, website, tags };
}

export function companyValues(fields: CompanyFields | null): CompanyFormValues {
  return { name: fields?.name ?? '', website: fields?.website ?? '', tags: fields?.tags.join(', ') ?? '' };
}

export function readCompanyForm(values: CompanyFormValues): FormResult<CompanyFields> {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!companySchema.shape.name.safeParse(name).success) errors.name = 'Enter a name.';
  const typed = values.website.trim();
  const website = typed === '' ? null : HAS_SCHEME.test(typed) ? typed : `https://${typed}`;
  if (!companySchema.shape.website.safeParse(website).success) errors.website = 'Enter a web address, such as https://example.com.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, fields: { name, website, tags: splitTags(values.tags) } };
}
