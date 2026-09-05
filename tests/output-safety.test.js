'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
    assertSafeOutputDirectory,
    cleanGeneratedOutput
} = require('../scripts/lib/output-safety');

function tempDir(t, prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

const owned = {
    ownedDirs: ['assets'],
    ownedFiles: ['index.html']
};

test('cleans generated paths in a normal new repository child', t => {
    const repo = tempDir(t, 'kac-output-normal-');
    const output = path.join(repo, 'generated', 'site');

    cleanGeneratedOutput({ repoRoot: repo, outputDir: output, ...owned });

    assert.ok(fs.statSync(output).isDirectory());
});

test('cleans owned paths while preserving unrelated files in existing output', t => {
    const repo = tempDir(t, 'kac-output-existing-');
    const output = path.join(repo, 'docs');
    fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(output, 'assets', 'stale.css'), 'stale');
    fs.writeFileSync(path.join(output, 'index.html'), 'stale');
    fs.writeFileSync(path.join(output, 'keep.txt'), 'keep');

    cleanGeneratedOutput({ repoRoot: repo, outputDir: output, ...owned });

    assert.ok(!fs.existsSync(path.join(output, 'assets')));
    assert.ok(!fs.existsSync(path.join(output, 'index.html')));
    assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'keep');
});

test('rejects a symlinked output directory before touching its target', t => {
    const base = tempDir(t, 'kac-output-link-');
    const repo = path.join(base, 'repo');
    const external = path.join(base, 'external');
    fs.mkdirSync(path.join(external, 'assets'), { recursive: true });
    fs.mkdirSync(repo);
    const sentinel = path.join(external, 'assets', 'keep.txt');
    fs.writeFileSync(sentinel, 'keep');
    fs.symlinkSync(external, path.join(repo, 'docs'), 'dir');

    assert.throws(
        () => cleanGeneratedOutput({ repoRoot: repo, outputDir: path.join(repo, 'docs'), ...owned }),
        /Refusing to clean unsafe output directory:.*symbolic link/
    );
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
});

test('rejects a symlinked ancestor below the repository root before mutation', t => {
    const base = tempDir(t, 'kac-output-ancestor-link-');
    const repo = path.join(base, 'repo');
    const external = path.join(base, 'external');
    const externalOutput = path.join(external, 'site');
    fs.mkdirSync(path.join(externalOutput, 'assets'), { recursive: true });
    fs.mkdirSync(repo);
    const sentinel = path.join(externalOutput, 'assets', 'keep.txt');
    fs.writeFileSync(sentinel, 'keep');
    fs.symlinkSync(external, path.join(repo, 'generated'), 'dir');

    assert.throws(
        () => cleanGeneratedOutput({ repoRoot: repo, outputDir: path.join(repo, 'generated', 'site'), ...owned }),
        /Refusing to clean unsafe output directory:.*symbolic link/
    );
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
});

test('rejects the repository root and its parent', t => {
    const base = tempDir(t, 'kac-output-boundary-');
    const repo = path.join(base, 'repo');
    fs.mkdirSync(repo);

    assert.throws(() => assertSafeOutputDirectory(repo, repo), /Refusing to clean unsafe output directory/);
    assert.throws(() => assertSafeOutputDirectory(repo, base), /Refusing to clean unsafe output directory/);
});

test('allows a filesystem alias above the repository boundary', t => {
    const base = tempDir(t, 'kac-output-platform-alias-');
    const realParent = path.join(base, 'real');
    const aliasParent = path.join(base, 'alias');
    fs.mkdirSync(path.join(realParent, 'repo'), { recursive: true });
    fs.symlinkSync(realParent, aliasParent, 'dir');

    const repo = path.join(aliasParent, 'repo');
    const output = path.join(repo, 'docs');
    cleanGeneratedOutput({ repoRoot: repo, outputDir: output, ...owned });

    assert.ok(fs.statSync(path.join(realParent, 'repo', 'docs')).isDirectory());
});

test('link checker rejects a directory without index.html', t => {
    const docs = tempDir(t, 'kac-links-directory-');
    fs.mkdirSync(path.join(docs, 'missing'));
    fs.writeFileSync(path.join(docs, 'index.html'), '<a href="missing/">Missing</a>');

    const result = spawnSync(process.execPath, ['scripts/check-links.js'], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        env: { ...process.env, KAC_LINK_CHECK_DIR: docs }
    });

    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /missing\/index\.html \(not found\)/);
});

test('link checker accepts a directory containing index.html', t => {
    const docs = tempDir(t, 'kac-links-index-');
    fs.mkdirSync(path.join(docs, 'present'));
    fs.writeFileSync(path.join(docs, 'index.html'), '<a href="present/">Present</a>');
    fs.writeFileSync(path.join(docs, 'present', 'index.html'), '<p>Present</p>');

    const result = spawnSync(process.execPath, ['scripts/check-links.js'], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        env: { ...process.env, KAC_LINK_CHECK_DIR: docs }
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});
