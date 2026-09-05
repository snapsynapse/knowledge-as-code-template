'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const rootGuidePath = path.join(ROOT, 'assistant-guide.txt');
const canonicalGuidePath = path.join(ROOT, '.well-known', 'assistant-guide.txt');
const manifestPath = path.join(ROOT, '.well-known', 'assistant-guide-manifest.txt');

function parseFields(text) {
    return Object.fromEntries(text.split('\n').filter(line => line.includes(':')).map(line => {
        const separator = line.indexOf(':');
        return [line.slice(0, separator), line.slice(separator + 1).trim()];
    }));
}

function parseActions(text) {
    return [...text.matchAll(/^\[action\]\n([\s\S]*?)^\[\/action\]$/gm)].map(match => parseFields(match[1]));
}

test('assistant guide copies and manifest identify the exact same bytes', () => {
    const rootGuide = fs.readFileSync(rootGuidePath);
    const canonicalGuide = fs.readFileSync(canonicalGuidePath);
    const metadataBlock = canonicalGuide.toString('utf8').match(/\[assistant-guide-metadata\]\n([\s\S]*?)\n\[\/assistant-guide-metadata\]/);
    assert.ok(metadataBlock, 'assistant guide metadata block is missing');
    const metadata = parseFields(metadataBlock[1]);
    const manifest = parseFields(fs.readFileSync(manifestPath, 'utf8'));

    assert.deepEqual(rootGuide, canonicalGuide);
    assert.match(metadata['guide-version'], /^\d+\.\d+\.\d+$/);
    assert.match(metadata['last-reviewed'], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(manifest['guide-version'], metadata['guide-version']);
    assert.equal(manifest['profile'], metadata.profile);
    assert.equal(manifest['profile-version'], metadata['profile-version']);
    assert.equal(manifest['canonical-url'], metadata['canonical-url']);
    assert.equal(manifest['repository-url'], metadata['repository-url']);
    assert.equal(manifest['guide-bytes'], String(canonicalGuide.byteLength));
    assert.equal(manifest['guide-sha256'], crypto.createHash('sha256').update(canonicalGuide).digest('hex'));
    assert.equal(manifest['released-at'], `${metadata['last-reviewed']}T00:00:00Z`);
    assert.equal(
        manifest['immutable-release-url'],
        `${metadata['repository-url']}/releases/tag/v${metadata['guide-version']}`
    );
});

test('guide action commands match the repository package scripts', () => {
    const guide = fs.readFileSync(canonicalGuidePath, 'utf8');
    const actions = Object.fromEntries(parseActions(guide).map(action => [action.id, action]));
    const packageScripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
    const packageActions = {
        'validate-cross-references': 'validate',
        'build-docs-output': 'build',
        'check-docs-links': 'check-links',
        'run-eval-suite': 'eval',
        'verify-freshness': 'verify'
    };

    for (const [id, script] of Object.entries(packageActions)) {
        assert.ok(packageScripts[script], `package script is missing: ${script}`);
        assert.equal(actions[id]?.command, `npm run ${script}`);
    }
    assert.equal(actions['verify-manifest-hashes']?.command, './scripts/validate-hashes.sh');
    const hashScript = fs.readFileSync(path.join(ROOT, 'scripts', 'validate-hashes.sh'));
    assert.equal(
        actions['verify-manifest-hashes']['exec-sha256'],
        crypto.createHash('sha256').update(hashScript).digest('hex')
    );
});

test('guide declares the bounded destructive effects implemented by build and eval', () => {
    const guide = fs.readFileSync(canonicalGuidePath, 'utf8');
    const actions = Object.fromEntries(parseActions(guide).map(action => [action.id, action]));
    const buildAction = actions['build-docs-output'];
    const evalAction = actions['run-eval-suite'];

    assert.deepEqual(new Set(buildAction.class.split(', ')), new Set([
        'code-executing', 'persistence-changing', 'destructive'
    ]));
    assert.deepEqual(new Set(evalAction.class.split(', ')), new Set([
        'code-executing', 'persistence-changing', 'data-accessing', 'destructive'
    ]));
    assert.equal(buildAction.approval, 'required');
    assert.equal(evalAction.approval, 'required');
    assert.match(buildAction.notes, /output-safety\.js.*generator-owned paths/);
    assert.match(evalAction.notes, /docs\/ owned paths.*\.tmp-evals\/.*os\.tmpdir\(\).*test projects/);
    assert.doesNotMatch(guide, /does not[^\n]*delete files/i);
    assert.doesNotMatch(guide, /no networked, destructive, or privileged actions/i);
    assert.doesNotMatch(guide, /Do not write outside the repository root\./);

    const buildSource = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');
    const safetySource = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'output-safety.js'), 'utf8');
    assert.match(buildSource, /require\('\.\/lib\/output-safety'\)/);
    assert.match(buildSource, /cleanOwnedGeneratedOutput/);
    assert.match(safetySource, /function assertSafeOutputDirectory/);
    assert.match(safetySource, /function cleanGeneratedOutput/);

    const evalSource = fs.readFileSync(path.join(ROOT, 'scripts', 'eval.js'), 'utf8');
    assert.match(evalSource, /const TMP_ROOT = path\.join\(ROOT, '\.tmp-evals'\)/);
    assert.match(evalSource, /fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\), prefix\)\)/);
    assert.match(evalSource, /fs\.rmSync\(TMP_ROOT/);
});
