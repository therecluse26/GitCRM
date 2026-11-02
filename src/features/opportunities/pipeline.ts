// The pipeline (spec 03): opportunities grouped by stage, in stage order, for the board and the list.
import type { Opportunity } from '@/core/schemas.ts';
import { isTerminal, sortStages, type Stage } from '@/core/stages.ts';
import type { Filter, Sort } from '../list-query.ts';

// The sort applies to the list only; the filters to the board too (spec 14).
export type PipelineView = { layout: 'board' | 'list'; openOnly: boolean; showArchived: boolean; sort: Sort; filters: Filter[]; page: number };
export const DEFAULT_PIPELINE_VIEW: PipelineView = { layout: 'board', openOnly: false, showArchived: false, sort: { field: 'stage', direction: 'ascending' }, filters: [], page: 0 };

// `stage` is null for opportunities whose stage is not in the workspace settings.
export type PipelineColumn = { stage: Stage | null; opportunities: Opportunity[] };

const byCloseDate = (a: Opportunity, b: Opportunity) =>
  Number(a.expectedCloseDate === null) - Number(b.expectedCloseDate === null) ||
  (a.expectedCloseDate ?? '').localeCompare(b.expectedCloseDate ?? '') ||
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

export function pipelineColumns(
  opportunities: Opportunity[],
  stages: Stage[],
  { openOnly, showArchived }: Pick<PipelineView, 'openOnly' | 'showArchived'>,
): { columns: PipelineColumn[]; shown: number; hiddenArchived: number } {
  const visible = opportunities.filter((o) => showArchived || o.archivedAt === null);
  const known = new Set(stages.map((s) => s.id));
  const columns: PipelineColumn[] = sortStages(stages)
    .filter((stage) => !(openOnly && isTerminal(stage.id)))
    .map((stage) => ({ stage, opportunities: visible.filter((o) => o.stageId === stage.id).sort(byCloseDate) }));
  const unknown = visible.filter((o) => !known.has(o.stageId)).sort(byCloseDate);
  if (unknown.length > 0) columns.push({ stage: null, opportunities: unknown });
  return { columns, shown: columns.reduce((n, c) => n + c.opportunities.length, 0), hiddenArchived: opportunities.length - visible.length };
}

export function stageName(stages: Stage[], id: string): string {
  return stages.find((s) => s.id === id)?.label ?? `Unknown stage (${id})`;
}
