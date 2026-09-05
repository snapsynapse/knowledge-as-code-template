'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const CLONE_URL = 'https://github.com/snapsynapse/knowledge-as-code-template.git';
const EXPECTED_COMMANDS = [
    `git clone ${CLONE_URL}`,
    'cd knowledge-as-code-template',
    'node scripts/init.js ../my-knowledge-base',
    'cd ../my-knowledge-base',
    'node scripts/validate.js',
    'node scripts/build.js',
    'node scripts/verify.js',
    'node scripts/check-links.js'
];

function decodeHtmlEntities(value) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
    return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|#39);/gi, (entity, name) => {
        if (name[0] !== '#') return named[name.toLowerCase()];
        const hex = name[1].toLowerCase() === 'x';
        return String.fromCodePoint(Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10));
    });
}

function extractQuickStartCommands() {
    const landing = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const match = landing.match(/<pre id=(["'])quick-start-commands\1>([\s\S]*?)<\/pre>/);
    assert.ok(match, 'index.html must expose the executable quick start as #quick-start-commands');

    const withoutKnownSpans = match[2]
        .replace(/<span class="c">/g, '')
        .replace(/<\/span>/g, '');
    assert.doesNotMatch(withoutKnownSpans, /<[^>]+>/, 'Quick start contains an unexpected HTML tag');

    const decoded = decodeHtmlEntities(withoutKnownSpans);
    assert.doesNotMatch(decoded, /&(?:#\w+|\w+);/, 'Quick start contains an unsupported HTML entity');
    return decoded.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}

function copyLocalCheckout(target) {
    const excluded = new Set(['.git', 'demo', 'docs', 'node_modules', '.tmp-evals']);
    fs.cpSync(ROOT, target, {
        recursive: true,
        filter(source) {
            const relative = path.relative(ROOT, source);
            return !relative || !excluded.has(relative.split(path.sep)[0]);
        }
    });
}

function cleanEnvironment() {
    return {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KAC_'))),
        KAC_NOW: '2026-07-21T00:00:00Z'
    };
}

function runDocumentedWorkflow(commands, sandbox) {
    let cwd = sandbox;
    const executed = [];

    for (const command of commands) {
        if (command === `git clone ${CLONE_URL}`) {
            copyLocalCheckout(path.join(cwd, 'knowledge-as-code-template'));
        } else if (command === 'cd knowledge-as-code-template' || command === 'cd ../my-knowledge-base') {
            const destination = path.resolve(cwd, command.slice(3));
            assert.ok(destination.startsWith(`${sandbox}${path.sep}`), `Documented cd escapes sandbox: ${command}`);
            assert.ok(fs.statSync(destination).isDirectory(), `Documented cd target does not exist: ${command}`);
            cwd = destination;
        } else if (command === 'node scripts/init.js ../my-knowledge-base') {
            const result = spawnSync(process.execPath, ['scripts/init.js', '../my-knowledge-base', '--defaults'], {
                cwd,
                env: cleanEnvironment(),
                encoding: 'utf8'
            });
            assert.equal(result.status, 0, `${command}: ${result.stdout}${result.stderr}`);
        } else {
            const scriptMatch = command.match(/^node (scripts\/(?:validate|build|verify|check-links)\.js)$/);
            assert.ok(scriptMatch, `Unexpected command in public quick start: ${command}`);
            const result = spawnSync(process.execPath, [scriptMatch[1]], {
                cwd,
                env: cleanEnvironment(),
                encoding: 'utf8'
            });
            assert.equal(result.status, 0, `${command}: ${result.stdout}${result.stderr}`);
        }
        executed.push(command);
    }

    return { cwd, executed };
}

function advertisedDiscoveryPaths() {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const section = readme.match(/## AI Agent Support\n([\s\S]*?)(?=\n## |$)/);
    assert.ok(section, 'README must contain its AI Agent Support section');
    return [...section[1].matchAll(/at `(docs\/[^`]+)`/g)].map(match => match[1]);
}

function migrationMappingExample() {
    const migration = fs.readFileSync(path.join(ROOT, 'MIGRATION.md'), 'utf8');
    const examples = [...migration.matchAll(/Literal\n```yaml\n([\s\S]*?)\n```/g)].map(match => match[1]);
    assert.equal(examples.length, 1, 'MIGRATION.md must contain one literal corrected YAML mapping');
    return examples[0];
}

function runNode(project, script, input) {
    return spawnSync(process.execPath, [script], {
        cwd: project,
        env: cleanEnvironment(),
        input,
        encoding: 'utf8'
    });
}

test('website quick start creates the complete advertised project without network or a shell', t => {
    const commands = extractQuickStartCommands();
    assert.deepEqual(commands, EXPECTED_COMMANDS, 'Public quick start commands or order changed');
    assert.ok(commands.indexOf('node scripts/validate.js') < commands.indexOf('node scripts/build.js'),
        'Quick start must validate source before building');
    assert.ok(commands.includes('node scripts/verify.js'), 'Quick start must check freshness');
    assert.ok(commands.includes('node scripts/check-links.js'), 'Quick start must check generated links');

    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-public-workflow-'));
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    const workflow = runDocumentedWorkflow(commands, sandbox);
    assert.deepEqual(workflow.executed, EXPECTED_COMMANDS);

    const project = path.join(sandbox, 'my-knowledge-base');
    assert.equal(workflow.cwd, project);
    const discoveryPaths = advertisedDiscoveryPaths();
    assert.deepEqual(discoveryPaths, [
        'docs/llms.txt',
        'docs/agents.json',
        'docs/index.xml',
        'docs/api/v1/'
    ]);
    for (const relative of discoveryPaths) {
        const output = path.join(project, relative);
        assert.ok(fs.existsSync(output), `Build did not create README-advertised path: ${relative}`);
        if (relative.endsWith('/')) {
            assert.ok(fs.statSync(output).isDirectory(), `${relative} must be a directory`);
            assert.ok(fs.existsSync(path.join(output, 'index.json')), `${relative} must expose index.json`);
        } else {
            assert.ok(fs.statSync(output).isFile(), `${relative} must be a file`);
        }
    }

    for (const guide of [
        'docs/assistant-guide.txt',
        'docs/.well-known/assistant-guide.txt',
        'docs/.well-known/assistant-guide-manifest.txt'
    ]) {
        assert.equal(fs.existsSync(path.join(project, guide)), false,
            `Initialized projects must not generate canonical-only guide artifact ${guide}`);
    }

    for (const runtimeFile of [
        'mcp-server.js',
        'scripts/lib/data-loaders.js',
        'scripts/lib/output-safety.js',
        'scripts/lib/parsers.js',
        'scripts/lib/urls.js',
        'scripts/lib/validation.js'
    ]) {
        assert.ok(fs.statSync(path.join(project, runtimeFile)).isFile(),
            `Initialized project is missing runtime file ${runtimeFile}`);
    }
    for (const canonicalOnlyFile of [
        'scripts/init.js',
        'scripts/eval.js',
        'scripts/validate-hashes.sh'
    ]) {
        assert.equal(fs.existsSync(path.join(project, canonicalOnlyFile)), false,
            `Initialized project must omit canonical-only runtime file ${canonicalOnlyFile}`);
    }

    const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' }
    }) + '\n';
    const mcp = spawnSync(process.execPath, ['mcp-server.js'], {
        cwd: project,
        env: cleanEnvironment(),
        input: request,
        encoding: 'utf8'
    });
    assert.equal(mcp.status, 0, mcp.stderr || mcp.stdout);
    const response = JSON.parse(mcp.stdout.trim());
    assert.equal(response.result.protocolVersion, '2024-11-05');
    assert.equal(response.result.serverInfo.name, 'My Knowledge Base');
});

test('literal migration mapping repairs every source-consuming entry point', t => {
    const corrected = migrationMappingExample();
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-migration-workflow-'));
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    const mcpRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' }
    }) + '\n';
    const variants = [
        {
            name: 'missing-source-heading',
            mapping: corrected.replace(/^  source_heading:.*\n/m, ''),
            diagnostic: /source_heading/
        },
        {
            name: 'wrong-authority',
            mapping: corrected.replace(/^  authority: iso$/m, '  authority: nist'),
            diagnostic: /authority/
        }
    ];

    for (const variant of variants) {
        const project = path.join(sandbox, variant.name);
        copyLocalCheckout(project);
        const mappingPath = path.join(project, 'data', 'examples', 'mapping', 'index.yml');
        const original = fs.readFileSync(mappingPath, 'utf8');
        const secondEntry = original.indexOf('\n\n- id:');
        assert.ok(secondEntry > 0, 'Canonical mapping fixture must contain multiple entries');
        const remainingMappings = original.slice(secondEntry + 2);
        fs.writeFileSync(mappingPath, `${variant.mapping.trimEnd()}\n\n${remainingMappings}`);

        for (const script of ['scripts/validate.js', 'scripts/build.js']) {
            const rejected = runNode(project, script);
            assert.notEqual(rejected.status, 0, `${script} accepted ${variant.name}`);
            assert.match(rejected.stdout + rejected.stderr, variant.diagnostic,
                `${script} did not explain ${variant.name}`);
        }
        assert.equal(fs.existsSync(path.join(project, 'docs')), false,
            `Rejected ${variant.name} build must not create generated output`);

        const rejectedMcp = runNode(project, 'mcp-server.js', mcpRequest);
        assert.notEqual(rejectedMcp.status, 0, `MCP accepted ${variant.name}`);
        assert.equal(rejectedMcp.stdout, '', `MCP exposed data for ${variant.name}`);
        assert.match(rejectedMcp.stderr, variant.diagnostic, `MCP did not explain ${variant.name}`);

        fs.writeFileSync(mappingPath, `${corrected.trimEnd()}\n\n${remainingMappings}`);
        assert.equal(fs.readFileSync(mappingPath, 'utf8').slice(corrected.trimEnd().length + 2), remainingMappings,
            'Applying the migration example must preserve unrelated mappings byte-for-byte');

        for (const script of [
            'scripts/validate.js',
            'scripts/build.js',
            'scripts/verify.js',
            'scripts/check-links.js'
        ]) {
            const accepted = runNode(project, script);
            assert.equal(accepted.status, 0, `${script} rejected repaired ${variant.name}: ${accepted.stdout}${accepted.stderr}`);
        }
        const acceptedMcp = runNode(project, 'mcp-server.js', mcpRequest);
        assert.equal(acceptedMcp.status, 0, `MCP rejected repaired ${variant.name}: ${acceptedMcp.stderr}`);
        assert.equal(JSON.parse(acceptedMcp.stdout.trim()).result.protocolVersion, '2024-11-05');
    }
});
