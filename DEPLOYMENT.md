# Deployment

The generated site is static. Build it into `docs/` for a normal template project, then publish that directory with GitHub Pages or any static host.

## Deployment profiles

| Profile | Published URL | `deployment.custom_domain` | Build command |
|---|---|---|---|
| Custom apex domain | `https://reference.example/` | `reference.example` | `node scripts/build.js` |
| GitHub user site | `https://account.github.io/` | Empty | `node scripts/build.js` |
| GitHub project site | `https://account.github.io/project/` | Empty | `KAC_SITE_URL="https://account.github.io/project/" node scripts/build.js` |
| Other shared-host subpath | `https://host.example/catalog/` | Empty | `KAC_SITE_URL="https://host.example/catalog/" node scripts/build.js` |

Set `deployment.custom_domain` only when the generated artifact is deployed at that hostname. The build emits `CNAME` for an explicit custom domain and removes a stale generated `CNAME` when the setting is cleared.

Published URLs must use HTTPS, a bare domain, and no query, fragment, credentials, or port. A missing trailing slash and repeated path slashes are normalized.

## Environment overrides

| Variable | Purpose | Default |
|---|---|---|
| `KAC_OUTPUT_DIR` | Generated artifact directory, relative to the repository | `docs` |
| `KAC_SITE_URL` | Published URL used for canonicals, sitemap, RSS, discovery files, and 404 links | `project.yml` `url` |
| `KAC_REPO_URL` | Repository URL exposed in generated metadata | `project.yml` `repo` |
| `KAC_LINK_CHECK_DIR` | Artifact checked by `scripts/check-links.js` | `docs` |
| `KAC_LINK_BASE_PATH` | Explicit deployment base path for link checking when no sitemap is available | Derived from the artifact sitemap |

The output directory must be a child of the repository. The build refuses the repository root and parent paths.

## GitHub Pages

Initialized projects include a Pages workflow that builds and publishes `docs/`.

1. Create the GitHub repository and push the initialized project.
2. In repository settings, set Pages source to GitHub Actions.
3. Set `project.yml` `url` to the final published URL, or provide `KAC_SITE_URL` in the workflow.
4. For a custom domain, set `deployment.custom_domain` to the bare hostname and configure the corresponding DNS records in GitHub.
5. Run the pre-deployment verification commands below before pushing.

The canonical Knowledge-as-Code repository is different: GitHub Pages serves its branch root, while `demo/` is a tracked generated artifact at `https://knowledge-as-code.com/demo/`.

## Pre-deployment verification

```bash
node scripts/validate.js
node scripts/build.js
node scripts/verify.js
node scripts/check-links.js
```

For a non-default output directory, point the link checker at the same artifact:

```bash
KAC_OUTPUT_DIR=public KAC_SITE_URL="https://host.example/catalog/" node scripts/build.js
KAC_LINK_CHECK_DIR=public node scripts/check-links.js
```

Use `KAC_LINK_BASE_PATH=/catalog/` only when the output has no generated sitemap from which the checker can discover the base path.

## Troubleshooting

### ID does not match filename

The filename without `.md` is canonical. Rename the file or change frontmatter `id` so both use the same lowercase hyphenated slug, then update mapping references.

### Route collision

Two configured scope values normalize to the same bridge route. Change one source value so each produces a distinct lowercase hyphenated route.

### Mapping file is missing or malformed

Confirm `mapping.file` resolves beneath the data directory. Each mapping must begin with `- id:`, use the documented 1.x keys, and express `obligations` as a YAML list. Unknown keys, duplicate keys, scalar obligations, and duplicate obligations fail validation.

### CNAME or custom-domain error

Use only a bare hostname such as `reference.example`, without `https`, `www`, a path, port, query, or fragment. Leave `deployment.custom_domain` empty for shared-host subpaths.

### Unknown group or status

Every primary `group` must exist under `entities.primary.groups`. Every container `status` must exist under `entities.container.statuses`. Add the value to `project.yml` or correct the entity frontmatter.

### Links work locally but fail under a subpath

Build with the exact published path in `KAC_SITE_URL`, including the repository or catalog path. Then run the link checker against that artifact and confirm its reported deployment base.
