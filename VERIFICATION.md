# Verification

The Knowledge-as-Code template includes a verification system that detects stale entities, validates cross-reference integrity, and provides a foundation for AI-assisted content review.

## How It Works

The verification script (`scripts/verify.js`) performs two categories of checks:

### Staleness Detection

Each entity file can include a `last_verified` date in its YAML frontmatter. The script compares this date against a configurable threshold to identify entities that may contain outdated information.

Entities are reported in three categories:
- **Fresh** — verified within the staleness window
- **Stale** — `last_verified` date exceeds the threshold
- **Never verified** — no `last_verified` field present

### Cross-Reference Checking

The script validates that:
- Every container has at least one mapping entry
- Every mapping references valid primary entity IDs
- Every mapping references valid container IDs

## Setting `last_verified` in Entity Frontmatter

Add a `last_verified` field with an ISO date to any entity's frontmatter:

```yaml
---
title: Data Encryption
group: technical
last_verified: 2025-01-15
---
```

When you review an entity and confirm its content is current, update this date. The verification script will then consider it fresh until the staleness threshold is exceeded.

## Configuring the Staleness Threshold

In `project.yml`, set the number of days before an entity is considered stale:

```yaml
verification:
  staleness_days: 90
```

The default is 90 days. Adjust this based on how frequently your domain changes. Fast-moving regulatory environments may warrant 30 days; stable reference data might use 180.

## Running Verification

```bash
node scripts/verify.js
```

The script exits with code 0 if no entities are stale, and code 1 if any stale entities are found. This makes it suitable for CI pipelines.

## GitHub Actions Workflow

The included workflow (`.github/workflows/verify.yml`) runs verification on a weekly schedule (Mondays at 9am UTC) and can be triggered manually via `workflow_dispatch`.

The workflow uses `continue-on-error: true` so that stale entities produce warnings rather than blocking other CI processes. Remove this flag if you want stale entities to fail the pipeline.

## AI-Assisted Verification

The `scripts/verify.js` file includes a commented-out placeholder for model-based verification. This pattern sends entity content to an LLM API to check for:

- Outdated facts or references
- Broken or changed URLs
- Superseded standards or regulations
- Factual inaccuracies

To enable AI verification:

1. Set environment variables for your AI provider:
   ```bash
   export AI_API_URL="https://api.example.com/v1/completions"
   export AI_API_KEY="your-key"
   ```

2. Uncomment the `aiVerify` function in `scripts/verify.js`

3. Uncomment the loop that calls `aiVerify` on stale entities

4. Make the `verify` function `async` and add `await` to the AI calls

The placeholder uses Node.js built-in `fetch` (available in Node 18+). No additional dependencies are required.

### Example AI Verification Pattern

```javascript
async function aiVerify(entity) {
    const prompt = `Review this entity for accuracy:
      Title: ${entity.title}
      Content: ${entity._body}

      Check for outdated facts, broken URLs, and superseded standards.
      Respond with JSON: { "status": "current"|"needs_review", "issues": [] }`;

    const response = await fetch(process.env.AI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AI_API_KEY}`
        },
        body: JSON.stringify({ prompt, max_tokens: 500 })
    });
    return response.json();
}
```

This can be integrated into the weekly GitHub Actions workflow by adding the API credentials as repository secrets and updating the workflow step to pass them as environment variables.
