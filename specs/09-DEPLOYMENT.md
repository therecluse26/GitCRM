# Spec 09 - Deployment

**Priority:** MVP

The official copy runs on Cloudflare Pages at `https://gitcrm.pages.dev/` (ADR-010). GitHub Actions deploys it from `main` (ADR-024). This spec closes the Phase 3 item "Deploy the same build to Cloudflare Pages and GitHub Pages" (docs/11).

## User stories

- As a user, I want the official copy to be the code that passed every test, so a broken or changed build never reaches me.
- As a user, I want another site to be unable to frame the official copy, so it cannot trick me into clicks.
- As a self-hoster, I want the same build to run from a folder on any static host, such as a GitHub Pages project site.

## In scope

- A `_headers` file in the build. Cloudflare Pages reads it and sends the Content Security Policy as a header, with `frame-ancestors 'none'`.
- The build audit checks that file.
- One GitHub Actions workflow: on each push to `main`, it runs every check, builds once, deploys that build, and checks the live site.
- A browser test that serves the same build from `/GitCRM/` with no custom headers, the way GitHub Pages serves a project site.

Out of scope: a live copy on GitHub Pages (ADR-024), a custom domain (ADR-010), and preview copies of branches or pull requests.

## Acceptance criteria

```gherkin
Scenario: The build carries the header policy for Cloudflare Pages
  Given I run npm run build
  Then dist/_headers has one rule, for "/*"
  And the rule sends Content-Security-Policy: the policy from index.html, then "; frame-ancestors 'none'"
  And until the public release, the rule also sends X-Robots-Tag: noindex, so search engines leave the official copy out

Scenario: The build audit refuses a wrong headers file
  Given dist/_headers is missing
  Or its policy is not the policy from index.html with "frame-ancestors 'none'"
  Or another rule changes or removes the Content-Security-Policy header
  Or a line is longer than 2,000 characters (the Cloudflare limit)
  When the build audit runs
  Then the build fails, and the audit names the problem

Scenario: The same build runs from a folder, with no custom headers (the GitHub Pages shape)
  Given the build is served from /GitCRM/ with no custom headers
  When I connect, create a company, a contact, an opportunity, a note, and a task
  Then each step works under the policy in index.html
  And every request goes to /GitCRM/ or to api.github.com
  And the app refuses to run inside a frame

Scenario: Only a build that passed every check deploys
  Given a push to main
  When lint, the type check, a unit test, the build audit, or a browser test fails
  Then nothing deploys
  When every check passes
  Then the deploy job uploads that same dist/ folder to Cloudflare Pages

Scenario: Only main deploys
  Given someone runs the workflow by hand on another branch
  Then the checks run, and nothing deploys

Scenario: The live check reads the official copy after each deploy
  Given the deploy is done
  Then https://gitcrm.pages.dev/ serves index.html and every asset byte for byte as built
  And each of those responses sends the header policy with "frame-ancestors 'none'"
  And each of them sends every other header from the /* rule
  And the address /_headers does not serve the headers file
  When a request still fails, or the site still differs from the build, after 6 tries, 10 seconds apart
  Then the workflow fails
```

## Notes

- `noindex` stays until the public release, because the privacy statement comes first (docs/07). Then remove that line from `HEADERS` in `scripts/csp.ts`; the live check follows the file.
- The browser enforces both policies, the `<meta>` one and the header. They are the same except `frame-ancestors`, which only a header can set.
- The build job has no secrets. Only the deploy job gets the Cloudflare token, and it runs no project code before the upload: it installs wrangler from its own lockfile (`deploy/package-lock.json`) and uploads the folder. Anyone with that token can replace the official copy, and with it the page where users type their PAT.
- If the live check fails, the new deployment is already live. Roll back to the previous deployment in the Cloudflare dashboard, then fix `main`.
- Each deployment also stays reachable at its own address, `<hash>.gitcrm.pages.dev` (docs/12, R-12).
- On a host without custom headers, `_headers` is a plain public file that holds only the policy and the `noindex` line.
