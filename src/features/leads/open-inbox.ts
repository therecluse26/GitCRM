// The adapter for a lead form setup. A second service is another case here (ADR-029).
import type { LeadSetup } from '@/app/lead-setup.ts';
import { createFormcarryInbox } from '@/inbox/formcarry.ts';
import type { LeadInbox } from '@/inbox/inbox.ts';

export function openInbox(setup: LeadSetup): LeadInbox {
  return createFormcarryInbox({ formId: setup.formId, key: setup.key });
}
