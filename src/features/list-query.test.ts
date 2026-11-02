import { describe, expect, it } from 'vitest';
import { filterRecords, listRecords, matches, nextFilterId, sortRecords, type Filter, type ListField, type ListSpec, type ListView, type Sort } from './list-query.ts';

type Row = { id: string; name: string; tags: string[]; title: string | null; size: number | null; stage: string | null; closes: string | null; vip: boolean; updatedAt: string; archivedAt: string | null };

const row = (id: string, name: string, changes: Partial<Row> = {}): Row => ({ id, name, tags: [], title: null, size: null, stage: null, closes: null, vip: false, updatedAt: '2026-10-01T12:00:00Z', archivedAt: null, ...changes });

const rows: Row[] = [
  row('1', 'Zoë Ålund', { tags: ['vip'], updatedAt: '2026-10-05T12:00:00Z' }),
  row('2', 'ava Bennett', { tags: ['referral'], updatedAt: '2026-10-03T12:00:00Z' }),
  row('3', 'Ben Carter', { updatedAt: '2026-10-02T12:00:00Z', archivedAt: '2026-10-04T12:00:00Z' }),
];

const fields: ListField<Row>[] = [
  { id: 'name', label: 'Name', kind: 'text', value: (r) => [r.name] },
  { id: 'title', label: 'Title', kind: 'text', value: (r) => (r.title ? [r.title] : []) },
  { id: 'tags', label: 'Tags', kind: 'text', value: (r) => r.tags },
  { id: 'size', label: 'Size', kind: 'number', value: (r) => r.size },
  { id: 'stage', label: 'Stage', kind: 'choice', options: [{ id: 'lead', label: 'Lead' }, { id: 'won', label: 'Won' }, { id: 'old', label: 'Old' }], value: (r) => r.stage },
  { id: 'closes', label: 'Closes', kind: 'date', value: (r) => r.closes },
  { id: 'vip', label: 'VIP', kind: 'checkbox', value: (r) => r.vip },
  { id: 'updated', label: 'Updated', kind: 'date', value: (r) => r.updatedAt.slice(0, 10), sortKey: (r) => r.updatedAt },
];
const spec: ListSpec<Row> = { fields, start: { field: 'name', direction: 'ascending' }, ties: ['name'] };
const text = (r: Row) => [r.name, ...r.tags];
const view = (changes: Partial<ListView> = {}): ListView => ({ query: '', showArchived: false, sort: spec.start, filters: [], page: 0, ...changes });
const names = (list: Row[]) => list.map((r) => r.name);
const filter = (field: string, condition: Filter['condition'], value = ''): Filter => ({ id: 1, field, condition, value });
const field = (id: string) => fields.find((f) => f.id === id)!;

describe('listRecords', () => {
  it('hides archived records and counts them', () => {
    const result = listRecords(rows, view(), text, spec);
    expect(names(result.shown)).toEqual(['ava Bennett', 'Zoë Ålund']);
    expect(result.hiddenArchived).toBe(1);
  });

  it('shows archived records when asked', () => {
    expect(names(listRecords(rows, view({ showArchived: true }), text, spec).shown)).toEqual(['ava Bennett', 'Ben Carter', 'Zoë Ålund']);
  });

  it('matches every word of the query, ignoring case and accents', () => {
    expect(names(listRecords(rows, view({ query: 'ZOE alu' }), text, spec).shown)).toEqual(['Zoë Ålund']);
    expect(names(listRecords(rows, view({ query: 'referral' }), text, spec).shown)).toEqual(['ava Bennett']);
  });

  it('counts only hidden archived records that match the query and the filters', () => {
    expect(listRecords(rows, view({ query: 'ava' }), text, spec).hiddenArchived).toBe(0);
    expect(listRecords(rows, view({ query: 'ben' }), text, spec).hiddenArchived).toBe(1);
    expect(listRecords(rows, view({ filters: [filter('tags', 'empty')] }), text, spec).hiddenArchived).toBe(1);
    expect(listRecords(rows, view({ filters: [filter('tags', 'notEmpty')] }), text, spec).hiddenArchived).toBe(0);
  });

  it('sorts by most recently updated, by the full time', () => {
    const sort: Sort = { field: 'updated', direction: 'descending' };
    expect(names(listRecords(rows, view({ sort, showArchived: true }), text, spec).shown)).toEqual(['Zoë Ålund', 'ava Bennett', 'Ben Carter']);
  });

  it('uses the first sort when the sorted field is gone, for example a removed custom field', () => {
    expect(names(listRecords(rows, view({ sort: { field: 'custom.gone', direction: 'descending' } }), text, spec).shown)).toEqual(['ava Bennett', 'Zoë Ålund']);
  });
});

describe('sortRecords', () => {
  const sorted = (list: Row[], sort: Sort) => names(sortRecords(list, sort, spec));

  it('sorts text ignoring case and accents, in both directions', () => {
    const list = [row('1', 'Émile'), row('2', 'dana'), row('3', 'Carl')];
    expect(sorted(list, { field: 'name', direction: 'ascending' })).toEqual(['Carl', 'dana', 'Émile']);
    expect(sorted(list, { field: 'name', direction: 'descending' })).toEqual(['Émile', 'dana', 'Carl']);
  });

  it('puts empty values last in both directions, and breaks ties by name, then ID', () => {
    const list = [row('1', 'Cy'), row('2', 'Al', { title: 'Owner' }), row('3', 'Bo', { title: 'Buyer' }), row('5', 'Ann'), row('4', 'Ann')];
    expect(sortRecords(list, { field: 'title', direction: 'ascending' }, spec).map((r) => r.id)).toEqual(['3', '2', '4', '5', '1']);
    expect(sortRecords(list, { field: 'title', direction: 'descending' }, spec).map((r) => r.id)).toEqual(['2', '3', '4', '5', '1']);
  });

  it('sorts a list of values by all of them, joined', () => {
    const list = [row('1', 'A', { tags: ['b', 'a'] }), row('2', 'B', { tags: ['a', 'c'] }), row('3', 'C', { tags: ['a'] })];
    expect(sorted(list, { field: 'tags', direction: 'ascending' })).toEqual(['C', 'B', 'A']);
  });

  it('sorts numbers low to high, not as text', () => {
    const list = [row('1', 'A', { size: 1000 }), row('2', 'B', { size: 500 }), row('3', 'C'), row('4', 'D', { size: 0 })];
    expect(sorted(list, { field: 'size', direction: 'ascending' })).toEqual(['D', 'B', 'A', 'C']);
    expect(sorted(list, { field: 'size', direction: 'descending' })).toEqual(['A', 'B', 'D', 'C']);
  });

  it('sorts a choice in the order of its options, an unknown one after them, and none last', () => {
    const list = [row('1', 'A', { stage: 'won' }), row('2', 'B', { stage: 'gone' }), row('3', 'C'), row('4', 'D', { stage: 'lead' }), row('5', 'E', { stage: 'old' })];
    expect(sorted(list, { field: 'stage', direction: 'ascending' })).toEqual(['D', 'A', 'E', 'B', 'C']);
  });

  it('sorts dates old to new, and a checkbox No before Yes', () => {
    const list = [row('1', 'A', { closes: '2026-12-01', vip: true }), row('2', 'B', { closes: '2026-11-01' }), row('3', 'C')];
    expect(sorted(list, { field: 'closes', direction: 'ascending' })).toEqual(['B', 'A', 'C']);
    expect(sorted(list, { field: 'vip', direction: 'ascending' })).toEqual(['B', 'C', 'A']);
  });

  it('breaks ties by each tie field in turn, empty last', () => {
    const pipeline: ListSpec<Row> = { fields, start: { field: 'stage', direction: 'ascending' }, ties: ['closes', 'name'] };
    const list = [row('1', 'B', { stage: 'lead' }), row('2', 'A', { stage: 'lead', closes: '2026-12-01' }), row('3', 'C', { stage: 'lead', closes: '2026-11-01' }), row('4', 'A', { stage: 'lead' })];
    expect(names(sortRecords(list, pipeline.start, pipeline))).toEqual(['C', 'A', 'A', 'B']);
  });

  it('does not change the list it gets', () => {
    const list = [row('1', 'B'), row('2', 'A')];
    sortRecords(list, spec.start, spec);
    expect(names(list)).toEqual(['B', 'A']);
  });
});

describe('matches', () => {
  it('matches text that contains or is the value, ignoring case and accents and spaces around it', () => {
    const r = row('1', 'Zoë Ålund', { tags: ['vip', 'Referral'] });
    expect(matches(field('name'), filter('name', 'contains', ' zoe '), r)).toBe(true);
    expect(matches(field('name'), filter('name', 'contains', 'ben'), r)).toBe(false);
    expect(matches(field('name'), filter('name', 'is', 'zoe alund'), r)).toBe(true);
    expect(matches(field('name'), filter('name', 'is', 'zoe'), r)).toBe(false);
  });

  it('matches a list when one value matches', () => {
    const r = row('1', 'A', { tags: ['vip', 'Referral'] });
    expect(matches(field('tags'), filter('tags', 'is', 'referral'), r)).toBe(true);
    expect(matches(field('tags'), filter('tags', 'contains', 'ref'), r)).toBe(true);
    expect(matches(field('tags'), filter('tags', 'is', 'ref'), r)).toBe(false);
  });

  it('matches empty and not empty', () => {
    expect(matches(field('title'), filter('title', 'empty'), row('1', 'A'))).toBe(true);
    expect(matches(field('title'), filter('title', 'notEmpty'), row('1', 'A'))).toBe(false);
    expect(matches(field('tags'), filter('tags', 'empty'), row('1', 'A'))).toBe(true);
    expect(matches(field('size'), filter('size', 'empty'), row('1', 'A', { size: 0 }))).toBe(false);
    expect(matches(field('stage'), filter('stage', 'empty'), row('1', 'A'))).toBe(true);
    expect(matches(field('closes'), filter('closes', 'notEmpty'), row('1', 'A', { closes: '2026-11-01' }))).toBe(true);
  });

  it('matches a choice that is, or is not, the value; none is not the value', () => {
    expect(matches(field('stage'), filter('stage', 'is', 'lead'), row('1', 'A', { stage: 'lead' }))).toBe(true);
    expect(matches(field('stage'), filter('stage', 'isNot', 'lead'), row('1', 'A', { stage: 'lead' }))).toBe(false);
    expect(matches(field('stage'), filter('stage', 'isNot', 'lead'), row('1', 'A'))).toBe(true);
  });

  it('compares numbers; no value matches no comparison', () => {
    const r = row('1', 'A', { size: 1000 });
    expect(matches(field('size'), filter('size', 'is', '1000'), r)).toBe(true);
    expect(matches(field('size'), filter('size', 'atLeast', '1000'), r)).toBe(true);
    expect(matches(field('size'), filter('size', 'atLeast', '1000.5'), r)).toBe(false);
    expect(matches(field('size'), filter('size', 'atMost', '999'), r)).toBe(false);
    expect(matches(field('size'), filter('size', 'atMost', '999'), row('2', 'B'))).toBe(false);
  });

  it('compares dates, including the day itself', () => {
    const r = row('1', 'A', { closes: '2026-11-10' });
    expect(matches(field('closes'), filter('closes', 'is', '2026-11-10'), r)).toBe(true);
    expect(matches(field('closes'), filter('closes', 'onOrBefore', '2026-11-10'), r)).toBe(true);
    expect(matches(field('closes'), filter('closes', 'onOrBefore', '2026-11-09'), r)).toBe(false);
    expect(matches(field('closes'), filter('closes', 'onOrAfter', '2026-11-10'), r)).toBe(true);
    expect(matches(field('closes'), filter('closes', 'onOrAfter', '2026-11-10'), row('2', 'B'))).toBe(false);
  });

  it('matches a checkbox that is checked, or not', () => {
    expect(matches(field('vip'), filter('vip', 'checked'), row('1', 'A', { vip: true }))).toBe(true);
    expect(matches(field('vip'), filter('vip', 'notChecked'), row('1', 'A', { vip: true }))).toBe(false);
    expect(matches(field('vip'), filter('vip', 'notChecked'), row('1', 'A'))).toBe(true);
  });
});

describe('filterRecords', () => {
  const list = [row('1', 'Ava', { tags: ['vip'] }), row('2', 'Ben', { tags: ['vip'], title: 'Buyer' }), row('3', 'Cy')];

  it('keeps the records that match every filter', () => {
    expect(names(filterRecords(list, [filter('tags', 'contains', 'vip'), { ...filter('title', 'empty'), id: 2 }], fields))).toEqual(['Ava']);
  });

  it('skips a filter that needs a value and has none, or has a value that is not a number or a date', () => {
    expect(filterRecords(list, [filter('name', 'contains', '  ')], fields)).toHaveLength(3);
    expect(filterRecords(list, [filter('size', 'atLeast', 'many')], fields)).toHaveLength(3);
    expect(filterRecords(list, [filter('closes', 'is', '2026-13-01')], fields)).toHaveLength(3);
    expect(filterRecords(list, [filter('stage', 'is', '')], fields)).toHaveLength(3);
  });

  it('skips a filter whose field is gone', () => {
    expect(filterRecords(list, [filter('custom.gone', 'empty')], fields)).toHaveLength(3);
  });

  it('skips a condition that the field kind does not have', () => {
    expect(filterRecords(list, [filter('name', 'checked')], fields)).toHaveLength(3);
  });
});

describe('nextFilterId', () => {
  it('counts on from the highest ID', () => {
    expect(nextFilterId([])).toBe(1);
    expect(nextFilterId([{ ...filter('name', 'contains'), id: 4 }, { ...filter('name', 'contains'), id: 2 }])).toBe(5);
  });
});
