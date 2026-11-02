import { describe, expect, it } from 'vitest';
import { NO_COLUMNS, readColumns } from './columns.ts';

describe('readColumns', () => {
  it('reads the field IDs of each list', () => {
    expect(readColumns('{"contact":["newsletter"],"company":[],"opportunity":["budget","owner"]}')).toEqual({ contact: ['newsletter'], company: [], opportunity: ['budget', 'owner'] });
  });

  it('reads nothing stored, or text that is not JSON, as no columns', () => {
    expect(readColumns(null)).toEqual(NO_COLUMNS);
    expect(readColumns('{')).toEqual(NO_COLUMNS);
    expect(readColumns('"contact"')).toEqual(NO_COLUMNS);
  });

  it('keeps only IDs, once each, and a list that is missing is empty', () => {
    expect(readColumns('{"contact":["a",1,null,"a","b"],"company":"a"}')).toEqual({ contact: ['a', 'b'], company: [], opportunity: [] });
  });
});
