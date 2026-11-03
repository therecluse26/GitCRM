// The helpers of the public lead form page (spec 15).
import { describe, expect, it } from 'vitest';
import { FORM_ID as appFormId } from '@/inbox/form-id.ts';
import { FORM_ID, formIdFromHash, validate } from './lead-form.ts';

describe('FORM_ID', () => {
  // The page carries no GitCRM code, so it has its own copy of the rule. This keeps the two equal.
  it('is the same rule the app uses', () => {
    expect(FORM_ID.source).toBe(appFormId.source);
  });
});

describe('formIdFromHash', () => {
  it('reads the form ID from the hash', () => {
    expect(formIdFromHash('#form=exampleForm1')).toBe('exampleForm1');
    expect(formIdFromHash('#other=1&form=abcd_-12')).toBe('abcd_-12');
  });

  it('reads no form ID from a missing, short, long, or odd one', () => {
    for (const hash of ['', '#', '#form=', '#form=abc', `#form=${'x'.repeat(65)}`, '#form=%3Cscript%3E', '#form=a/b/c/d', '#form=../x/y/z', '#form=ab cd', '#form=exampleForm1%00']) {
      expect(formIdFromHash(hash)).toBeNull();
    }
  });
});

describe('validate', () => {
  it('needs a name and an email that looks like one', () => {
    expect(validate({ name: 'Ava', email: 'ava@example.com' })).toEqual({});
    expect(validate({ name: '  ', email: '' })).toEqual({ name: 'Enter your name.', email: 'Enter your email address.' });
    for (const email of ['ava', 'ava@', '@example.com', 'ava@example', 'a va@example.com']) {
      expect(validate({ name: 'Ava', email })).toEqual({ email: 'Enter a valid email address, such as ava@example.com.' });
    }
  });
});
