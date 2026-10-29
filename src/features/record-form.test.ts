import { describe, expect, it } from 'vitest';
import { changedFields, cleanList, conflictRows, rebaseFields, splitTags } from './record-form.ts';

describe('splitTags', () => {
  it('splits on commas, trims, and drops empty and repeated tags', () => {
    expect(splitTags(' referral, VIP,, vip ,partner ')).toEqual(['referral', 'VIP', 'partner']);
  });

  it('returns no tags for blank text', () => {
    expect(splitTags('  ')).toEqual([]);
  });
});

describe('cleanList', () => {
  it('trims each value and drops empty rows', () => {
    expect(cleanList([' ava@example.test ', '', '  '])).toEqual(['ava@example.test']);
  });
});

const base = { name: 'Ava Bennett', emails: ['ava@example.test'], phones: [] as string[] };

describe('changedFields', () => {
  it('returns only the fields that differ, comparing lists by value', () => {
    expect(changedFields({ ...base, emails: ['ava@example.test'], phones: ['555-0100'] }, base)).toEqual({ phones: ['555-0100'] });
  });
});

describe('rebaseFields', () => {
  it("puts my changes on top of the remote version and keeps the remote's other changes", () => {
    const mine = { ...base, phones: ['555-0100'] };
    const remote = { ...base, emails: ['ava@studio.test'] };
    expect(rebaseFields(mine, base, remote)).toEqual({ name: 'Ava Bennett', emails: ['ava@studio.test'], phones: ['555-0100'] });
  });
});

describe('conflictRows', () => {
  it('lists each field that I or the remote changed', () => {
    const mine = { ...base, name: 'Ava B.', phones: ['555-0100'] };
    const remote = { ...base, name: 'Ava Bennett-Park', emails: ['ava@studio.test'] };
    expect(conflictRows(mine, base, remote)).toEqual([
      { key: 'name', mine: 'Ava B.', remote: 'Ava Bennett-Park', changedByMe: true, changedRemotely: true },
      { key: 'emails', mine: ['ava@example.test'], remote: ['ava@studio.test'], changedByMe: false, changedRemotely: true },
      { key: 'phones', mine: ['555-0100'], remote: [], changedByMe: true, changedRemotely: false },
    ]);
  });
});
