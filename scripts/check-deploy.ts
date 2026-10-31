// The live check (spec 09). After each deploy, the workflow checks that the official copy serves
// this build byte for byte, with each header from the /* rule in _headers. It tries 6 times, 10
// seconds apart, because the new deployment can take a moment to reach every request.
// Usage: node scripts/check-deploy.ts <site url> [dir]
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const TRIES = 6;
const PAUSE_MS = 10_000;

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i]);

// `files`: each built file's path, relative to the build folder, and its bytes.
export async function checkDeploy(site: URL, files: Map<string, Uint8Array>, get: (url: URL) => Promise<Response> = fetch): Promise<string[]> {
  const headers = files.get('_headers');
  if (!headers) return ['The build has no _headers file'];
  // The /* rule's `Name: value` lines. The policy must match exactly; another header may also
  // carry values that the host adds, such as Cloudflare's noindex on a preview.
  const rule = new TextDecoder().decode(headers).split(/\n(?=\S)/).find((block) => block.startsWith('/*\n')) ?? '';
  const sent = [...rule.matchAll(/^[ \t]+([\w-]+): (.*)$/gm)].map(([, name, value]) => [name, value]);
  const policy = sent.find(([name]) => name === 'Content-Security-Policy')?.[1];
  const problems: string[] = [];
  // A request that fails, such as a TLS handshake while a new site gets its certificate, is a
  // problem like any other, so the caller tries again.
  const request = async (url: URL) => {
    try {
      return await get(url);
    } catch (error) {
      const { message, cause } = error as Error;
      problems.push(`${url}: ${message}${cause instanceof Error ? ` (${cause.message.trim()})` : ''}`);
      return undefined;
    }
  };
  for (const [path, bytes] of files) {
    if (path === '_headers') continue;
    const url = new URL(path === 'index.html' ? './' : path, site);
    const response = await request(url);
    if (!response) continue;
    if (!response.ok) {
      problems.push(`${url}: HTTP ${response.status}`);
      continue;
    }
    if (!same(new Uint8Array(await response.arrayBuffer()), bytes)) problems.push(`${url} differs from the build`);
    if (response.headers.get('content-security-policy') !== policy) problems.push(`${url} does not send the header policy from _headers`);
    for (const [name, value] of sent) {
      if (name !== 'Content-Security-Policy' && !response.headers.get(name)?.split(/,\s*/).includes(value)) problems.push(`${url} does not send "${name}: ${value}" from _headers`);
    }
  }
  const url = new URL('_headers', site);
  const served = await request(url);
  if (served?.ok && same(new Uint8Array(await served.arrayBuffer()), headers)) problems.push(`${url} serves the headers file, so the host did not read it`);
  return problems;
}

async function readBuild(dir: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(dir, path).split('\\').join('/'), await readFile(path));
  }
  return files;
}

if (import.meta.main) {
  const [site, dir = 'dist'] = process.argv.slice(2);
  if (!site) throw new Error('Usage: node scripts/check-deploy.ts <site url> [dir]');
  const files = await readBuild(dir);
  for (let attempt = 1; ; attempt++) {
    const problems = await checkDeploy(new URL(site), files);
    if (problems.length === 0) {
      console.log(`Live check: ${site} serves ${dir}/, with each header from _headers.`);
      break;
    }
    if (attempt === TRIES) {
      console.error(`The live check found ${problems.length} problem(s) at ${site} after ${TRIES} tries:\n${problems.map((p) => `- ${p}`).join('\n')}`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
}
