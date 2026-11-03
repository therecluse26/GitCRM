// The lead form setup of this device (spec 15, ADR-029): the service, the form ID, and the owner's
// key. The key is a secret, so the store keeps it here only while the connection is remembered,
// under the PAT's rule (ADR-017). Disconnect removes it.
import { isFormId } from '@/inbox/form-id.ts';

const KEY = 'gitcrm.leads';

export type LeadSetup = { service: 'formcarry'; formId: string; key: string };

// The stored text can come from an older copy or a hand edit: anything but a whole setup is none.
export function readLeadSetup(text: string | null): LeadSetup | null {
  let value: unknown;
  try {
    value = JSON.parse(text ?? 'null');
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { service, formId, key } = value as Record<string, unknown>;
  if (service !== 'formcarry' || typeof formId !== 'string' || !isFormId(formId)) return null;
  if (typeof key !== 'string' || key.length === 0 || key.length > 512 || /\s/.test(key)) return null;
  return { service, formId, key };
}

export function storedLeadSetup(): LeadSetup | null {
  try {
    return readLeadSetup(localStorage.getItem(KEY));
  } catch {
    return null; // blocked storage
  }
}

export function storeLeadSetup(setup: LeadSetup | null): void {
  try {
    if (setup === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(setup));
  } catch {
    // Blocked storage: the setup lasts until the page reloads.
  }
}

export function forgetLeadSetup(): void {
  storeLeadSetup(null);
}
