// A form ID goes into a web address, so only these characters are allowed (spec 15). The public
// form page keeps its own copy (src/lead-form/lead-form.ts), because it must not carry GitCRM code.
// A test keeps the two equal.
export const FORM_ID = /^[A-Za-z0-9_-]{4,64}$/;
export const isFormId = (value: string) => FORM_ID.test(value);
