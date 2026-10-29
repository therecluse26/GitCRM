// The workspace config that Initialize writes (docs/02-DATA-MODEL.md).
import { workspaceSchema, type WorkspaceConfig } from './schemas.ts';

const DEFAULT_STAGES = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];

export function newWorkspaceConfig(
  { name, defaultCurrency }: { name: string; defaultCurrency: string },
  { id = crypto.randomUUID() }: { id?: string } = {},
): WorkspaceConfig {
  return workspaceSchema.parse({
    schemaVersion: 1,
    workspaceId: id,
    name,
    defaultCurrency,
    pipelineStages: DEFAULT_STAGES.map((label, position) => ({ id: label.toLowerCase(), label, position })),
  });
}
