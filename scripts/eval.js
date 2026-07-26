#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadMappingIndex, parseTable } = require('./lib/data-loaders');
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

function snapshotTree(dir) {
    const snapshot = {};
    const visit = current => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) visit(full);
            else snapshot[path.relative(dir, full)] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        }
    };
    visit(dir);
    return snapshot;
}

function assertFile(filePath) {
    assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
}

function assertIncludes(haystack, needle, message) {
    assert.ok(haystack.includes(needle), message || `Expected output to include "${needle}"`);
}

function assertNoExecutableHtml(html, label) {
    assert.ok(!/<script>alert\(1\)<\/script>/i.test(html), `${label} should not contain raw script tags from source data.`);
    assert.ok(!/<img\s/i.test(html), `${label} should not contain raw image tags from source data.`);
    assert.ok(!/\s(?:onerror|onfocus|onmouseover)\s*=\s*["']/i.test(html), `${label} should not contain event-handler attributes from source data.`);
    assert.ok(!/<[^>]+\s(?:autofocus|formaction|srcdoc)(?:\s|=|>)/i.test(html), `${label} should not contain injected active attributes from source data.`);
    assert.ok(!/href="(?:javascript:|http:|\/\/)/i.test(html), `${label} should not contain unsafe href protocols.`);
}

function copyRepoToTemp(prefix) {
    const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    fs.cpSync(ROOT, tempRepo, {
        recursive: true,
        filter: source => {
            const rel = path.relative(ROOT, source);
            return rel !== '.git' && !rel.startsWith(`.git${path.sep}`) &&
                rel !== '.tmp-evals' && !rel.startsWith(`.tmp-evals${path.sep}`);
        }
    });
    return tempRepo;
}

function replaceInFile(filePath, search, replacement) {
    const original = fs.readFileSync(filePath, 'utf8');
    assert.ok(original.includes(search), `Expected ${filePath} to include fixture text: ${search}`);
    fs.writeFileSync(filePath, original.replace(search, replacement));
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

function buildTo(outputDir, siteUrl, extraEnv = {}) {
    const result = runNode(['scripts/build.js'], {
        env: {
            KAC_OUTPUT_DIR: outputDir,
            KAC_SITE_URL: siteUrl,
            ...extraEnv
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
        const notFound = fs.readFileSync(path.join(freshRoot, '404.html'), 'utf8');
        assert.strictEqual(agents.site.url, 'https://example.com/fresh-clone/');
        assert.strictEqual(apiIndex.meta.project, 'example');
        assert.ok(!fs.existsSync(path.join(freshRoot, 'CNAME')), 'Subpath builds should not emit CNAME without an explicit custom domain.');
        assertIncludes(notFound, 'href="/fresh-clone/assets/styles.css"');
        assertIncludes(notFound, 'href="/fresh-clone/containers.html"');
    });
}

function evalInitializerGoldenPath() {
    withTempRoot(() => {
        const target = path.join(TMP_ROOT, 'initialized-project');
        const initResult = runNode([
            'scripts/init.js', target, '--defaults',
            '--name', 'Policy Evidence Map',
            '--short-name', 'policy-evidence-map',
            '--url', 'https://policy.example.com/',
            '--repo', 'https://github.com/example/policy-evidence-map',
            '--primary', 'Controls',
            '--container', 'Policies',
            '--authority', 'Publishers',
            '--secondary', 'Claims'
        ]);
        assert.strictEqual(initResult.status, 0, `Initializer failed:\n${initResult.stdout}\n${initResult.stderr}`);

        const expectedFiles = [
            'README.md',
            'DEPLOYMENT.md',
            'project.yml',
            'package.json',
            'data/_schema.md',
            'scripts/build.js',
            'scripts/validate.js',
            'scripts/verify.js',
            'mcp-server.js',
            '.github/workflows/ci.yml',
            '.github/workflows/pages.yml',
            '.github/workflows/verify.yml'
        ];
        expectedFiles.forEach(file => assertFile(path.join(target, file)));
        assert.ok(!fs.existsSync(path.join(target, 'index.html')), 'Initialized project should not contain the canonical landing page.');
        assert.ok(!fs.existsSync(path.join(target, 'demo')), 'Initialized project should not contain canonical demo output.');
        assert.ok(!fs.existsSync(path.join(target, 'scripts', 'eval.js')), 'Initialized project should not copy canonical-repository evals.');
        assert.ok(!fs.existsSync(path.join(target, 'scripts', '.DS_Store')), 'Initialized project should not copy OS metadata.');

        const config = fs.readFileSync(path.join(target, 'project.yml'), 'utf8');
        assertIncludes(config, 'name: "Policy Evidence Map"');
        assertIncludes(config, 'name: Control\n    plural: Controls');
        assertIncludes(config, 'name: Policy\n    plural: Policies');
        assertIncludes(config, 'label: Policies');
        assertIncludes(config, 'label: Controls');
        assertIncludes(config, 'pattern:\n  enabled: false');
        assertIncludes(config, 'ecosystem: []');

        for (const command of [
            ['scripts/validate.js'],
            ['scripts/build.js'],
            ['scripts/verify.js'],
            ['scripts/check-links.js']
        ]) {
            const result = spawnSync(process.execPath, command, { cwd: target, encoding: 'utf8' });
            assert.strictEqual(result.status, 0, `Initialized project command failed (${command.join(' ')}):\n${result.stdout}\n${result.stderr}`);
        }
        assertFile(path.join(target, 'docs', 'index.html'));
        assertFile(path.join(target, 'docs', 'api', 'v1', 'index.json'));
        assert.ok(!fs.existsSync(path.join(target, 'docs', 'pattern.html')), 'Disabled pattern page should not be generated.');
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
            KAC_DATA_DIR: 'tests/fixtures/verify-negative',
            KAC_NOW: '2026-04-21T00:00:00Z'
        }
    });
    assert.strictEqual(result.status, 1, `Expected verifier to fail for stale fixture:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'STALE (1):');
    assertIncludes(result.stdout, '[Requirement] stale-requirement');
    assertIncludes(result.stdout, 'NEVER VERIFIED (1):');
    assertIncludes(result.stdout, '[Framework] unverified-framework');
    assertIncludes(result.stdout, 'Fresh: 2  |  Stale: 1  |  Never verified: 1  |  Invalid dates: 0');
    assertIncludes(result.stdout, 'All mappings valid and complete.');
    assertIncludes(result.stdout, 'Result: REVIEW REQUIRED');
}

function evalExternalVerifierContract() {
    withTempRoot(() => {
        const adapter = path.join(TMP_ROOT, 'external-verifier.js');
        fs.writeFileSync(adapter, [
            "'use strict';",
            "let input = '';",
            "process.stdin.setEncoding('utf8');",
            "process.stdin.on('data', chunk => { input += chunk; });",
            "process.stdin.on('end', () => {",
            "  for (const line of input.trim().split('\\n')) {",
            "    const entity = JSON.parse(line);",
            "    process.stdout.write(JSON.stringify({ id: entity.id, role: entity.role, status: 'current', issues: [] }) + '\\n');",
            "  }",
            "});"
        ].join('\n'));

        const result = runNode(['scripts/verify.js'], {
            env: {
                KAC_NOW: '2026-07-21T00:00:00Z',
                KAC_VERIFY_COMMAND: process.execPath,
                KAC_VERIFY_ARGS: JSON.stringify([adapter])
            }
        });
        assert.strictEqual(result.status, 0, `Expected external verifier contract to pass:\n${result.stdout}\n${result.stderr}`);
        assertIncludes(result.stdout, 'OK: container/iso-27001 — current');
        assertIncludes(result.stdout, '0 external review issue(s) found.');
    });
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
    assert.strictEqual(container.name, 'ISO/IEC 27001:2022');
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
    assert.strictEqual(mapping.source_heading, 'Confidentiality and Access');

    const comparison = comparisons.comparisons[0];
    assert.ok(comparison, 'Expected at least one comparison item');
    assert.deepStrictEqual(comparison.regulations, ['iso-27001', 'nist-csf']);
    assert.deepStrictEqual(comparison.shared_obligations, ['access-control']);
    assert.deepStrictEqual(comparison.only_a, ['information-integrity']);
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
        buildTo(outName, siteUrl, {
            KAC_REPO_URL: 'https://github.com/snapsynapse/knowledge-as-code-template'
        });

        const demoRoot = path.join(ROOT, outName);
        assertFile(path.join(demoRoot, 'assets/styles.css'));
        const containerPage = fs.readFileSync(path.join(demoRoot, 'container/iso-27001/index.html'), 'utf8');
        const sitemap = fs.readFileSync(path.join(demoRoot, 'sitemap.xml'), 'utf8');
        const agents = readJson(path.join(demoRoot, 'agents.json'));
        const notFound = fs.readFileSync(path.join(demoRoot, '404.html'), 'utf8');

        assertIncludes(containerPage, '<link rel="canonical" href="https://knowledge-as-code.com/demo/container/iso-27001/">');
        assertIncludes(sitemap, '<loc>https://knowledge-as-code.com/demo/container/iso-27001/</loc>');
        assert.strictEqual(agents.site.url, siteUrl);
        assert.strictEqual(agents.site.repo, 'https://github.com/snapsynapse/knowledge-as-code-template');
        assertIncludes(notFound, 'href="/demo/assets/styles.css"');
        assertIncludes(notFound, 'href="/demo/containers.html"');
        assert.ok(!fs.existsSync(path.join(demoRoot, 'CNAME')), 'Demo subpath build should not emit CNAME.');
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
    assert.strictEqual(advancedYaml.ecosystem[0].url, 'https://knowledge-as-code.com/');
    assert.strictEqual(advancedYaml.ecosystem[1].name, 'Agentlink');
    assert.strictEqual(advancedYaml.nav[1].label, 'Compare: Frameworks');
    assert.strictEqual(advancedYaml.bridges.applies_to.field, 'jurisdiction');
    assert.strictEqual(advancedYaml.theme.accent, '#123456');

    const projectYaml = parseYaml(fs.readFileSync(path.join(ROOT, 'project.yml'), 'utf8'));
    assert.strictEqual(projectYaml.social.og_image, '');
    assert.strictEqual(projectYaml.social.twitter_site, '');

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

    const table = parseTable([
        '| Requirement | Details | Notes |',
        '|-------------|---------|-------|',
        '| Keep left |  | keep right |'
    ].join('\n'));
    assert.strictEqual(table[0].requirement, 'Keep left');
    assert.strictEqual(table[0].details, '');
    assert.strictEqual(table[0].notes, 'keep right');
}

function evalOutputSanitization() {
    withTempRoot(() => {
        const outputDir = '.tmp-evals/sanitize';
        buildTo(outputDir, 'https://example.com/sanitize/');
        const root = path.join(ROOT, outputDir);
        const compare = fs.readFileSync(path.join(root, 'compare.html'), 'utf8');
        const container = fs.readFileSync(path.join(root, 'container/iso-27001/index.html'), 'utf8');

        assert.ok(compare.includes('function esc(s)'), 'Compare page should escape dynamic client-rendered labels.');
        assert.ok(compare.includes('encodeURIComponent(p)'), 'Compare page should encode dynamic href path segments.');
        assert.ok(compare.includes('var cmpData = '), 'Compare page should serialize comparison data.');
        assert.ok(container.includes('href="https://iso.org/standard/27001"'));

        const maliciousRepo = copyRepoToTemp('kac-malicious-fixture-');
        try {
            const maliciousPrimary = path.join(maliciousRepo, 'data', 'examples', 'requirements', 'access-control.md');
            replaceInFile(maliciousPrimary, 'name: Access Control', 'name: Access <script>alert(1)</script> Control');
            replaceInFile(maliciousPrimary, 'group: governance', 'group: governance" autofocus onfocus="alert(1)');
            replaceInFile(maliciousPrimary, 'Requirement to restrict system', '<img src=x onerror=alert(1)> Requirement to restrict system');

            const maliciousContainerSource = path.join(maliciousRepo, 'data', 'examples', 'frameworks', 'iso-27001.md');
            replaceInFile(maliciousContainerSource, 'official_url: https://iso.org/standard/27001', 'official_url: javascript:alert(1)');
            replaceInFile(maliciousContainerSource, '[ISO/IEC 27001:2022](https://iso.org/standard/27001)', '[ISO/IEC 27001:2022](http://iso.org/standard/27001)');

            const maliciousProject = path.join(maliciousRepo, 'project.yml');
            replaceInFile(maliciousProject, 'label: Home', 'label: Home <script>alert(1)</script>');
            replaceInFile(maliciousProject, 'href: index.html', 'href: index.html" onclick="alert(1)');
            replaceInFile(maliciousProject, '- name: governance', '- name: governance" autofocus onfocus="alert(1)');

            const maliciousBuild = spawnSync(process.execPath, ['scripts/build.js'], {
                cwd: maliciousRepo,
                encoding: 'utf8',
                env: { ...process.env, KAC_OUTPUT_DIR: 'poc-out' }
            });
            assert.strictEqual(maliciousBuild.status, 0, `Malicious fixture build failed:\n${maliciousBuild.stdout}\n${maliciousBuild.stderr}`);

            const maliciousContainer = fs.readFileSync(path.join(maliciousRepo, 'poc-out', 'container', 'iso-27001', 'index.html'), 'utf8');
            const maliciousPrimaryHtml = fs.readFileSync(path.join(maliciousRepo, 'poc-out', 'primary', 'access-control', 'index.html'), 'utf8');
            const maliciousIndex = fs.readFileSync(path.join(maliciousRepo, 'poc-out', 'index.html'), 'utf8');
            const coverageBadge = maliciousContainer.match(/class="group-badge [^"]+"/);
            assert.ok(coverageBadge, 'Malicious group should still render as one quoted class attribute.');
            assert.ok(coverageBadge[0].includes('governance-autofocus-onfocus-alert-1'), 'Malicious group should be normalized to a safe CSS class token.');
            assert.ok(maliciousIndex.includes('href="index.html"'), 'Unsafe nav href should fall back to a safe internal path.');
            assertNoExecutableHtml(maliciousContainer, 'container detail page');
            assertNoExecutableHtml(maliciousPrimaryHtml, 'primary detail page');
            assertNoExecutableHtml(maliciousIndex, 'homepage');
        } finally {
            fs.rmSync(maliciousRepo, { recursive: true, force: true });
        }
    });
}

function evalUnsafeOutputDirGuard() {
    for (const outputDir of ['.', '..']) {
        const result = runNode(['scripts/build.js'], {
            env: {
                KAC_OUTPUT_DIR: outputDir
            }
        });
        assert.notStrictEqual(result.status, 0, `Expected build to refuse unsafe KAC_OUTPUT_DIR=${outputDir}`);
        assertIncludes(result.stderr, 'Refusing to clean unsafe output directory');
    }
}

function evalGeneratedOutputCleanup() {
    withTempRoot(() => {
        const outName = '.tmp-evals/cleanup';
        const siteUrl = 'https://example.com/cleanup/';
        buildTo(outName, siteUrl);

        const outRoot = path.join(ROOT, outName);
        const staleOwnedFile = path.join(outRoot, 'container', 'stale-container', 'index.html');
        const customFile = path.join(outRoot, 'custom-note.txt');
        fs.mkdirSync(path.dirname(staleOwnedFile), { recursive: true });
        fs.writeFileSync(staleOwnedFile, '<!doctype html><title>stale</title>');
        fs.writeFileSync(customFile, 'custom file outside generator-owned paths');

        buildTo(outName, siteUrl);

        assert.ok(!fs.existsSync(staleOwnedFile), 'Build should remove stale files under generator-owned output paths.');
        assert.ok(fs.existsSync(customFile), 'Build should preserve unrelated files outside generator-owned output paths.');
    });
}

function evalFailedBuildPreservesOutput() {
    const repo = copyRepoToTemp('kac-output-preservation-');
    try {
        const output = path.join(repo, 'preserved-out');
        const initial = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...process.env, KAC_OUTPUT_DIR: 'preserved-out' }
        });
        assert.strictEqual(initial.status, 0, `Initial preservation build failed:\n${initial.stdout}\n${initial.stderr}`);
        const before = snapshotTree(output);

        const primary = path.join(repo, 'data', 'examples', 'requirements', 'access-control.md');
        replaceInFile(primary, 'group: governance', 'group: missing-group');
        const failed = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...process.env, KAC_OUTPUT_DIR: 'preserved-out' }
        });
        assert.notStrictEqual(failed.status, 0, 'Expected invalid data to fail before output cleanup.');
        assert.deepStrictEqual(snapshotTree(output), before, 'A failed build must leave the previously generated artifact byte-identical.');
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
}

function evalUnsafeIdNegative() {
    const unsafeRepo = copyRepoToTemp('kac-unsafe-id-fixture-');
    try {
        const oldPath = path.join(unsafeRepo, 'data', 'examples', 'requirements', 'access-control.md');
        const unsafePath = path.join(unsafeRepo, 'data', 'examples', 'requirements', 'bad"id.md');
        fs.renameSync(oldPath, unsafePath);

        const mappingPath = path.join(unsafeRepo, 'data', 'examples', 'mapping', 'index.yml');
        replaceInFile(mappingPath, '- access-control', '- bad"id');

        const validateResult = spawnSync(process.execPath, ['scripts/validate.js'], {
            cwd: unsafeRepo,
            encoding: 'utf8'
        });
        assert.strictEqual(validateResult.status, 1, `Expected unsafe ID fixture validation to fail:\n${validateResult.stdout}\n${validateResult.stderr}`);
        assertIncludes(validateResult.stderr, 'must be lowercase alphanumeric with single hyphens');

        const buildResult = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: unsafeRepo,
            encoding: 'utf8',
            env: { ...process.env, KAC_OUTPUT_DIR: 'unsafe-out' }
        });
        assert.notStrictEqual(buildResult.status, 0, `Expected unsafe ID fixture build to fail:\n${buildResult.stdout}\n${buildResult.stderr}`);
        assertIncludes(buildResult.stderr, 'must be lowercase alphanumeric with single hyphens');
    } finally {
        fs.rmSync(unsafeRepo, { recursive: true, force: true });
    }
}

function evalStatusContrastCss() {
    buildDefault();
    const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
    assertIncludes(html, '.status-badge.draft { background: #ff9800; color: #000; }');
    assertIncludes(html, ':is(html, body).light-mode .status-badge.draft { background: #e65100; color: #000; }');
}

function evalUrlPathStability() {
    buildDefault();
    const searchIndex = readJson(path.join(ROOT, 'docs', 'assets', 'data.json'));
    const sitemap = fs.readFileSync(path.join(ROOT, 'docs', 'sitemap.xml'), 'utf8');
    const agents = readJson(path.join(ROOT, 'docs', 'agents.json'));
    const matrix = fs.readFileSync(path.join(ROOT, 'docs', 'matrix.html'), 'utf8');

    assert.ok(searchIndex.some(item => item.href === 'container/iso-27001/index.html'), 'Search index should expose stable container hrefs.');
    assert.ok(searchIndex.some(item => item.href === 'primary/access-control/index.html'), 'Search index should expose stable primary hrefs.');
    assertIncludes(sitemap, '<loc>https://example.com/container/iso-27001/</loc>');
    assert.ok(agents.content.containers.some(item => item.url === 'https://example.com/container/iso-27001/'), 'agents.json should expose stable container URLs.');
    assertIncludes(matrix, 'href="requires/iso-27001/access-control/index.html"');
}

function evalUrlValidationAndCustomDomain() {
    for (const siteUrl of [
        'http://example.com/',
        'https://example.com/?query=1',
        'https://user:pass@example.com/',
        'https://example.com/#fragment'
    ]) {
        const result = runNode(['scripts/build.js'], {
            env: { KAC_OUTPUT_DIR: '.tmp-evals/invalid-url', KAC_SITE_URL: siteUrl }
        });
        assert.notStrictEqual(result.status, 0, `Expected invalid site URL to fail: ${siteUrl}`);
        assertIncludes(result.stderr, 'Published URL');
    }

    const repo = copyRepoToTemp('kac-custom-domain-fixture-');
    try {
        replaceInFile(
            path.join(repo, 'project.yml'),
            'custom_domain: ""',
            'custom_domain: "reference.example.org"'
        );
        const result = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...process.env, KAC_OUTPUT_DIR: 'custom-domain-out' }
        });
        assert.strictEqual(result.status, 0, `Custom-domain build failed:\n${result.stdout}\n${result.stderr}`);
        assert.strictEqual(fs.readFileSync(path.join(repo, 'custom-domain-out', 'CNAME'), 'utf8'), 'reference.example.org\n');

        replaceInFile(path.join(repo, 'project.yml'), 'custom_domain: "reference.example.org"', 'custom_domain: ""');
        const transition = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: repo,
            encoding: 'utf8',
            env: { ...process.env, KAC_OUTPUT_DIR: 'custom-domain-out' }
        });
        assert.strictEqual(transition.status, 0, `Custom-domain transition build failed:\n${transition.stdout}\n${transition.stderr}`);
        assert.ok(!fs.existsSync(path.join(repo, 'custom-domain-out', 'CNAME')), 'Disabling a custom domain should remove the stale CNAME.');
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }

    withTempRoot(() => {
        const outName = '.tmp-evals/url-edge';
        buildTo(outName, 'https://WWW.Example.COM//Catalog/%7Eteam');
        const outRoot = path.join(ROOT, outName);
        const sitemap = fs.readFileSync(path.join(outRoot, 'sitemap.xml'), 'utf8');
        const robots = fs.readFileSync(path.join(outRoot, 'robots.txt'), 'utf8');
        const feed = fs.readFileSync(path.join(outRoot, 'index.xml'), 'utf8');
        const notFound = fs.readFileSync(path.join(outRoot, '404.html'), 'utf8');
        const agents = readJson(path.join(outRoot, 'agents.json'));
        const expected = 'https://example.com/Catalog/%7Eteam/';
        assert.strictEqual(agents.site.url, expected);
        assertIncludes(sitemap, `${expected}container/iso-27001/`);
        assertIncludes(robots, `Sitemap: ${expected}sitemap.xml`);
        assertIncludes(feed, expected);
        assertIncludes(notFound, 'href="/Catalog/%7Eteam/assets/styles.css"');
    });
}

function evalMappingParserContract() {
    withTempRoot(() => {
        const cases = [
            ['missing-entry.yml', 'regulation: iso-27001\n', 'expected a mapping entry'],
            ['missing-id.yml', '- id:\n  regulation: iso-27001\n', 'requires a non-empty id'],
            ['unknown-key.yml', '- id: sample\n  regulaton: iso-27001\n', 'unsupported mapping key "regulaton"'],
            ['scalar-list.yml', '- id: sample\n  obligations: access-control\n', 'must be a YAML list'],
            ['duplicate-obligation.yml', '- id: sample\n  obligations:\n    - access-control\n    - access-control\n', 'duplicate obligation "access-control"']
        ];
        for (const [name, source, expected] of cases) {
            const fixture = path.join(TMP_ROOT, name);
            fs.writeFileSync(fixture, source);
            assert.throws(() => loadMappingIndex(fixture), error => error.message.includes(expected), `${name} should fail with "${expected}".`);
        }
    });
}

function evalIdentityAndDuplicateValidation() {
    const mismatchRepo = copyRepoToTemp('kac-id-mismatch-fixture-');
    try {
        const primary = path.join(mismatchRepo, 'data', 'examples', 'requirements', 'access-control.md');
        replaceInFile(primary, 'id: access-control', 'id: different-id');
        const result = spawnSync(process.execPath, ['scripts/validate.js'], {
            cwd: mismatchRepo,
            encoding: 'utf8'
        });
        assert.strictEqual(result.status, 1, `Expected ID mismatch to fail:\n${result.stdout}\n${result.stderr}`);
        assertIncludes(result.stderr, 'must match filename id "access-control"');
    } finally {
        fs.rmSync(mismatchRepo, { recursive: true, force: true });
    }

    const duplicateRepo = copyRepoToTemp('kac-duplicate-mapping-fixture-');
    try {
        const mapping = path.join(duplicateRepo, 'data', 'examples', 'mapping', 'index.yml');
        fs.appendFileSync(mapping, [
            '',
            '- id: iso-27001-access-control',
            '  regulation: iso-27001',
            '  authority: iso',
            '  obligations:',
            '    - access-control',
            ''
        ].join('\n'));
        const result = spawnSync(process.execPath, ['scripts/validate.js'], {
            cwd: duplicateRepo,
            encoding: 'utf8'
        });
        assert.strictEqual(result.status, 1, `Expected duplicate mapping to fail:\n${result.stdout}\n${result.stderr}`);
        assertIncludes(result.stderr, 'Duplicate mapping ID "iso-27001-access-control"');
    } finally {
        fs.rmSync(duplicateRepo, { recursive: true, force: true });
    }
}

function evalPublicSurface() {
    const landing = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    const demoFiles = [];
    const collect = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) collect(full);
            else if (!entry.name.startsWith('.')) demoFiles.push(full);
        }
    };
    collect(path.join(ROOT, 'demo'));
    const demoText = demoFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');

    assertIncludes(landing, '<link rel="canonical" href="https://knowledge-as-code.com/">');
    const jsonLdBlocks = [...landing.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(jsonLdBlocks.length > 0, 'Landing should include JSON-LD.');
    jsonLdBlocks.forEach(match => JSON.parse(match[1]));
    assertIncludes(robots, 'Sitemap: https://knowledge-as-code.com/demo/sitemap.xml');
    assert.ok(!/your-org|your-repo|https:\/\/example\.com/.test(demoText), 'Tracked demo should not contain placeholder identity URLs.');

    const landingIds = new Set([...landing.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
    for (const match of landing.matchAll(/href="([^"]+)"/g)) {
        const href = match[1];
        if (href.startsWith('#')) {
            assert.ok(landingIds.has(href.slice(1)), `Landing anchor should exist: ${href}`);
        } else if (href.startsWith('/')) {
            const target = href.split(/[?#]/)[0];
            const resolved = path.join(ROOT, target);
            const exists = fs.existsSync(resolved) || fs.existsSync(path.join(resolved, 'index.html'));
            assert.ok(exists, `Landing internal link should resolve: ${href}`);
        }
    }
}

function evalManifestFreshness() {
    const result = runCommand('./scripts/validate-hashes.sh', []);
    assert.strictEqual(result.status, 0, `Manifest hash verification failed:\n${result.stdout}\n${result.stderr}`);
    assertIncludes(result.stdout, 'All hashes verified.');
}

function evalChangelogReleaseTags() {
    const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const linkedVersions = [...changelog.matchAll(/^\[([0-9]+\.[0-9]+\.[0-9]+)\]:\s+https:\/\/github\.com\/snapsynapse\/knowledge-as-code-template\/releases\/tag\/v\1$/gm)]
        .map(match => `v${match[1]}`);
    assert.ok(linkedVersions.length > 0, 'Expected changelog to contain release tag links.');

    const result = runCommand('git', ['tag', '--list']);
    assert.strictEqual(result.status, 0, `Could not list local tags:\n${result.stdout}\n${result.stderr}`);
    const localTags = result.stdout.split(/\s+/).filter(Boolean);
    if (localTags.length === 0) return;

    for (const tag of linkedVersions) {
        assert.ok(localTags.includes(tag), `Changelog links ${tag}, but no matching local tag exists.`);
    }
}

function evalHtmlSnapshots() {
    buildDefault();
    const snapshots = [
        ['index.html', ['Updated <time datetime="2026-07-25">July 25, 2026</time>', 'Run a pilot', 'transitive runtime dependency tree']],
        ['docs/index.html', ['Example Knowledge Base', 'Coverage Matrix', 'JSON API']],
        ['docs/container/iso-27001/index.html', ['ISO/IEC 27001:2022', 'Provisions (2)', 'Official source']],
        ['docs/primary/access-control/index.html', ['Access Control', 'What Counts', 'Implementing Frameworks']],
        ['docs/requires/iso-27001/access-control/index.html', ['Does ISO/IEC 27001:2022 require Access Control?', 'View Framework', 'View Requirement']],
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
    assertIncludes(interactive.stdout, 'talking_point');
    assertIncludes(interactive.stdout, 'sources');
}

function evalMcpResponseShape() {
    const input = [
        { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_framework', arguments: { id: 'iso-27001' } } },
        { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_requirement', arguments: { id: 'missing-id' } } }
    ].map(message => JSON.stringify(message)).join('\n') + '\n';
    const result = spawnSync(process.execPath, ['mcp-server.js'], { cwd: ROOT, encoding: 'utf8', input });
    assert.strictEqual(result.status, 0, `MCP response-shape check failed:\n${result.stdout}\n${result.stderr}`);
    const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepStrictEqual(responses[0].result.tools.map(tool => tool.name), [
        'list_requirements', 'get_requirement', 'list_frameworks', 'get_framework',
        'list_organizations', 'get_organization', 'search', 'get_matrix', 'get_mappings'
    ]);
    const framework = JSON.parse(responses[1].result.content[0].text);
    for (const internal of ['_file', '_body', 'file', 'content']) {
        assert.ok(!Object.prototype.hasOwnProperty.call(framework, internal), `MCP entity response should not expose ${internal}.`);
    }
    assert.ok(framework.provisions.some(provision => provision.sources?.length && provision.talking_point));
    assert.strictEqual(responses[2].result.isError, true);
    const missing = JSON.parse(responses[2].result.content[0].text);
    assertIncludes(missing.error, 'not found: missing-id');
}

function evalGeneratedArtifactCleanliness() {
    const forbiddenNames = new Set(['.DS_Store', 'Thumbs.db', 'CNAME']);
    const tracked = runCommand('git', ['ls-files', '-z', 'demo']);
    assert.strictEqual(tracked.status, 0, `Could not enumerate tracked demo files:\n${tracked.stdout}\n${tracked.stderr}`);
    const files = tracked.stdout.split('\0').filter(Boolean).map(file => path.join(ROOT, file));
    for (const file of files) {
        assert.ok(!forbiddenNames.has(path.basename(file)), `Tracked demo contains forbidden artifact: ${path.relative(ROOT, file)}`);
        assert.ok(!/\.(tmp|bak|orig)$/.test(file), `Tracked demo contains a temporary artifact: ${path.relative(ROOT, file)}`);
        if (/\.(html|json|xml|txt)$/.test(file)) {
            const content = fs.readFileSync(file, 'utf8');
            assert.ok(!/your-org|your-repo|https:\/\/example\.com/.test(content), `Tracked demo contains placeholder identity: ${path.relative(ROOT, file)}`);
        }
    }
}

function evalWorkflowContract() {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
    for (const required of [
        "node: ['18', '20']",
        'KAC_OUTPUT_DIR: demo',
        'KAC_SITE_URL: https://knowledge-as-code.com/demo/',
        'KAC_REPO_URL: https://github.com/snapsynapse/knowledge-as-code-template',
        'Verify generated outputs are current',
        'Audit canonical root landing',
        'Audit canonical demo deployment'
    ]) assertIncludes(workflow, required);
}

function evalMcpNotificationSilence() {
    const notification = '{"jsonrpc":"2.0","method":"unknown","params":{}}\n';
    const result = spawnSync(process.execPath, ['mcp-server.js'], {
        cwd: ROOT,
        encoding: 'utf8',
        input: notification
    });
    assert.strictEqual(result.status, 0, `MCP notification check failed:\n${result.stdout}\n${result.stderr}`);
    assert.strictEqual(result.stdout, '', 'JSON-RPC notifications without id should not receive responses.');
}

function evalDocsConsistency() {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const buildWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
    const pagesWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
    const verification = fs.readFileSync(path.join(ROOT, 'VERIFICATION.md'), 'utf8');
    const verifyWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/verify.yml'), 'utf8');
    const intent = fs.readFileSync(path.join(ROOT, 'INTENT.md'), 'utf8');
    const maintenance = fs.readFileSync(path.join(ROOT, 'MAINTENANCE.md'), 'utf8');
    const adoption = fs.readFileSync(path.join(ROOT, 'ADOPTION.md'), 'utf8');
    const projectContext = fs.readFileSync(path.join(ROOT, 'PROJECT_CONTEXT.md'), 'utf8');
    const schema = fs.readFileSync(path.join(ROOT, 'data/_schema.md'), 'utf8');
    const deployment = fs.readFileSync(path.join(ROOT, 'DEPLOYMENT.md'), 'utf8');

    assertIncludes(readme, 'node scripts/init.js ../my-knowledge-base');
    assertIncludes(readme, '`docs/` is transient local output');
    assertIncludes(buildWorkflow, 'Build site (sanity check)');
    assertIncludes(pagesWorkflow, 'actions/deploy-pages@v4');
    assert.ok(!readme.includes('deploys to GitHub Pages automatically'), 'README should not claim automatic deployment.');
    assert.ok(!verification.includes('continue-on-error: true'), 'Verification docs should reflect current workflow implementation.');
    assertIncludes(verifyWorkflow, 'echo "exit_code=$?" >> "$GITHUB_OUTPUT"');
    assertIncludes(intent, 'internal-first open utility');
    assertIncludes(maintenance, 'The maintained public path is:');
    assertIncludes(adoption, 'One passing pilot establishes basic external transferability.');
    assertIncludes(projectContext, '`INTENT.md` is authoritative for current project status');
    assertIncludes(projectContext, 'That disposition is historical');
    assertIncludes(schema, '`regulation` and `obligations` are stable 1.x wire keys');
    assertIncludes(buildWorkflow, "node: ['18', '20']");
    assertIncludes(buildWorkflow, 'KAC_REPO_URL: https://github.com/snapsynapse/knowledge-as-code-template');
    assertIncludes(readme, '[Deployment profiles and environment overrides](DEPLOYMENT.md)');
    assertIncludes(deployment, '`KAC_LINK_BASE_PATH`');
    assertIncludes(maintenance, '`regulation` and `obligations`');
}

const evals = [
    ['build smoke', evalBuildSmoke],
    ['fresh clone build', evalFreshCloneBuild],
    ['initializer golden path', evalInitializerGoldenPath],
    ['link integrity', evalLinkIntegrity],
    ['link checker negative', evalLinkCheckerNegative],
    ['validator negative', evalValidatorNegative],
    ['verifier negative', evalVerifierNegative],
    ['external verifier contract', evalExternalVerifierContract],
    ['JSON API shape', evalJsonApiShape],
    ['config override', evalConfigOverride],
    ['parser fixtures', evalParserFixtures],
    ['output sanitization', evalOutputSanitization],
    ['unsafe output dir guard', evalUnsafeOutputDirGuard],
    ['generated output cleanup', evalGeneratedOutputCleanup],
    ['failed build preserves output', evalFailedBuildPreservesOutput],
    ['unsafe ID negative', evalUnsafeIdNegative],
    ['status contrast CSS', evalStatusContrastCss],
    ['URL path stability', evalUrlPathStability],
    ['URL validation and custom domain', evalUrlValidationAndCustomDomain],
    ['mapping parser contract', evalMappingParserContract],
    ['identity and duplicate validation', evalIdentityAndDuplicateValidation],
    ['public surface', evalPublicSurface],
    ['manifest freshness', evalManifestFreshness],
    ['changelog release tags', evalChangelogReleaseTags],
    ['HTML snapshots', evalHtmlSnapshots],
    ['MCP smoke', evalMcpSmoke],
    ['MCP response shape', evalMcpResponseShape],
    ['MCP notification silence', evalMcpNotificationSilence],
    ['generated artifact cleanliness', evalGeneratedArtifactCleanliness],
    ['workflow contract', evalWorkflowContract],
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
