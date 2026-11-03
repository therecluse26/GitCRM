import { describe, expect, it } from 'vitest';
import { auditBuild } from './check-build.ts';
import { CSP, HEADERS, LEAD_CSP } from './csp.ts';

const meta = (policy = CSP) => `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
const page = (head = meta(), body = '') => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    ${head}
    <meta name="robots" content="noindex" />
    <title>GitCRM</title>
    <script type="module" crossorigin src="./assets/index-a1b2c3d4.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-a1b2c3d4.css">
  </head>
  <body>
    <div id="root"></div>${body}
  </body>
</html>`;

// The public form page (spec 15): its own policy, and one script that carries no GitCRM code.
const FORM_SCRIPT = 'assets/lead-e5f6a7b8.js';
const leadPage = (head = meta(LEAD_CSP), body = '') => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    ${head}
    <meta name="robots" content="noindex" />
    <title>Contact us</title>
    <script type="module" crossorigin src="./${FORM_SCRIPT}"></script>
    <link rel="stylesheet" crossorigin href="./assets/lead-e5f6a7b8.css">
  </head>
  <body>
    <main><h1>Contact us</h1></main>${body}
  </body>
</html>`;
const LEAD_HEADERS = `/lead.html\n  ! Content-Security-Policy\n  Content-Security-Policy: ${LEAD_CSP}; frame-ancestors 'none'\n`;
const leadWrong = `_headers: the /lead.html rule must detach the policy, then send the policy from lead.html and "; frame-ancestors 'none'"`;

// A clean build, changed by `changes`.
function audit(changes: Record<string, string | null> = {}) {
  const files = new Map<string, string>([
    ['index.html', page()],
    ['assets/index-a1b2c3d4.js', 'fetch("https://api.github.com/user");const ns="http://www.w3.org/2000/svg";'],
    ['assets/index-a1b2c3d4.css', 'body{font-family:Geist}'],
    ['assets/geist-latin-wght-normal-a1b2c3d4.woff2', ''],
    ['lead.html', leadPage()],
    [FORM_SCRIPT, 'const e="https://formcarry.com/s/";fetch(e+id,{method:"POST"});'],
    ['assets/lead-e5f6a7b8.css', 'body{margin:0}'],
    ['_headers', HEADERS],
  ]);
  for (const [path, text] of Object.entries(changes)) {
    if (text === null) files.delete(path);
    else files.set(path, text);
  }
  return auditBuild(files);
}

describe('auditBuild', () => {
  it('passes a clean build', () => {
    expect(audit()).toEqual([]);
  });

  // Each owner's site is a front end to private data; GitHub Pages cannot send X-Robots-Tag (spec 09).
  it('needs a robots noindex meta tag in index.html', () => {
    const without = page().replace('    <meta name="robots" content="noindex" />\n', '');
    expect(audit({ 'index.html': without })).toEqual(['index.html has no <meta name="robots" content="noindex"> tag']);
    expect(audit({ 'index.html': without.replace('<title>', '<meta name="robots" content="index" /><title>') })).toEqual([
      'index.html has no <meta name="robots" content="noindex"> tag',
    ]);
  });

  it('refuses a source map, the developer page, and any other file type', () => {
    expect(audit({ 'assets/index-a1b2c3d4.js.map': '{}' })).toEqual(['Unexpected file in the build: assets/index-a1b2c3d4.js.map']);
    expect(audit({ 'dev.html': '<html></html>' })).toEqual(['Unexpected file in the build: dev.html']);
    expect(audit({ 'assets/index-a1b2c3d4.js': 'x;\n//# sourceMappingURL=index.js.map' })).toEqual(['assets/index-a1b2c3d4.js links a source map']);
  });

  it('needs the policy before any script or stylesheet', () => {
    expect(audit({ 'index.html': page('') })).toEqual([
      'index.html has no Content Security Policy meta tag',
      `_headers: the /* rule must send the policy from index.html, then "; frame-ancestors 'none'"`,
    ]);
    const late = page('').replace('</head>', `${meta()}\n</head>`);
    expect(audit({ 'index.html': late })).toEqual(['index.html: the Content Security Policy must come before every script and stylesheet']);
  });

  it('refuses a weaker policy', () => {
    const weaker = (from: string, to: string) => audit({ 'index.html': page(meta(CSP.replace(from, to))), _headers: HEADERS.replace(from, to) });
    expect(weaker("script-src 'self'", "script-src 'self' 'unsafe-inline'")).toEqual(["The policy's script-src must be exactly 'self'", "The policy allows 'unsafe-inline'"]);
    expect(weaker("default-src 'none'", "default-src 'self'")).toEqual(["The policy's default-src must be 'none'"]);
    expect(weaker("; require-trusted-types-for 'script'", '')).toEqual(["The policy must require Trusted Types for scripts"]);
    expect(weaker('connect-src https://api.github.com https://api.formcarry.com', 'connect-src https://api.github.com https://api.formcarry.com https://collector.example')).toEqual([
      "The policy's connect-src must be exactly https://api.github.com https://api.formcarry.com",
      'index.html names a host that nobody reviewed: collector.example',
      '_headers names a host that nobody reviewed: collector.example',
    ]);
  });

  it('refuses inline script, inline style, and event handler attributes in index.html', () => {
    expect(audit({ 'index.html': page(meta(), '<script>window.x = 1</script>') })).toEqual(['index.html has an inline script']);
    expect(audit({ 'index.html': page(meta(), '<style>body{}</style>') })).toEqual(['index.html has an inline style']);
    expect(audit({ 'index.html': page(meta(), '<div onclick="go()"></div>') })).toEqual(['index.html has an event handler attribute']);
  });

  // The token-shaped strings are built at run time, so no secret scanner flags this file.
  it('refuses anything shaped like a GitHub token', () => {
    for (const prefix of ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_']) {
      expect(audit({ 'assets/index-a1b2c3d4.css': `/* ${prefix}${'A1b2'.repeat(9)} */` })).toEqual(['assets/index-a1b2c3d4.css holds something shaped like a GitHub token']);
    }
    expect(audit({ 'assets/index-a1b2c3d4.js': `const t="github_pat_${'A1b2C3'.repeat(14)}"` })).toEqual(['assets/index-a1b2c3d4.js holds something shaped like a GitHub token']);
  });

  // A real address in the bundle could be customer data from a test fixture or a hard-coded record.
  it('allows email addresses on reserved example domains only', () => {
    expect(audit({ 'assets/index-a1b2c3d4.js': 'hint="such as ava@example.com.";t="b@x.example";u="c@demo.test"' })).toEqual([]);
    expect(audit({ 'assets/index-a1b2c3d4.js': 'const owner="ava.bennett@northwind.co"' })).toEqual(['assets/index-a1b2c3d4.js holds an email address: ava.bennett@northwind.co']);
  });

  it('names each host that is not on the reviewed list', () => {
    expect(audit({ 'assets/index-a1b2c3d4.js': 'fetch("https://collector.example/t");a="https://github.com/settings"' })).toEqual([
      'assets/index-a1b2c3d4.js names a host that nobody reviewed: collector.example',
    ]);
  });

  // Hosts such as Cloudflare Pages read _headers (spec 09). Only a header can set frame-ancestors.
  it('needs a headers file that sends the policy from index.html, with frame-ancestors', () => {
    const wrong = `_headers: the /* rule must send the policy from index.html, then "; frame-ancestors 'none'"`;
    expect(audit({ _headers: null })).toEqual(['The build has no _headers file']);
    expect(audit({ _headers: `/*\n  Content-Security-Policy: ${CSP}\n${LEAD_HEADERS}` })).toEqual([wrong]);
    expect(audit({ _headers: `/*\n  Content-Security-Policy: default-src *; frame-ancestors 'none'\n${LEAD_HEADERS}` })).toEqual([wrong]);
    expect(audit({ _headers: `/assets/*\n  Content-Security-Policy: ${CSP}; frame-ancestors 'none'\n${LEAD_HEADERS}` })).toEqual([
      wrong,
      '_headers: the /assets/* rule changes the Content-Security-Policy header',
    ]);
  });

  it('refuses a headers rule that changes or removes the policy, and a line over 2,000 characters', () => {
    expect(audit({ _headers: `${HEADERS}/assets/*\n  ! Content-Security-Policy\n` })).toEqual(['_headers: the /assets/* rule changes the Content-Security-Policy header']);
    expect(audit({ _headers: `${HEADERS}/index.html\n  content-security-policy: default-src *\n` })).toEqual(['_headers: the /index.html rule changes the Content-Security-Policy header']);
    expect(audit({ _headers: `# My copy\n${HEADERS}/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n` })).toEqual([]);
    const line = HEADERS.split('\n').length + 1;
    expect(audit({ _headers: `${HEADERS}/*\n  X-Note: ${'a'.repeat(2000)}\n` })).toEqual([`_headers: line ${line} is longer than 2,000 characters`]);
  });
});

// The public form page, lead.html (spec 15, ADR-029). It shares the app's origin, so it must carry
// no GitCRM code and no way to reach storage.
describe('auditBuild, the form page', () => {
  it('is part of every build, and needs the robots noindex tag', () => {
    expect(audit({ 'lead.html': null })).toEqual([leadWrong, 'The build has no lead.html']);
    const without = leadPage().replace('    <meta name="robots" content="noindex" />\n', '');
    expect(audit({ 'lead.html': without })).toEqual(['lead.html has no <meta name="robots" content="noindex"> tag']);
  });

  it('needs a policy that lets it connect to the form only', () => {
    const weaker = (from: string, to: string) => audit({ 'lead.html': leadPage(meta(LEAD_CSP.replace(from, to))), _headers: HEADERS.replace(LEAD_CSP, LEAD_CSP.replace(from, to)) });
    expect(weaker('connect-src https://formcarry.com', 'connect-src https://formcarry.com https://collector.example')).toEqual([
      "lead.html: The policy's connect-src must be exactly https://formcarry.com",
      'lead.html names a host that nobody reviewed: collector.example',
      '_headers names a host that nobody reviewed: collector.example',
    ]);
    expect(weaker('connect-src https://formcarry.com', 'connect-src https://api.github.com')).toEqual(["lead.html: The policy's connect-src must be exactly https://formcarry.com"]);
    expect(weaker("script-src 'self'", "script-src 'self' 'unsafe-inline'")).toEqual(["lead.html: The policy's script-src must be exactly 'self'", "lead.html: The policy allows 'unsafe-inline'"]);
    expect(audit({ 'lead.html': leadPage(meta(CSP)) })).toEqual(["lead.html: The policy's connect-src must be exactly https://formcarry.com", leadWrong]);
  });

  it('refuses an inline script, and a second script', () => {
    expect(audit({ 'lead.html': leadPage(meta(LEAD_CSP), '<script>x()</script>') })).toEqual(['lead.html has an inline script']);
    const two = leadPage().replace('</head>', '<script type="module" src="./assets/other.js"></script></head>');
    expect(audit({ 'lead.html': two })).toEqual(['lead.html must load exactly one script, and it loads 2']);
    expect(audit({ [FORM_SCRIPT]: null })).toEqual([`lead.html loads ${FORM_SCRIPT}, which is not in the build`]);
  });

  it('refuses a script that imports another file', () => {
    for (const text of ['import"./chunk-1.js";fetch("https://formcarry.com/s/")', 'import{a}from"./chunk-1.js";a()', 'const m=await import("./chunk-1.js")']) {
      expect(audit({ [FORM_SCRIPT]: text })).toEqual([`The form page script ${FORM_SCRIPT} imports another file`]);
    }
  });

  it('refuses a script that reaches storage, cookies, or the GitHub API', () => {
    expect(audit({ [FORM_SCRIPT]: 'localStorage.getItem("gitcrm.leads")' })).toEqual([`The form page script ${FORM_SCRIPT} uses localStorage`]);
    expect(audit({ [FORM_SCRIPT]: 'sessionStorage.x;indexedDB.open("x");document.cookie="a=b"' })).toEqual([
      `The form page script ${FORM_SCRIPT} uses sessionStorage`,
      `The form page script ${FORM_SCRIPT} uses indexedDB`,
      `The form page script ${FORM_SCRIPT} uses document.cookie`,
    ]);
    expect(audit({ [FORM_SCRIPT]: 'fetch("https://api.github.com/user")' })).toEqual([`The form page script ${FORM_SCRIPT} uses api.github.com`]);
  });

  it('needs a headers rule that detaches the app policy and sends its own', () => {
    expect(audit({ _headers: HEADERS.replace(LEAD_HEADERS, '') })).toEqual([leadWrong]);
    expect(audit({ _headers: HEADERS.replace('  ! Content-Security-Policy\n', '') })).toEqual([leadWrong]);
    expect(audit({ _headers: HEADERS.replace(LEAD_CSP, "default-src *") })).toEqual([leadWrong]);
  });
});
