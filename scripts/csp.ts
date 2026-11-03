// The Content Security Policy of the built app (ADR-010, docs/07). Vite puts it in a <meta> tag,
// and the build audit checks it. A <meta> policy cannot set frame-ancestors: the host sends that
// header, and the app refuses to run inside a frame.
export const CSP_DIRECTIVES: [directive: string, value: string][] = [
  ['default-src', "'none'"], // anything not listed here: frames, workers, objects, media, images
  ['script-src', "'self'"], // the app's own bundle only: no inline script, no eval
  ['style-src', "'self'"],
  ['font-src', "'self'"], // the bundled IBM Plex font files
  ['connect-src', 'https://api.github.com https://api.formcarry.com'], // the PAT and CRM data reach GitHub; the lead inbox key reaches Formcarry (ADR-029)
  ['base-uri', "'none'"], // a planted <base> tag cannot move the relative asset paths
  ['form-action', "'none'"], // forms never submit natively; the app handles them in script
  // Trusted Types: a string can never become HTML or script, the usual way into an XSS. The app
  // needs no policy: only React DOM has such sinks, for elements GitCRM never renders.
  ['require-trusted-types-for', "'script'"],
  ['trusted-types', "'none'"],
];

const join = (directives: [string, string][]) => directives.map(([directive, value]) => `${directive} ${value}`).join('; ');
export const CSP = join(CSP_DIRECTIVES);

// The public lead form page, lead.html (spec 15, ADR-029). It carries no GitCRM code and no storage
// access, and it may send the visitor's answers to Formcarry only.
export const LEAD_CSP_DIRECTIVES: [directive: string, value: string][] = [
  ['default-src', "'none'"],
  ['script-src', "'self'"],
  ['style-src', "'self'"],
  ['connect-src', 'https://formcarry.com'], // the visitor's answers go to the form
  ['base-uri', "'none'"],
  ['form-action', "'none'"], // the page sends the form in script, not natively
  ['require-trusted-types-for', "'script'"],
  ['trusted-types', "'none'"],
];
export const LEAD_CSP = join(LEAD_CSP_DIRECTIVES);

// The build's _headers file (spec 09). A host that reads it, such as Cloudflare Pages, sends the
// same policy as a header, with frame-ancestors, so no other site can frame the app. GitHub Pages
// serves it as a plain file. X-Robots-Tag repeats the robots meta tag in index.html: each owner's
// site is a front end to private data, so search engines leave it out.
// The lead form page detaches the app's policy and sends its own: two policies on one page would
// both apply, and the app's would block the page's request to Formcarry. Not verified on a host that
// reads _headers; either way the page fails closed (R-16).
export const HEADERS = `/*\n  Content-Security-Policy: ${CSP}; frame-ancestors 'none'\n  X-Robots-Tag: noindex\n\n/lead.html\n  ! Content-Security-Policy\n  Content-Security-Policy: ${LEAD_CSP}; frame-ancestors 'none'\n`;
