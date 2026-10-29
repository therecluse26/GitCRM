// The pipeline (spec 03): a board with a column per stage, and a list view for keyboard users and
// narrow screens. Each opportunity has a Move to stage menu; on the board, drag and drop works too.
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useId, type DragEvent } from 'react';
import { selectCanWrite, selectReadOnly, useApp } from '@/app/store.ts';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/core/money.ts';
import type { Opportunity } from '@/core/schemas.ts';
import { isTerminal, type Stage } from '@/core/stages.ts';
import type { VersionedRecord } from '@/storage/workspace-repository.ts';
import { selectClassName } from '@/ui/form-fields.tsx';
import { linkButton } from '@/ui/link-button.ts';
import { ArchivedBadge, ListSummary, Problem } from '@/ui/record-page.tsx';
import { formatCalendarDate, useRecords, useStages } from '../records.ts';
import { pipelineColumns, stageName, type PipelineColumn } from './pipeline.ts';
import { useStageMove } from './use-stage-move.ts';

// Only GitCRM's own columns accept the drag, and the drag carries an ID, never record data.
const DRAG_TYPE = 'application/x-gitcrm-opportunity';

type Move = ReturnType<typeof useStageMove>;

export function PipelinePage() {
  const stages = useStages();
  const view = useApp((s) => s.pipeline);
  const readOnly = useApp(selectReadOnly);
  const saved = useRecords('opportunity');
  const companies = useRecords('company');
  const contacts = useRecords('contact');
  const moves = useStageMove();
  // A pending move shows the card in its new stage until the commit lands.
  const shownRecords = saved.map(({ record }) => (record.id === moves.pending?.id ? { ...record, stageId: moves.pending.stageId } : record));
  const { columns, shown, hiddenArchived } = pipelineColumns(shownRecords, stages, view);
  const companyName = (id: string | null) => (id && companies.find((c) => c.record.id === id)?.record.name) || '';
  // The first contact by name, and how many more; a missing contact is left out.
  const contactNames = (ids: string[]) => {
    const names = ids.flatMap((id) => contacts.find((c) => c.record.id === id)?.record.name ?? []);
    return names.length > 1 ? `${names[0]} and ${names.length - 1} more` : (names[0] ?? '');
  };
  const card: CardProps = { stages, companyName, contactNames, moves, versionOf: (id) => saved.find((v) => v.record.id === id) };
  const set = useApp.getState().setPipelineView;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        {!readOnly && (
          <Link to="/opportunities/new" className={linkButton()}>
            <Plus aria-hidden />
            New opportunity
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pipeline-layout">View</Label>
          <select id="pipeline-layout" className={selectClassName} value={view.layout} onChange={(e) => set({ layout: e.target.value as typeof view.layout })}>
            <option value="board">Board</option>
            <option value="list">List</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pipeline-show">Show</Label>
          <select id="pipeline-show" className={selectClassName} value={view.openOnly ? 'open' : 'all'} onChange={(e) => set({ openOnly: e.target.value === 'open' })}>
            <option value="all">All stages</option>
            <option value="open">Open only</option>
          </select>
        </div>
        <div className="flex h-8 items-center gap-2">
          <Checkbox id="pipeline-archived" aria-labelledby="pipeline-archived-label" checked={view.showArchived} onCheckedChange={(checked) => set({ showArchived: checked === true })} />
          <Label id="pipeline-archived-label" htmlFor="pipeline-archived">Show archived</Label>
        </div>
      </div>
      <ListSummary shown={shown} hiddenArchived={hiddenArchived} singular="opportunity" plural="opportunities" />
      {moves.message && <Problem>{moves.message}</Problem>}
      {view.layout === 'board' ? <Board columns={columns} card={card} /> : <OpportunityTable columns={columns} card={card} />}
    </>
  );
}

type CardProps = {
  stages: Stage[];
  companyName: (id: string | null) => string;
  contactNames: (ids: string[]) => string;
  moves: Move;
  versionOf: (id: string) => VersionedRecord<Opportunity> | undefined;
};

function Board({ columns, card }: { columns: PipelineColumn[]; card: CardProps }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {columns.map((column) => (
        <Column key={column.stage?.id ?? '?'} column={column} card={card} />
      ))}
    </div>
  );
}

function Column({ column, card }: { column: PipelineColumn; card: CardProps }) {
  const headingId = useId();
  const canWrite = useApp(selectCanWrite);
  const { stage, opportunities } = column;
  // Won and Lost differ by border and by the word "Closed", not by color alone (docs/08).
  const closed = stage !== null && isTerminal(stage.id);
  const accepts = (event: DragEvent) => canWrite && stage !== null && event.dataTransfer.types.includes(DRAG_TYPE);

  return (
    <section
      aria-labelledby={headingId}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg p-2 ${closed ? 'border border-dashed' : 'bg-muted/50'}`}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        // A drag from another GitCRM tab can carry an ID this workspace does not have.
        const dragged = card.versionOf(event.dataTransfer.getData(DRAG_TYPE));
        if (dragged) void card.moves.move(dragged, stage!.id);
      }}
    >
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 id={headingId} className="font-medium break-words">{stage?.label ?? 'Unknown stage'}</h2>
        <span className="text-sm text-muted-foreground">
          {closed && 'Closed · '}
          {opportunities.length}
        </span>
      </div>
      {stage === null && <p className="px-1 text-sm text-muted-foreground">These stages are not in the workspace settings. Move each opportunity to a stage.</p>}
      <ul className="flex flex-col gap-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} card={card} />
        ))}
      </ul>
    </section>
  );
}

function OpportunityCard({ opportunity, card }: { opportunity: Opportunity; card: CardProps }) {
  const canWrite = useApp(selectCanWrite);
  const pending = card.moves.pending?.id === opportunity.id;
  const details = [card.companyName(opportunity.companyId), card.contactNames(opportunity.contactIds), opportunity.valueMinor !== null && formatMoney(opportunity.valueMinor, opportunity.currency)].filter(Boolean);
  return (
    <li
      draggable={canWrite}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, opportunity.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className="flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-sm shadow-xs"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Link to="/opportunities/$opportunityId" params={{ opportunityId: opportunity.id }} className="font-medium break-words hover:underline">
          {opportunity.title}
        </Link>
        {opportunity.archivedAt && <ArchivedBadge />}
      </span>
      {details.length > 0 && <span className="break-words text-muted-foreground">{details.join(' · ')}</span>}
      {opportunity.expectedCloseDate && <span className="text-muted-foreground">Closes {formatCalendarDate(opportunity.expectedCloseDate)}</span>}
      <StageMenu opportunity={opportunity} card={card} />
      {pending && <span role="status">Moving…</span>}
    </li>
  );
}

// The keyboard path for a move (spec 03): a native select works without a mouse.
function StageMenu({ opportunity, card }: { opportunity: Opportunity; card: CardProps }) {
  const canWrite = useApp(selectCanWrite);
  const known = card.stages.some((s) => s.id === opportunity.stageId);
  return (
    <select
      aria-label={`Move ${opportunity.title} to stage`}
      className={selectClassName}
      value={opportunity.stageId}
      disabled={!canWrite}
      onChange={(e) => {
        const saved = card.versionOf(opportunity.id);
        if (saved) void card.moves.move(saved, e.target.value);
      }}
    >
      {!known && (
        <option value={opportunity.stageId} disabled>
          {stageName(card.stages, opportunity.stageId)}
        </option>
      )}
      {card.stages.map((stage) => (
        <option key={stage.id} value={stage.id}>{stage.label}</option>
      ))}
    </select>
  );
}

function OpportunityTable({ columns, card }: { columns: PipelineColumn[]; card: CardProps }) {
  const rows = columns.flatMap((column) => column.opportunities);
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table aria-label="Opportunities" className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="p-2 font-medium">Opportunity</th>
            <th className="p-2 font-medium">Stage</th>
            <th className="p-2 font-medium">Value</th>
            <th className="p-2 font-medium">Company</th>
            <th className="p-2 font-medium">Contacts</th>
            <th className="p-2 font-medium">Expected close</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((opportunity) => (
            <tr key={opportunity.id} className="border-b align-top">
              <td className="p-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Link to="/opportunities/$opportunityId" params={{ opportunityId: opportunity.id }} className="font-medium hover:underline">
                    {opportunity.title}
                  </Link>
                  {opportunity.archivedAt && <ArchivedBadge />}
                  {card.moves.pending?.id === opportunity.id && <span role="status">Moving…</span>}
                </span>
              </td>
              <td className="min-w-40 p-2">
                <StageMenu opportunity={opportunity} card={card} />
              </td>
              <td className="p-2 whitespace-nowrap">{opportunity.valueMinor !== null ? formatMoney(opportunity.valueMinor, opportunity.currency) : ''}</td>
              <td className="p-2">{card.companyName(opportunity.companyId)}</td>
              <td className="p-2">{card.contactNames(opportunity.contactIds)}</td>
              <td className="p-2 whitespace-nowrap">{opportunity.expectedCloseDate ? formatCalendarDate(opportunity.expectedCloseDate) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
