// Record and workspace schemas, version 1 (docs/02-DATA-MODEL.md).
// Key order in each schema is the canonical key order of the JSON files.
import { z } from 'zod';

export const RECORD_TYPES = ['contact', 'company', 'opportunity', 'task', 'activity'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

const uuid = z.uuidv4().regex(/^[0-9a-f-]+$/, 'Use lowercase hex');
const timestamp = z.iso.datetime(); // UTC only: an offset such as +01:00 is invalid
const calendarDate = z.iso.date();
const nonBlank = z.string().refine((s) => s.trim().length > 0, 'Must not be blank');
// Stage and custom field IDs: lowercase, never changed after creation (ADR-019, ADR-020).
const slugId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const currency = z.string().regex(/^[A-Z]{3}$/, 'Use an ISO 4217 code such as USD');
const website = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });
// Reserved for typed custom fields (ADR-020): kept unchanged on save, no UI in the MVP.
const customFields = z.record(slugId, z.union([z.string(), z.number(), z.boolean(), z.null()])).optional();
const related = z.strictObject({ type: z.enum(['contact', 'company', 'opportunity']), id: uuid }).nullable();

const lifecycle = {
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: timestamp.nullable(),
};

export const contactSchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('contact'),
  id: uuid,
  name: nonBlank,
  emails: z.array(z.email()),
  phones: z.array(nonBlank),
  companyId: uuid.nullable(),
  tags: z.array(nonBlank),
  customFields,
  ...lifecycle,
});

export const companySchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('company'),
  id: uuid,
  name: nonBlank,
  website: website.nullable(),
  tags: z.array(nonBlank),
  customFields,
  ...lifecycle,
});

export const opportunitySchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('opportunity'),
  id: uuid,
  title: nonBlank,
  stageId: slugId,
  companyId: uuid.nullable(),
  contactIds: z.array(uuid),
  valueMinor: z.int().nonnegative().nullable(),
  currency,
  expectedCloseDate: calendarDate.nullable(),
  customFields,
  ...lifecycle,
});

export const taskSchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('task'),
  id: uuid,
  title: nonBlank,
  description: z.string(),
  dueDate: calendarDate.nullable(),
  completedAt: timestamp.nullable(),
  related,
  ...lifecycle,
});

export const activitySchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('activity'),
  id: uuid,
  kind: z.enum(['note', 'call', 'meeting', 'email_manual']),
  body: nonBlank,
  occurredAt: timestamp,
  related,
  ...lifecycle,
});

export const recordSchemas = {
  contact: contactSchema,
  company: companySchema,
  opportunity: opportunitySchema,
  task: taskSchema,
  activity: activitySchema,
} as const;

export type Contact = z.infer<typeof contactSchema>;
export type Company = z.infer<typeof companySchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type Task = z.infer<typeof taskSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type CRMRecord = Contact | Company | Opportunity | Task | Activity;
export type RecordOf<T extends RecordType> = Extract<CRMRecord, { type: T }>;

const stage = z.strictObject({ id: slugId, label: nonBlank, position: z.int().nonnegative() });

export const workspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaceId: uuid,
  name: nonBlank,
  defaultCurrency: currency,
  pipelineStages: z.array(stage).superRefine((stages, ctx) => {
    const ids = stages.map((s) => s.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Stage IDs must be unique' });
    if (new Set(stages.map((s) => s.position)).size !== stages.length) ctx.addIssue({ code: 'custom', message: 'Stage positions must be unique' });
    for (const terminal of ['won', 'lost']) {
      if (!ids.includes(terminal)) ctx.addIssue({ code: 'custom', message: `A "${terminal}" stage must exist` });
    }
  }),
});

export type WorkspaceConfig = z.infer<typeof workspaceSchema>;
