'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { parseFrontmatter } = require('../scripts/lib/parsers');

const ROOT = path.join(__dirname, '..');
for (const document of ['data/_schema.md', 'CONTRIBUTING.md']) {
    test(`${document} YAML examples validate and build as documented`, t => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-doc-examples-'));
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        for (const file of ['scripts', 'data', 'project.yml']) {
            fs.cpSync(path.join(ROOT, file), path.join(dir, file), { recursive: true });
        }
        const prose = fs.readFileSync(path.join(ROOT, document), 'utf8');
        const examples = [...prose.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map(match => match[1]);
        assert.equal(examples.length, 4, 'Expected primary, container, authority, and mapping examples');
        for (const [index, directory, fallback] of [[0, 'requirements', 'access-control'], [1, 'frameworks', 'iso-27001'], [2, 'organizations', 'iso']]) {
            const example = examples[index];
            const id = parseFrontmatter(example).frontmatter.id || fallback;
            const file = path.join(dir, 'data', 'examples', directory, `${id}.md`);
            const body = fs.existsSync(file) ? parseFrontmatter(fs.readFileSync(file, 'utf8')).body : '## Summary\n\nWorked example.';
            fs.writeFileSync(file, `${example}\n\n${body}\n`.replace(/\n/g, '\r\n'));
        }
        // Use the literal documented mapping entry while preserving unrelated
        // worked mappings and their coverage. It refers to the ISO fixture.
        const mapping = path.join(dir, 'data', 'examples', 'mapping', 'index.yml');
        const remainder = fs.readFileSync(mapping, 'utf8').split(/\n(?=- id:)/).slice(1).join('\n');
        fs.writeFileSync(mapping, `${examples[3]}\n\n${remainder}`.replace(/\n/g, '\r\n'));
        for (const script of ['scripts/validate.js', 'scripts/build.js']) {
            const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('KAC_')));
            const result = spawnSync(process.execPath, [script], { cwd: dir, env, encoding: 'utf8' });
            assert.equal(result.status, 0, `${script}: ${result.stdout}${result.stderr}`);
        }
        assert.ok(fs.existsSync(path.join(dir, 'docs', 'requires', 'iso-27001', 'access-control', 'index.html')));
    });
}
