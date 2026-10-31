import { describe, expect, it } from 'vitest';
import { dataDictionary, FIELD_NOTES, jsonSchemas } from './data-dictionary.ts';
import type { ExportSource } from './export.ts';
import { newRecord } from './records.ts';
import { RECORD_TYPES, recordSchemas, workspaceSchema } from './schemas.ts';
import { newWorkspaceConfig } from './workspace.ts';

const now = new Date('2026-10-29T12:00:00Z');
const exportedAt = new Date('2026-10-30T22:58:40.123Z');
const config = newWorkspaceConfig({ name: 'Example Studio', defaultCurrency: 'USD' });
const contact = (name: string, archivedAt: string | null = null) => ({ ...newRecord('contact', { name, emails: [], phones: [], companyId: null, tags: [] }, { now }), archivedAt });
const source: ExportSource = {
  repository: 'octo-dev/crm',
  branch: 'main',
  commitSha: 'c0ffee'.padEnd(40, '0'),
  config,
  records: [contact('Ava Bennett'), contact('Zoë Ålund', '2026-10-30T09:00:00Z')],
  files: [],
};

describe('dataDictionary', () => {
  it('describes every field of every record type, in the order of the JSON files', () => {
    for (const type of RECORD_TYPES) expect(Object.keys(FIELD_NOTES[type]), type).toEqual(Object.keys(recordSchemas[type].shape));
    for (const notes of Object.values(FIELD_NOTES)) for (const note of Object.values(notes)) expect(note).toMatch(/\.$/);
  });

  it('gives the repository, the commit, the export time in UTC, the schema version, the counts, and the stages', () => {
    const text = dataDictionary(source, exportedAt);
    expect(text).toMatch(/^# GitCRM export: Example Studio\n/);
    expect(text).toContain('| Repository | octo-dev/crm, branch main |');
    expect(text).toContain(`| Commit | ${source.commitSha} |`);
    expect(text).toContain('| Exported | 2026-10-30T22:58:40Z (UTC) |');
    expect(text).toContain('| Schema version | 1 |');
    expect(text).toContain('| Contacts | 2 | 1 | `data/contacts/` | `contacts.csv` |');
    expect(text).toContain('| Activities | 0 | 0 | `data/activities/` | `activities.csv` |');
    expect(text).toContain('| `proposal` | Proposal | 2 |');
  });

  it('says when the commit is not known', () => {
    expect(dataDictionary({ ...source, commitSha: null }, exportedAt)).toContain('| Commit | Not known: this browser saved changes after it last read the branch |');
  });

  it('gives the CSV columns of each field, and the CSV rules', () => {
    const text = dataDictionary(source, exportedAt);
    expect(text).toContain('| `related` | `relatedType`, `relatedId` |');
    expect(text).toContain('| `emails` | `emails` |');
    expect(text).toContain('| (none) | `stageLabel` |');
    expect(text).toContain('## CSV rules');
    expect(text).toContain('remove that one `\'`');
  });

  it('escapes a "|" and a line break in a workspace name or a stage label, so the tables stay whole', () => {
    const odd = { ...config, name: 'A | B', pipelineStages: config.pipelineStages.map((s) => (s.id === 'lead' ? { ...s, label: 'New | cold\nlead' } : s)) };
    const text = dataDictionary({ ...source, config: odd }, exportedAt);
    expect(text).toContain('# GitCRM export: A \\| B\n');
    expect(text).toContain('| `lead` | New \\| cold lead | 0 |');
  });
});

describe('jsonSchemas', () => {
  it('gives a JSON Schema for each record type and for the workspace file', () => {
    const schemas = jsonSchemas();
    expect(Object.keys(schemas)).toEqual([...RECORD_TYPES, 'workspace'].map((name) => `schemas/${name}.schema.json`));
    for (const [type, schema] of [...RECORD_TYPES.map((t) => [t, recordSchemas[t]] as const), ['workspace', workspaceSchema] as const]) {
      const json = JSON.parse(schemas[`schemas/${type}.schema.json`]);
      expect(json, type).toMatchObject({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false });
      expect(Object.keys(json.properties), type).toEqual(Object.keys(schema.shape));
    }
  });
});
