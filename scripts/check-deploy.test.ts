import { describe, expect, it } from 'vitest';
import { checkDeploy } from './check-deploy.ts';
import { CSP, HEADERS } from './csp.ts';

const text = (s: string) => new TextEncoder().encode(s);
const site = new URL('https://gitcrm.pages.dev/');
const policy = `${CSP}; frame-ancestors 'none'`;
const build = new Map([
  ['index.html', text('<!doctype html><title>GitCRM</title>')],
  ['assets/index-a1b2c3d4.js', text('console.log(1)')],
  ['assets/geist-latin-wght-normal-a1b2c3d4.woff2', new Uint8Array([0x77, 0x4f, 0x46, 0x32])],
  ['_headers', text(HEADERS)],
]);

// A host that serves `build` the way Cloudflare Pages does, changed by `changes`: a path's body,
// status, or headers (null removes one). Pages reads _headers and answers any other path with
// index.html.
type Served = { body?: Uint8Array<ArrayBuffer>; status?: number; headers?: Record<string, string | null> };
function host(changes: Record<string, Served> = {}) {
  const requested: string[] = [];
  const get = async (url: URL | string) => {
    const path = new URL(url).pathname.slice(1);
    requested.push(path);
    const file = path === '' ? 'index.html' : path;
    const change = changes[file] ?? {};
    const body = change.body ?? (build.has(file) && file !== '_headers' ? build.get(file)! : build.get('index.html')!);
    const headers = new Headers();
    for (const [name, value] of Object.entries({ 'Content-Security-Policy': policy, 'X-Robots-Tag': 'noindex', ...change.headers })) {
      if (value !== null) headers.set(name, value);
    }
    return new Response(body, { status: change.status ?? 200, headers });
  };
  return { get, requested };
}

describe('checkDeploy', () => {
  it('passes a site that serves the build, byte for byte, with the header policy', async () => {
    const { get, requested } = host();
    expect(await checkDeploy(site, build, get)).toEqual([]);
    expect(requested.toSorted()).toEqual(['', '_headers', 'assets/geist-latin-wght-normal-a1b2c3d4.woff2', 'assets/index-a1b2c3d4.js']);
  });

  it('names a file that differs from the build or is missing, such as an older deployment', async () => {
    const { get } = host({ 'index.html': { body: text('<!doctype html><title>GitCRM</title><!-- old -->') }, 'assets/index-a1b2c3d4.js': { status: 404 } });
    expect(await checkDeploy(site, build, get)).toEqual(['https://gitcrm.pages.dev/ differs from the build', 'https://gitcrm.pages.dev/assets/index-a1b2c3d4.js: HTTP 404']);
  });

  it('names a response without the header policy, or with a policy that lets other sites frame the app', async () => {
    const { get } = host({ 'index.html': { headers: { 'Content-Security-Policy': null } }, 'assets/index-a1b2c3d4.js': { headers: { 'Content-Security-Policy': CSP } } });
    expect(await checkDeploy(site, build, get)).toEqual([
      'https://gitcrm.pages.dev/ does not send the header policy from _headers',
      'https://gitcrm.pages.dev/assets/index-a1b2c3d4.js does not send the header policy from _headers',
    ]);
  });

  // Until the public release, search engines leave the official copy out (ADR-024).
  it('names a response without another header from the /* rule, and accepts it among other values', async () => {
    const { get } = host({ 'index.html': { headers: { 'X-Robots-Tag': null } }, 'assets/index-a1b2c3d4.js': { headers: { 'X-Robots-Tag': 'nofollow, noindex' } } });
    expect(await checkDeploy(site, build, get)).toEqual(['https://gitcrm.pages.dev/ does not send "X-Robots-Tag: noindex" from _headers']);
  });

  // A new site's certificate, or the network, can fail for a moment. The caller tries again.
  it('names a request that fails, such as a TLS handshake, instead of throwing', async () => {
    const { get } = host();
    const failing = async (url: URL) => {
      if (url.pathname.endsWith('.js')) throw new TypeError('fetch failed', { cause: new Error('ssl/tls alert handshake failure') });
      return get(url);
    };
    expect(await checkDeploy(site, build, failing)).toEqual(['https://gitcrm.pages.dev/assets/index-a1b2c3d4.js: fetch failed (ssl/tls alert handshake failure)']);
  });

  it('names a host that serves the _headers file instead of reading it', async () => {
    const { get } = host({ _headers: { body: build.get('_headers') } });
    expect(await checkDeploy(site, build, get)).toEqual(['https://gitcrm.pages.dev/_headers serves the headers file, so the host did not read it']);
  });
});
