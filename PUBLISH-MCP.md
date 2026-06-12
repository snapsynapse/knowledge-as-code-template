# Publishing your fork as an MCP server

After you've forked this template and replaced the example data with your own,
you can publish your knowledge base as an MCP server — installable by anyone
via `npx -y your-package` and discoverable on the Official MCP Registry.

This guide captures the exact prep work, in the order it has to happen.

## Prerequisites

- Your fork has its own canonical `project.yml`, real data under `data/`, and a
  working build (`node scripts/build.js` succeeds).
- Entity filenames, mapping IDs, and mapping references are lowercase slug IDs
  using only `a-z`, `0-9`, and single hyphens. Run `node scripts/validate.js`
  before publishing so unsafe IDs are rejected before they become MCP-visible
  data.
- `node mcp-server.js` works locally — pipe `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`
  into it and you should get back your tools.
- An npm account ([npmjs.com](https://npmjs.com/signup)) with 2FA enabled.
- A GitHub account that matches the org/user owning the repo.

## Step 1 — choose a package name

Pick the npm package name your users will install. Three considerations:

1. **Must be unique on npm.** Check with `npm view your-package-name` — a 404
   means it's available.
2. **Should match your repo name** if possible. Cross-referencing is easier.
3. **Avoid generic words.** `legal-data` is contested; `my-firms-legal-corpus`
   isn't.

If you also want to publish to the Official MCP Registry, you'll register a
*namespaced* identifier separately (e.g. `io.github.your-username/your-package`).
That's covered in step 5.

## Step 2 — update package.json

Open `package.json` and add the fields below. The runtime fields (`bin`, `main`,
`files`, `mcpName`, `engines`) are what npm and the MCP registry care about.

```json
{
  "name": "your-package-name",
  "version": "0.1.0",
  "mcpName": "io.github.your-username/your-package-name",
  "description": "<100 char description — registry caps this>",
  "homepage": "https://your-canonical-url/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/your-username/your-repo.git"
  },
  "bugs": {
    "url": "https://github.com/your-username/your-repo/issues"
  },
  "license": "MIT",
  "author": "Your Name <https://your-site/>",
  "engines": {
    "node": ">=20"
  },
  "bin": {
    "your-package-name": "mcp-server.js"
  },
  "main": "mcp-server.js",
  "files": [
    "mcp-server.js",
    "project.yml",
    "scripts/lib/*.js",
    "data/_schema.md",
    "data/your-data-dirs/**/*.md",
    "data/your-data-dirs/**/*.yml",
    "mcp.json",
    "README.md",
    "LICENSE"
  ]
}
```

The `files` whitelist is critical: npm publishes whatever you list, and skips
everything else. Include only what the MCP server needs at runtime — your
markdown data, project.yml, the parser/loader library files. Do NOT include
build scripts, the generated `docs/` directory, or anything ending in `.test.js`.

The 100-character description cap applies to the Official MCP Registry. The
longer description from your README is fine in npm but the registry will
reject it.

## Step 3 — smoke test the package locally

Pack the tarball and verify what npm would actually ship:

```bash
npm pack --dry-run
```

Look at the file list. If anything is missing (a data file, a parser library),
add it to `files` and re-run. If anything is included that shouldn't be (a
.env, an internal note), tighten the patterns.

Then test that the MCP server still runs after the package.json changes:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node mcp-server.js
```

You should get back your tools.

The server follows JSON-RPC notification semantics. Messages without an `id`
are notifications and do not receive responses, including unknown-method
notifications.

## Step 4 — publish to npm

Authenticate (a one-time setup; uses your browser):

```bash
npm login
```

Publish:

```bash
npm publish --access public
```

If you have 2FA on (you should), npm will prompt for a one-time code via
browser — open the URL it prints. Wait until the publish completes.

Verify:

```bash
npm view your-package-name version
npx -y your-package-name <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

A cold install + tools list confirms the package is real.

## Step 5 — publish to the Official MCP Registry

Install the publisher CLI:

```bash
brew install mcp-publisher  # or follow https://registry.modelcontextprotocol.io/docs
```

Generate a `server.json`:

```bash
mcp-publisher init
```

This auto-detects your npm package and writes a starter file. Edit it. The
most common fixes:

- **Description over 100 chars** — registry rejects with HTTP 422. Tighten
  before publishing.
- **`environmentVariables`** auto-fills a placeholder `YOUR_API_KEY`. Remove it
  if your server needs no env vars. If it does take env vars, make sure
  `isRequired` is accurate.
- **`title`** — auto-detection often misses this. Add a human-readable display
  name.
- **`websiteUrl`** — the canonical URL of your project (not the GitHub URL).
- **`_meta`** — optional. Use this to round-trip metadata the registry doesn't
  natively model (legal layer position, license details, publisher info). The
  schema is `_meta["io.modelcontextprotocol.registry/publisher-provided"]`.

Validate, then authenticate, then publish:

```bash
mcp-publisher validate
mcp-publisher login github   # opens a browser; tokens are short-lived
mcp-publisher publish
```

Verify your listing is queryable:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=your-package-name" | jq
```

## Step 6 — bumping versions

A republish over the same version fails on both npm and the MCP registry.
After any data update or server change:

1. Bump `version` in `package.json` (use [semver](https://semver.org/) —
   PATCH for data updates, MINOR for new tools, MAJOR for breaking changes).
2. Bump `version` in `server.json` to match.
3. `npm publish` (will need OTP again unless you're using an Automation token).
4. `mcp-publisher publish` (will need fresh login if the JWT has expired,
   which it does after about an hour).

## Authentication realities

**npm:** if you use a "Publish" classic token, every publish requires a 2FA
browser flow. If you use an "Automation" token, it bypasses 2FA — easier for
recurring publishes. Create one at
[npmjs.com/settings/~/tokens](https://npmjs.com/settings/~/tokens).

**mcp-publisher:** the registry uses short-lived JWTs. If your session has
been idle for an hour or so, the next `mcp-publisher publish` will fail with
"token is expired" and you'll need to re-run `mcp-publisher login github`.

## Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `description > 100 chars` (HTTP 422) | Registry length cap | Shorten description in `server.json` |
| `NPM package X is missing required 'mcpName' field` | Forgot the `mcpName` in package.json | Add `mcpName`, bump version, republish to npm |
| `Invalid or expired Registry JWT token` | mcp-publisher session expired | `mcp-publisher login github` again |
| Tarball missing data files | `files` whitelist too narrow | Add the data globs you need |
| Tarball way too big | `files` includes generated output | Exclude `docs/`, build artifacts |
| Cold `npx` install hangs or errors | Hidden runtime dependency | Either add the dep to `dependencies`, or vendor it under `files` |

## Examples in the PAICE legal graph

Three published MCP servers built on this template that you can study:

- **AI Incident Law** ([github.com/snapsynapse/ai-incident-law](https://github.com/snapsynapse/ai-incident-law)) — case and enforcement evidence
- **EveryAILaw** ([github.com/snapsynapse/every-ai-law](https://github.com/snapsynapse/every-ai-law)) — AI obligation registry
- **PubLedge** ([github.com/snapsynapse/publedge](https://github.com/snapsynapse/publedge)) — verifiable public-record protocol

Each has a `server.json` showing the registry submission shape, and a
`package.json` showing the publish-prep field set. Copy from whichever is
closest to your shape.
