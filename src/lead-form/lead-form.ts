// The helpers of the public lead form page (spec 15). The page carries no GitCRM code, and this
// file imports none: the build audit needs the page to be one self-contained file.
export const FORM_ID = /^[A-Za-z0-9_-]{4,64}$/;
export const ENDPOINT = 'https://formcarry.com/s/';

// The page address is `lead.html#form=<form ID>`. Anything else is not a form.
export function formIdFromHash(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('form');
  return id !== null && FORM_ID.test(id) ? id : null;
}

export function validate({ name, email }: { name: string; email: string }): { name?: string; email?: string } {
  const errors: { name?: string; email?: string } = {};
  if (name.trim() === '') errors.name = 'Enter your name.';
  if (email.trim() === '') errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address, such as ava@example.com.';
  return errors;
}
