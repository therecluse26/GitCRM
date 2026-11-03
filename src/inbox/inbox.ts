// The lead inbox seam (spec 15, ADR-029): the service that holds leads until the owner adds or
// discards them. Each service is one adapter with this interface; the first is Formcarry.

// `fields` keep the order the form sent them. A lead carries no visitor details (IP address,
// browser, referring page, files): the adapter drops them when it reads the lead.
export type Lead = { id: string; receivedAt: string; fields: { key: string; value: string }[] };

export type InboxErrorKind = 'key' | 'scope' | 'form' | 'plan' | 'rate-limit' | 'network' | 'service';

// `message` is one sentence for the owner, in the service's own words. It never holds the key.
export class InboxError extends Error {
  readonly kind: InboxErrorKind;
  readonly waitSeconds: number | undefined;

  constructor(kind: InboxErrorKind, message: string, waitSeconds?: number) {
    super(message);
    this.kind = kind;
    this.waitSeconds = waitSeconds;
  }
}

export interface LeadInbox {
  // The key is valid, can read the form, and can delete its leads.
  check(): Promise<void>;
  // New leads, oldest first, without spam. `unreadable` counts leads the adapter skipped, and
  // `more` is true when the service holds more leads than one check reads.
  list(): Promise<{ leads: Lead[]; unreadable: number; more: boolean }>;
  // Deletes the lead from the service. It cannot be undone.
  remove(lead: Lead): Promise<void>;
}
