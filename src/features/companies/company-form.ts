// The company form (spec 02): form values to company fields, with an error for each bad field.
// Custom fields (spec 10) come after the built-in fields.
import { formValues, readCustomValues, type CustomField, type FormValue } from '@/core/custom-fields.ts';
import { companySchema, withScheme, type Company } from '@/core/schemas.ts';
import { addressValues, cleanList, listRows, optionalText, readAddress, splitTags, type AddressValues, type FieldErrors, type FormResult } from '../record-form.ts';

export type CompanyFields = Pick<Company, 'name' | 'industry' | 'website' | 'phones' | 'address' | 'tags' | 'customFields'>;
export type CompanyFormValues = { name: string; industry: string; website: string; phones: string[]; address: AddressValues; tags: string; custom: Record<string, FormValue> };

export function companyFields({ name, industry, website, phones, address, tags, customFields }: Company): CompanyFields {
  return { name, industry, website, phones, address, tags, customFields };
}

// `custom` holds the custom fields the form shows.
export function companyValues(fields: CompanyFields | null, custom: CustomField[] = []): CompanyFormValues {
  return {
    name: fields?.name ?? '',
    industry: fields?.industry ?? '',
    website: fields?.website ?? '',
    phones: listRows(fields?.phones ?? []),
    address: addressValues(fields?.address ?? null),
    tags: fields?.tags.join(', ') ?? '',
    custom: formValues(custom, fields?.customFields),
  };
}

// `stored` holds the custom field values the form started from.
export function readCompanyForm(values: CompanyFormValues, { custom = [], stored }: { custom?: CustomField[]; stored?: Company['customFields'] } = {}): FormResult<CompanyFields> {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!companySchema.shape.name.safeParse(name).success) errors.name = 'Enter a name.';
  const typed = values.website.trim();
  const website = typed === '' ? null : withScheme(typed);
  if (!companySchema.shape.website.safeParse(website).success) errors.website = 'Enter a web address, such as https://example.com.';
  const customFields = readCustomValues(custom, values.custom, stored);
  if (!customFields.ok) Object.assign(errors, customFields.errors);
  if (!customFields.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      name,
      industry: optionalText(values.industry),
      website,
      phones: cleanList(values.phones),
      address: readAddress(values.address),
      tags: splitTags(values.tags),
      customFields: customFields.customFields,
    },
  };
}
