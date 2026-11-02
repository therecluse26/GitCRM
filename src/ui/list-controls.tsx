// The sort headers, filter rows, and Columns menu of a record list (spec 14).
import { ArrowDown, ArrowUp, ChevronDown, Plus, X } from 'lucide-react';
import { cn } from 'cn';
import { useId, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '@/core/custom-fields.ts';
import { CONDITIONS, needsValue, nextFilterId, type Condition, type Filter, type ListField, type Sort } from '@/features/list-query.ts';
import { th } from './data-table.ts';
import { selectClassName } from './form-fields.tsx';

// A click sorts A to Z; a click on the sorted column changes the direction.
export function SortHeader({ field, label, sort, onSort }: { field: string; label: string; sort: Sort; onSort: (sort: Sort) => void }) {
  const sorted = sort.field === field;
  const Arrow = sort.direction === 'ascending' ? ArrowUp : ArrowDown;
  return (
    <th className={cn(th, 'px-0')} aria-sort={sorted ? sort.direction : undefined}>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-1 rounded-sm px-3 text-left font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => onSort({ field, direction: sorted && sort.direction === 'ascending' ? 'descending' : 'ascending' })}
      >
        {label}
        {sorted && <Arrow aria-hidden className="size-3.5" />}
      </button>
    </th>
  );
}

const conditionsOf = (field: ListField<never>) => Object.entries(CONDITIONS[field.kind]) as [Condition, string][];

// A record must match every row. A row for a field that is gone, such as a removed custom field,
// does not show; the list skips it too.
export function Filters<R>({ fields, filters, onChange }: { fields: ListField<R>[]; filters: Filter[]; onChange: (filters: Filter[]) => void }) {
  const add = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState<number | null>(null);
  const shown = filters.filter((f) => fields.some((field) => field.id === f.field));
  const change = (id: number, changes: Partial<Filter>) => onChange(filters.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  return (
    <div role="group" aria-label="Filters" className="flex flex-col gap-2">
      {shown.map((filter, index) => (
        <FilterRow
          key={filter.id}
          n={index + 1}
          filter={filter}
          fields={fields as ListField<never>[]}
          focus={filter.id === added}
          onChange={(changes) => change(filter.id, changes)}
          onRemove={() => {
            onChange(filters.filter((f) => f.id !== filter.id));
            add.current?.focus();
          }}
        />
      ))}
      <div>
        <Button
          ref={add}
          variant="outline"
          size="sm"
          onClick={() => {
            const id = nextFilterId(filters);
            const [field] = fields as ListField<never>[];
            onChange([...filters, { id, field: field.id, condition: conditionsOf(field)[0][0], value: '' }]);
            setAdded(id);
          }}
        >
          <Plus aria-hidden />
          Add filter
        </Button>
      </div>
    </div>
  );
}

function FilterRow({ n, filter, fields, focus, onChange, onRemove }: { n: number; filter: Filter; fields: ListField<never>[]; focus: boolean; onChange: (changes: Partial<Filter>) => void; onRemove: () => void }) {
  const field = fields.find((f) => f.id === filter.field)!;
  const valueName = `Filter ${n} value`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Filter ${n} field`}
        className={cn(selectClassName, 'w-auto max-w-full')}
        value={filter.field}
        autoFocus={focus}
        onChange={(e) => {
          const next = fields.find((f) => f.id === e.target.value)!;
          onChange({ field: next.id, condition: conditionsOf(next)[0][0], value: '' });
        }}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <select aria-label={`Filter ${n} condition`} className={cn(selectClassName, 'w-auto max-w-full')} value={filter.condition} onChange={(e) => onChange({ condition: e.target.value as Condition })}>
        {conditionsOf(field).map(([condition, label]) => (
          <option key={condition} value={condition}>{label}</option>
        ))}
      </select>
      {needsValue(filter.condition) &&
        (field.kind === 'choice' ? (
          <select aria-label={valueName} className={cn(selectClassName, 'w-auto max-w-full')} value={filter.value} onChange={(e) => onChange({ value: e.target.value })}>
            <option value="">Choose…</option>
            {field.options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        ) : (
          <Input
            aria-label={valueName}
            className="w-48"
            type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
            step={field.kind === 'number' ? 'any' : undefined}
            autoComplete="off"
            value={filter.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ))}
      <Button variant="ghost" size="icon" aria-label={`Remove filter ${n}`} onClick={onRemove}>
        <X aria-hidden />
      </Button>
    </div>
  );
}

// A native disclosure, so it opens with Enter or Space and needs no script for focus.
export function ColumnsMenu({ fields, shown, onChange }: { fields: CustomField[]; shown: string[]; onChange: (fieldIds: string[]) => void }) {
  const id = useId();
  if (fields.length === 0) return null;
  const toggle = (fieldId: string, on: boolean) => onChange(fields.filter((f) => (f.id === fieldId ? on : shown.includes(f.id))).map((f) => f.id));
  return (
    <details className="relative">
      <summary className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
        Columns
        <ChevronDown aria-hidden />
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex min-w-48 flex-col gap-2 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
        {fields.map((field) => (
          <div key={field.id} className="flex items-center gap-2">
            <Checkbox id={`${id}-${field.id}`} aria-labelledby={`${id}-${field.id}-label`} checked={shown.includes(field.id)} onCheckedChange={(checked) => toggle(field.id, checked === true)} />
            <Label id={`${id}-${field.id}-label`} htmlFor={`${id}-${field.id}`}>{field.label}</Label>
          </div>
        ))}
      </div>
    </details>
  );
}
