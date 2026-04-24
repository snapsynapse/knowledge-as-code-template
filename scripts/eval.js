#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseFrontmatter, parseYaml } = require('./lib/parsers');

const ROOT = path.join(__dirname, '..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures');
const TMP_ROOT = path.join(ROOT, '.tmp-evals');

function runNode(args, options = {}) {
    const result = spawnSync(process.execPath, args, {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...options.env }
    });
    return result;
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...options.env }
    });
    return result;
}

function resetDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertFile(filePath) {
    assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
}

function assertIncludes(haystack, needle, message) {
    assert.ok(haystack.includes(needle), message || `Expected output to include "${needle}"`);
}

function test(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
        return true;
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error.message);
        return false;
    }
}

function buildDefault() {
    const result = runNode(['scripts/build.js']);
    assert.strictEqual(result.status, 0, `Default build failed:\n${result.stdout}\n${result.stderr}`);
    return result;
}

function buildTo(outputDir, siteUrl) {
    const result = runNode(['scripts/build.js'], {
        env: {
            KAC_OUTPUT_DIR: outputDir,
            KAC_SITE_URL: siteUrl
        }
    });
    assert.strictEqual(result.status, 0, `Build for ${outputDir} failed:\n${result.stdout}\n${result.stderr}`);
    return result;
}

function withTempRoot(fn) {
    resetDir(TMP_ROOT);
    try {
        return fn();
    } finally {
        fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    }
}

function evalBuildSmoke() {
    buildDefault();
    const expectedFiles = [
        'docs/assets/styles.css',
        'docs/assets/search.js',
        'docs/assets/tables.js',
        'docs/assets/data.json',
        'docs/api/v1/index.json',
        'docs/sitemap.xml',
        'docs/agents.json',
        'docs/llms.txt',
        'docs/404.html'
    ];
    expectedFiles.forEach(file => assertFile(path.join(ROOT, file)));
}

function evalFreshCloneBuild() {
    withTempRoot(() => {
        const outName = '.tmp-evals/fresh-clone';
        buildTo(outName, 'https://example.com/fresh-clone/');

        const freshRoot = path.join(ROOT, outName);
        const expectedFiles = [
            'index.html',
            '404.html',
            '.nojekyll',
            'sitemap.xml',
            'robots.txt',
            'llms.txt',
            'agents.json',
            'index.xml',
            'assets/styles.css',
            'assets/search.js',
            'assets/tables.js',
            'assets/data.json',
            'api/v1/index.json',
            'api/v1/context.jsonld',
            'container/iso-27001/index.html',
            'primary/access-control/index.html'
        ];

        expectedFiles.forEach(file => assertFile(path.join(freshRoot, file)));

        const agents = readJson(path.join(freshRoot, 'agents.json'));
        const apiIndex = readJson(path.join(freshRoot, 'api/v1/index.json'));
        assert.strictEqual(agents.site.url, 'https://example.com/fresh-clone/');
        assert.strictEqual(apiIndex.meta.project, 'example');
    });
}

function evalLinkIntegrity() {
    buildDefault();
    const result = runNode(['scripts/check-links.js']);
    assert.strictEqual(result.status, 0, `Link check failed:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'All internal links valid.');
}

function evalLinkCheckerNegative() {
    const result = runNode(['scripts/check-links.js'], {
        env: {
            KAC_LINK_CHECK_DIR: 'tests/fixtures/broken-links'
        }
    });
    assert.strictEqual(result.status, 1, `Expected link checker to fail for broken fixture:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'BROKEN LINKS (1):');
    assertIncludes(result.stdout, 'missing-page.html');
    assertIncludes(result.stdout, 'index.html:');
}

function evalValidatorNegative() {
    const result = runNode(['scripts/validate.js'], {
        env: {
            KAC_CONFIG_PATH: 'tests/fixtures/validate-invalid/project.yml',
            KAC_DATA_DIR: 'tests/fixtures/validate-invalid'
        }
    });
    assert.strictEqual(result.status, 1, `Expected validator to fail for broken fixture:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'Validating cross-references...');
    assertIncludes(result.stderr, 'references unknown container "missing-framework"');
    assertIncludes(result.stderr, 'references unknown primary "missing-obligation"');
    assertIncludes(result.stderr, 'references unknown authority "missing-authority"');
    assertIncludes(result.stderr, 'Container "fixture-framework" references unknown authority "missing-authority"');
}

function evalVerifierNegative() {
    const result = runNode(['scripts/verify.js'], {
        env: {
            KAC_CONFIG_PATH: 'tests/fixtures/verify-negative/project.yml',
            KAC_DATA_DIR: 'tests/fixtures/verify-negative'
        }
    });
    assert.strictEqual(result.status, 1, `Expected verifier to fail for stale fixture:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'STALE (1):');
    assertIncludes(result.stdout, '[Requirement] stale-requirement');
    assertIncludes(result.stdout, 'NEVER VERIFIED (1):');
    assertIncludes(result.stdout, '[Framework] unverified-framework');
    assertIncludes(result.stdout, 'Fresh: 2  |  Stale: 1  |  Never verified: 1');
    assertIncludes(result.stdout, 'All mappings valid and complete.');
    assertIncludes(result.stdout, 'Result: STALE — some entities need re-verification.');
}

function evalJsonApiShape() {
    buildDefault();
    const index = readJson(path.join(ROOT, 'docs/api/v1/index.json'));
    const primaries = readJson(path.join(ROOT, 'docs/api/v1/primaries.json'));
    const containers = readJson(path.join(ROOT, 'docs/api/v1/containers.json'));
    const authorities = readJson(path.join(ROOT, 'docs/api/v1/authorities.json'));
    const mappings = readJson(path.join(ROOT, 'docs/api/v1/mappings.json'));
    const matrix = readJson(path.join(ROOT, 'docs/api/v1/matrix.json'));
    const comparisons = readJson(path.join(ROOT, 'docs/api/v1/comparisons.json'));
    const context = readJson(path.join(ROOT, 'docs/api/v1/context.jsonld'));

    assert.ok(index.meta);
    assert.ok(index.files.primaries.path);
    assert.strictEqual(primaries.meta.count, primaries.items.length);
    assert.strictEqual(containers.meta.count, containers.items.length);
    assert.strictEqual(authorities.meta.count, authorities.items.length);
    assert.strictEqual(mappings.meta.count, mappings.items.length);
    assert.ok(matrix.matrix && typeof matrix.matrix === 'object');
    assert.ok(Array.isArray(comparisons.comparisons || comparisons.items || comparisons));
    assert.ok(context['@context']);

    assert.strictEqual(primaries.items.length, 3);
    assert.strictEqual(containers.items.length, 2);
    assert.strictEqual(authorities.items.length, 2);
    assert.strictEqual(mappings.items.length, 4);

    assert.strictEqual(index.meta.version, '1.0');
    assert.strictEqual(index.meta.project, 'example');
    assert.strictEqual(index.meta.ontology.framework, 'gist');
    assert.strictEqual(index.files.comparisons.path, 'comparisons.json');

    const primary = primaries.items.find(item => item.id === 'access-control');
    assert.ok(primary, 'Expected access-control primary item');
    assert.strictEqual(primary['@type'], 'gist:KnowledgeConcept');
    assert.strictEqual(primary.name, 'Access Control');
    assert.strictEqual(primary.group, 'governance');
    assert.strictEqual(primary.status, 'active');

    const container = containers.items.find(item => item.id === 'iso-27001');
    assert.ok(container, 'Expected iso-27001 container item');
    assert.strictEqual(container['@type'], 'gist:Specification');
    assert.strictEqual(container.name, 'ISO 27001');
    assert.strictEqual(container.status, 'active');
    assert.strictEqual(container.effective, '2022-10-25');
    assert.strictEqual(container.provision_count, 2);

    const authority = authorities.items.find(item => item.id === 'nist');
    assert.ok(authority, 'Expected nist authority item');
    assert.strictEqual(authority['@type'], 'gist:Organization');
    assert.strictEqual(authority.name, 'National Institute of Standards and Technology');
    assert.strictEqual(authority.jurisdiction, 'Federal');

    const mapping = mappings.items.find(item => item.id === 'iso-27001-access-control');
    assert.ok(mapping, 'Expected iso-27001-access-control mapping item');
    assert.deepStrictEqual(mapping.obligations, ['access-control']);
    assert.strictEqual(mapping.regulation, 'iso-27001');
    assert.strictEqual(mapping.authority, 'iso');
    assert.strictEqual(mapping.source_heading, 'Information Security Controls (Annex A)');

    const comparison = comparisons.comparisons[0];
    assert.ok(comparison, 'Expected at least one comparison item');
    assert.deepStrictEqual(comparison.regulations, ['iso-27001', 'nist-csf']);
    assert.deepStrictEqual(comparison.shared_obligations, ['access-control']);
    assert.deepStrictEqual(comparison.only_a, ['data-quality']);
    assert.deepStrictEqual(comparison.only_b, ['incident-response']);
    assert.strictEqual(comparison.shared_count, 1);

    assert.strictEqual(matrix.matrix['access-control']['iso-27001'].covered, true);
    assert.deepStrictEqual(matrix.matrix['access-control']['iso-27001'].provisions, ['iso-27001-access-control']);
    assert.strictEqual(matrix.matrix['incident-response']['nist-csf'].covered, true);
}

function evalConfigOverride() {
    withTempRoot(() => {
        const outName = '.tmp-evals/demo-eval';
        const siteUrl = 'https://knowledge-as-code.com/demo/';
        buildTo(outName, siteUrl);

        const demoRoot = path.join(ROOT, outName);
        assertFile(path.join(demoRoot, 'assets/styles.css'));
        const containerPage = fs.readFileSync(path.join(demoRoot, 'container/iso-27001/index.html'), 'utf8');
        const sitemap = fs.readFileSync(path.join(demoRoot, 'sitemap.xml'), 'utf8');
        const agents = readJson(path.join(demoRoot, 'agents.json'));

        assertIncludes(containerPage, '<link rel="canonical" href="https://knowledge-as-code.com/demo/container/iso-27001/">');
        assertIncludes(sitemap, '<loc>https://knowledge-as-code.com/demo/container/iso-27001/</loc>');
        assert.strictEqual(agents.site.url, siteUrl);
    });
}

function evalParserFixtures() {
    const yamlFixture = fs.readFileSync(path.join(FIXTURES_DIR, 'project-fixture.yml'), 'utf8');
    const yaml = parseYaml(yamlFixture);
    assert.strictEqual(yaml.name, 'Fixture Knowledge Base');
    assert.strictEqual(yaml.entities.primary.name, 'Control');
    assert.strictEqual(yaml.entities.primary.groups[0].name, 'governance');
    assert.strictEqual(yaml.entities.primary.groups[1].color, '#00aa88');
    assert.strictEqual(yaml.nav[1].href, 'controls.html');
    assert.strictEqual(yaml.pattern.examples[0].url, 'https://example.com/demo');

    const advancedYamlFixture = fs.readFileSync(path.join(FIXTURES_DIR, 'project-fixture-advanced.yml'), 'utf8');
    const advancedYaml = parseYaml(advancedYamlFixture);
    assert.strictEqual(advancedYaml.name, 'Advanced Fixture');
    assert.strictEqual(advancedYaml.social.twitter_card, 'summary_large_image');
    assert.strictEqual(advancedYaml.social.twitter_site, '@fixture');
    assert.strictEqual(advancedYaml.ontology.entities.primary.gist_class, 'gist:KnowledgeConcept');
    assert.strictEqual(advancedYaml.ecosystem[0].url, 'https://knowledge-as-code.com');
    assert.strictEqual(advancedYaml.ecosystem[1].name, 'Agentlink');
    assert.strictEqual(advancedYaml.nav[1].label, 'Compare: Frameworks');
    assert.strictEqual(advancedYaml.bridges.applies_to.field, 'jurisdiction');
    assert.strictEqual(advancedYaml.theme.accent, '#123456');

    const fmFixture = fs.readFileSync(path.join(FIXTURES_DIR, 'frontmatter-fixture.md'), 'utf8');
    const parsed = parseFrontmatter(fmFixture);
    assert.strictEqual(parsed.frontmatter.title, 'Fixture: with colon in value');
    assert.strictEqual(parsed.frontmatter.summary, 'Keeps: embedded colon');
    assert.deepStrictEqual(parsed.frontmatter.tags, ['alpha', 'beta:two']);
    assert.strictEqual(parsed.frontmatter.empty_field, undefined);
    assert.ok(parsed.body.startsWith('## Summary'));

    const advancedFmFixture = fs.readFileSync(path.join(FIXTURES_DIR, 'frontmatter-fixture-advanced.md'), 'utf8');
    const advancedParsed = parseFrontmatter(advancedFmFixture);
    assert.strictEqual(advancedParsed.frontmatter.title, '"Quoted title"');
    assert.strictEqual(advancedParsed.frontmatter.status, 'active');
    assert.deepStrictEqual(advancedParsed.frontmatter.search_terms, ['zero dependency', 'bridge: pages']);
    assert.deepStrictEqual(advancedParsed.frontmatter.aliases, ['"Control One"', '"Control: Primary"']);
    assert.strictEqual(advancedParsed.frontmatter.notes, '"Quoted: keeps colon"');
    assert.strictEqual(advancedParsed.frontmatter.empty_field, undefined);
    assert.ok(advancedParsed.body.startsWith('## Summary'));
}

function evalHtmlSnapshots() {
    buildDefault();
    const snapshots = [
        ['docs/index.html', ['Example Knowledge Base', 'Coverage Matrix', 'JSON API']],
        ['docs/container/iso-27001/index.html', ['ISO 27001', 'Provisions (2)', 'Official source']],
        ['docs/primary/access-control/index.html', ['Access Control', 'What Counts', 'Implementing Frameworks']],
        ['docs/requires/iso-27001/access-control/index.html', ['Does ISO 27001 require Access Control?', 'View Framework', 'View Requirement']],
        ['docs/404.html', ['404', 'All frameworks', 'All requirements']]
    ];

    snapshots.forEach(([file, expected]) => {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        expected.forEach(fragment => assertIncludes(html, fragment, `Expected ${file} to include "${fragment}"`));
    });
}

function evalMcpSmoke() {
    const fixture = fs.readFileSync(path.join(FIXTURES_DIR, 'mcp-request.jsonl'), 'utf8');
    const result = runCommand(process.execPath, ['mcp-server.js'], {});
    assert.notStrictEqual(result.status, 1, `MCP server exited unexpectedly:\n${result.stderr}`);

    const interactive = spawnSync(process.execPath, ['mcp-server.js'], {
        cwd: ROOT,
        encoding: 'utf8',
        input: fixture
    });
    assert.strictEqual(interactive.status, 0, `MCP smoke failed:\n${interactive.stdout}\n${interactive.stderr}`);
    assertIncludes(interactive.stdout, 'list_frameworks');
    assertIncludes(interactive.stdout, 'get_framework');
    assertIncludes(interactive.stdout, 'iso-27001');
}

function evalDocsConsistency() {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const buildWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
    const verification = fs.readFileSync(path.join(ROOT, 'VERIFICATION.md'), 'utf8');
    const verifyWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/verify.yml'), 'utf8');

    assertIncludes(readme, 'Check the `docs/` directory for the output');
    assertIncludes(buildWorkflow, 'Build site (sanity check)');
    assert.ok(!readme.includes('deploys to GitHub Pages automatically'), 'README should not claim automatic deployment.');
    assert.ok(!verification.includes('continue-on-error: true'), 'Verification docs should reflect current workflow implementation.');
    assertIncludes(verifyWorkflow, 'echo "exit_code=$?" >> "$GITHUB_OUTPUT"');
}

const evals = [
    ['build smoke', evalBuildSmoke],
    ['fresh clone build', evalFreshCloneBuild],
    ['link integrity', evalLinkIntegrity],
    ['link checker negative', evalLinkCheckerNegative],
    ['validator negative', evalValidatorNegative],
    ['verifier negative', evalVerifierNegative],
    ['JSON API shape', evalJsonApiShape],
    ['config override', evalConfigOverride],
    ['parser fixtures', evalParserFixtures],
    ['HTML snapshots', evalHtmlSnapshots],
    ['MCP smoke', evalMcpSmoke],
    ['docs consistency', evalDocsConsistency]
];

let failed = 0;
for (const [name, fn] of evals) {
    if (!test(name, fn)) failed++;
}

if (failed > 0) {
    console.error(`\n${failed} eval(s) failed.`);
    process.exit(1);
}

console.log('\nAll evals passed.');
