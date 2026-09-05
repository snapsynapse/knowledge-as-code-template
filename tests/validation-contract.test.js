'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
function copyProject(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-validation-contract-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const name of ['scripts', 'data', 'project.yml', 'package.json', 'mcp-server.js']) {
        fs.cpSync(path.join(ROOT, name), path.join(dir, name), { recursive: true });
    }
    return dir;
}
function run(dir, script) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KAC_')));
    return spawnSync(process.execPath, [script], {
        cwd: dir, encoding: 'utf8',
        env: { ...env, KAC_NOW: '2026-07-21T00:00:00Z' },
        input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_mappings', arguments: {} } }) + '\n'
    });
}
const commands = ['scripts/validate.js', 'scripts/build.js', 'scripts/verify.js', 'mcp-server.js'];
const cases = [
    ['unsafe mapping ID', text => text.replace('id: iso-27001-access-control', 'id: unsafe/id'), /unsafe ID/],
    ['wrong existing authority', text => text.replace('authority: iso', 'authority: nist'), /does not match container/],
    ['missing provision heading', text => text.replace('source_heading: Confidentiality and Access', 'source_heading: Missing provision'), /exactly one provision/],
    ['omitted provision heading', text => text.replace('  source_heading: Confidentiality and Access\n', ''), /requires "source_heading"/],
    ['heading without optional source_file', text => text.replace('  source_file: data/examples/frameworks/iso-27001.md\n', '').replace('source_heading: Confidentiality and Access', 'source_heading: Missing provision'), /exactly one provision/],
    ['wrong existing source_file', text => text.replace('source_file: data/examples/frameworks/iso-27001.md', 'source_file: data/examples/frameworks/nist-csf.md'), /source_file must identify container/],
    ['source outside project', text => text.replace('source_file: data/examples/frameworks/iso-27001.md', 'source_file: ../outside.md'), /source_file escapes/],
    ['unknown primary', text => text.replace('    - access-control', '    - missing-primary'), /unknown primary/],
    ['duplicate mapping ID', text => text.replace('id: iso-27001-information-integrity', 'id: iso-27001-access-control'), /Duplicate mapping ID/]
];
for (const [label, mutate, diagnostic] of cases) {
    test(`all source entry points reject ${label}`, t => {
        const dir = copyProject(t);
        const initial = run(dir, 'scripts/build.js');
        assert.equal(initial.status, 0, initial.stdout + initial.stderr);
        const output = path.join(dir, 'docs', 'api', 'v1', 'mappings.json');
        const before = fs.readFileSync(output, 'utf8');
        const mapping = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
        fs.writeFileSync(mapping, mutate(fs.readFileSync(mapping, 'utf8')));
        for (const command of commands) {
            const result = run(dir, command);
            assert.notEqual(result.status, 0, `${command} accepted ${label}`);
            assert.match(result.stdout + result.stderr, diagnostic, command);
            if (command === 'mcp-server.js') assert.equal(result.stdout, '', 'MCP must not expose invalid data');
        }
        assert.equal(fs.readFileSync(output, 'utf8'), before, 'rejected source must preserve existing build');
    });
}

test('source_file is optional when the provision exists in the mapped container', t => {
    const dir = copyProject(t);
    const mapping = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
    fs.writeFileSync(mapping, fs.readFileSync(mapping, 'utf8').replace(/^  source_file:.*\n/gm, ''));
    for (const command of commands) {
        const result = run(dir, command);
        assert.equal(result.status, 0, `${command}: ${result.stdout}${result.stderr}`);
    }
});

test('ambiguous provision headings fail across entry points', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'frameworks', 'iso-27001.md');
    fs.appendFileSync(file, '\n---\n\n## Confidentiality and Access\n\n| Property | Value |\n| --- | --- |\n| Obligation | access-control |\n\n');
    for (const command of commands) {
        const result = run(dir, command);
        assert.notEqual(result.status, 0, command);
        assert.match(result.stdout + result.stderr, /exactly one provision/, command);
    }
});

for (const output of ['alias', 'alias/site']) {
    test(`build rejects symlinked output ${output} before touching external files`, t => {
        const dir = copyProject(t);
        const external = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-build-external-'));
        t.after(() => fs.rmSync(external, { recursive: true, force: true }));
        const externalOutput = output.includes('/') ? path.join(external, 'site') : external;
        fs.mkdirSync(path.join(externalOutput, 'assets'), { recursive: true });
        const sentinel = path.join(externalOutput, 'assets', 'keep.txt');
        fs.writeFileSync(sentinel, 'preserve me');
        fs.symlinkSync(external, path.join(dir, 'alias'), 'dir');
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KAC_')));
        const result = spawnSync(process.execPath, ['scripts/build.js'], {
            cwd: dir, encoding: 'utf8', env: { ...env, KAC_OUTPUT_DIR: output }
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Refusing to clean unsafe output directory/);
        assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me');
    });
}

test('provision primary references are checked before output cleanup or MCP access', t => {
    for (const value of ['missing-primary', 'unsafe/id']) {
        const dir = copyProject(t);
        const file = path.join(dir, 'data', 'examples', 'frameworks', 'iso-27001.md');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('| Obligation | access-control |', `| Obligation | ${value} |`));
        for (const command of commands) {
            const result = run(dir, command);
            assert.notEqual(result.status, 0, command);
            assert.match(result.stdout + result.stderr, /unknown or unsafe primary/, command);
        }
    }
});

test('mapping primaries include the provision primary and preserve multiple-primary mappings', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.replace('    - access-control', '    - information-integrity'));
    for (const command of commands) {
        const result = run(dir, command);
        assert.notEqual(result.status, 0, command);
        assert.match(result.stdout + result.stderr, /obligations must include provision primary/, command);
    }
    fs.writeFileSync(file, original.replace('    - access-control', '    - access-control\n    - information-integrity'));
    for (const command of commands) {
        const result = run(dir, command);
        assert.equal(result.status, 0, `${command}: ${result.stdout}${result.stderr}`);
    }
    for (const page of [
        ['requires', 'iso-27001', 'information-integrity', 'index.html'],
        ['container', 'iso-27001', 'index.html']
    ]) {
        const html = fs.readFileSync(path.join(dir, 'docs', ...page), 'utf8');
        const card = html.match(/<div class="provision-card" id="confidentiality-and-access">([\s\S]*?)(?=<h4>|<div class="talking-point")/)[1];
        assert.match(card, /primary\/access-control\/index.html/);
        assert.match(card, /primary\/information-integrity\/index.html/);
    }
});

test('bridge provision counts match cards when mappings share a provision', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
    const original = fs.readFileSync(file, 'utf8');
    fs.appendFileSync(file, '\n' + original.split(/\n(?=- id:)/)[0].replace('id: iso-27001-access-control', 'id: another-mapping'));
    const result = run(dir, 'scripts/build.js');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const html = fs.readFileSync(path.join(dir, 'docs', 'requires', 'iso-27001', 'access-control', 'index.html'), 'utf8');
    assert.match(html, /Yes &mdash; 1 provision<\/p>/);
    assert.equal((html.match(/class="provision-card"/g) || []).length, 1);
    const structured = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.equal(structured.find(item => item['@type'] === 'QAPage').mainEntity.acceptedAnswer.text, 'Yes — 1 provision.');
});

test('verification counts every structural issue in its summary', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('authority: iso', 'authority: nist').replace('source_heading: Confidentiality and Access', 'source_heading: Missing provision'));
    const result = run(dir, 'scripts/verify.js');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /2 completeness issue\(s\) found/);
    assert.match(result.stdout, /REVIEW REQUIRED — 2 issue\(s\)/);
});

test('unmapped-container review warnings do not suppress the external review adapter', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split(/\n(?=- id:)/).filter(entry => !entry.includes('regulation: nist-csf')).join('\n'));
    const adapter = path.join(dir, 'review.js');
    fs.writeFileSync(adapter, `let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { for (const line of input.trim().split('\\n')) { const record = JSON.parse(line); console.log(JSON.stringify({ id: record.id, role: record.role, status: 'current', issues: [] })); } });`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KAC_')));
    const result = spawnSync(process.execPath, ['scripts/verify.js'], {
        cwd: dir, encoding: 'utf8',
        env: { ...env, KAC_NOW: '2026-07-21T00:00:00Z', KAC_VERIFY_COMMAND: process.execPath, KAC_VERIFY_ARGS: JSON.stringify([adapter]) }
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /has no mapping entries/);
    assert.match(result.stdout, /0 external review issue\(s\) found/);
    assert.doesNotMatch(result.stdout, /Skipped because source validation failed/);
});

test('all entry points reject a provision missing its required Obligation row', t => {
    const dir = copyProject(t);
    const file = path.join(dir, 'data', 'examples', 'frameworks', 'iso-27001.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('| Obligation | access-control |\n', ''));
    for (const command of commands) {
        const result = run(dir, command);
        assert.notEqual(result.status, 0, command);
        assert.match(result.stdout + result.stderr, /requires "Obligation"/, command);
    }
});

test('provision metadata at end of file is accepted without a following section', () => {
    const { parseProvisionSection } = require('../scripts/lib/data-loaders');
    const provision = parseProvisionSection('## Minimal\n\n| Property | Value |\n| --- | --- |\n| Obligation | access-control |');
    assert.equal(provision.obligation, 'access-control');
});
