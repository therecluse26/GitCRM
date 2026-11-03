import { describe, expect, it } from 'vitest';
import { readLeadSetup } from './lead-setup.ts';

describe('readLeadSetup', () => {
  it('reads a setup', () => {
    expect(readLeadSetup('{"service":"formcarry","formId":"exampleForm1","key":"fc_live_abc"}')).toEqual({ service: 'formcarry', formId: 'exampleForm1', key: 'fc_live_abc' });
  });

  it('reads nothing stored, or text that is not JSON, as no setup', () => {
    for (const text of [null, '', '{', '"formcarry"', 'null', '[]']) expect(readLeadSetup(text)).toBeNull();
  });

  it('refuses a setup that is incomplete or wrong, because it came from an older copy or a hand edit', () => {
    const good = { service: 'formcarry', formId: 'exampleForm1', key: 'fc_live_abc' };
    for (const bad of [
      { ...good, service: 'other' },
      { ...good, formId: '../x' },
      { ...good, formId: 5 },
      { ...good, key: '' },
      { ...good, key: '   ' },
      { ...good, key: 'has space' },
      { ...good, key: 'x'.repeat(513) },
      { service: 'formcarry', formId: 'exampleForm1' },
    ]) {
      expect(readLeadSetup(JSON.stringify(bad))).toBeNull();
    }
  });

  it('keeps only the three known keys', () => {
    expect(readLeadSetup('{"service":"formcarry","formId":"exampleForm1","key":"k1","extra":"x"}')).toEqual({ service: 'formcarry', formId: 'exampleForm1', key: 'k1' });
  });
});
