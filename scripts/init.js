#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const ROOT = path.join(__dirname, '..');

function usage() {
    console.log(`Usage:
  node scripts/init.js <directory> [options]

Options:
  --defaults                 Use starter defaults without prompting
  --name <name>              Human-readable site name
  --short-name <slug>        Lowercase project identifier
  --url <https-url>          Published site URL
  --repo <https-url>         Repository URL
  --primary <plural>         Stable concepts, such as Requirements
  --container <plural>       Changing collections, such as Frameworks
  --authority <plural>       Sources, such as Organizations
  --secondary <plural>       Mapping records, such as Provisions
  --help                     Show this message

The target directory must not already exist. The initializer never overwrites
files and does not run git, install packages, or publish anything.`);
}

function parseArgs(argv) {
    const options = {};
    const positionals = [];
    const valueFlags = new Map([
        ['--name', 'name'],
        ['--short-name', 'shortName'],
        ['--url', 'url'],
        ['--repo', 'repo'],
        ['--primary', 'primary'],
        ['--container', 'container'],
        ['--authority', 'authority'],
        ['--secondary', 'secondary']
    ]);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--defaults' || arg === '--yes') options.defaults = true;
        else if (valueFlags.has(arg)) {
            if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
                throw new Error(`${arg} requires a value.`);
            }
            options[valueFlags.get(arg)] = argv[++i];
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown option: ${arg}`);
        } else {
            positionals.push(arg);
        }
    }

    if (positionals.length > 1) throw new Error('Provide exactly one target directory.');
    options.target = positionals[0];
    return options;
}

function slugify(value) {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function singularize(value) {
    const word = String(value).trim();
    if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`;
    if (/sses$/i.test(word)) return word.slice(0, -2);
    if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
    return word;
}

function yamlString(value) {
    return JSON.stringify(String(value));
}

function validateSlug(value, label) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new Error(`${label} must be a lowercase slug using letters, numbers, and single hyphens.`);
    }
}

function validateHttps(value, label, allowExample = false) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error(`${label} must be a valid URL.`);
    }
    if (parsed.protocol !== 'https:') throw new Error(`${label} must use https.`);
    if (parsed.hostname.startsWith('www.')) throw new Error(`${label} must use the bare domain without www.`);
    if (!allowExample && parsed.hostname === 'example.com') return;
}

function replaceLine(text, pattern, replacement, label) {
    if (!pattern.test(text)) throw new Error(`Could not customize ${label} in project.yml.`);
    return text.replace(pattern, replacement);
}

function customizeConfig(values) {
    let config = fs.readFileSync(path.join(ROOT, 'project.yml'), 'utf8');
    config = replaceLine(config, /^name: .*$/m, `name: ${yamlString(values.name)}`, 'name');
    config = replaceLine(config, /^short_name: .*$/m, `short_name: ${yamlString(values.shortName)}`, 'short_name');
    config = replaceLine(config, /^url: .*$/m, `url: ${yamlString(values.url)}`, 'url');
    config = replaceLine(config, /^repo: .*$/m, `repo: ${yamlString(values.repo)}`, 'repo');
    config = replaceLine(config, /^description: .*$/m, `description: ${yamlString(`An evidence-backed reference generated from Git-tracked source files.`)}`, 'description');

    const roleValues = [
        ['primary', values.primary],
        ['container', values.container],
        ['authority', values.authority],
        ['secondary', values.secondary]
    ];
    for (const [role, plural] of roleValues) {
        const block = new RegExp(`(  ${role}:\\n(?:    [^\\n]*\\n)*?    name: )[^\\n]+(\\n    plural: )[^\\n]+`);
        if (!block.test(config)) throw new Error(`Could not customize ${role} entity labels.`);
        config = config.replace(block, `$1${singularize(plural)}$2${plural}`);
    }

    config = replaceLine(config, /(  - id: containers\n    label: )[^\n]+/, `$1${values.container}`, 'container navigation');
    config = replaceLine(config, /(  - id: primaries\n    label: )[^\n]+/, `$1${values.primary}`, 'primary navigation');
    config = config.replace(/\n  - id: pattern\n    label: Pattern\n    href: pattern\.html\n/, '\n');

    const patternSection = /# Pattern page[^\n]*\n# -+\npattern:\n[\s\S]*?(?=# -+\n# Social \/ Open Graph meta tags)/;
    if (!patternSection.test(config)) throw new Error('Could not simplify the pattern-page configuration.');
    config = config.replace(patternSection, `# Pattern page — disabled in generated projects\n# ---------------------------------------------------------------------------\npattern:\n  enabled: false\n  canonical_url: "https://knowledge-as-code.com/"\n\n`);

    const ecosystemSection = /# Ecosystem[^\n]*\n# -+\necosystem:[\s\S]*$/;
    if (!ecosystemSection.test(config)) throw new Error('Could not simplify the ecosystem configuration.');
    config = config.replace(ecosystemSection, '# Ecosystem — add related projects when useful\n# ---------------------------------------------------------------------------\necosystem: []\n');
    return config;
}

function starterReadme(values) {
    return `# ${values.name}

An evidence-backed structured reference generated with [Knowledge-as-Code](https://knowledge-as-code.com/).

## Who this is for

People and agents who need a maintained, source-readable reference for this domain.

## What problem it solves

This project keeps one Git-tracked source for its website, JSON API, discovery files, and optional local MCP interface.

## Canonical URL

${values.url}

## Start

\`\`\`bash
node scripts/validate.js
node scripts/build.js
node scripts/verify.js
\`\`\`

Open \`docs/index.html\` after building. To publish, set GitHub Pages to **GitHub Actions** and push to \`main\`.

## Edit the reference

- Configure entity names and presentation in \`project.yml\`.
- Replace the worked example under \`data/examples/\`.
- Follow \`data/_schema.md\` for record formats.
- Update \`last_verified\` only after reviewing the underlying evidence.

## Agent access

\`mcp-server.js\` provides a separate read-only MCP runtime over the same source files. See \`mcp.json\` for local configuration.

## License

MIT
`;
}

function starterPackage(values) {
    return `${JSON.stringify({
        name: values.shortName,
        version: '0.1.0',
        private: true,
        description: `Evidence-backed reference for ${values.name}.`,
        license: 'MIT',
        scripts: {
            build: 'node scripts/build.js',
            validate: 'node scripts/validate.js',
            verify: 'node scripts/verify.js',
            'check-links': 'node scripts/check-links.js'
        },
        engines: { node: '>=18' }
    }, null, 2)}\n`;
}

function starterCi() {
    return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: node scripts/validate.js
      - run: node scripts/build.js
      - run: node scripts/check-links.js
`;
}

function starterPages() {
    const source = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
    return source.replace("    if: github.repository != 'snapsynapse/knowledge-as-code-template'\n", '');
}

function copyFile(relativePath, stageDir, destination = relativePath) {
    const source = path.join(ROOT, relativePath);
    const target = path.join(stageDir, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

function copyDirectory(relativePath, stageDir, filter) {
    const source = path.join(ROOT, relativePath);
    const target = path.join(stageDir, relativePath);
    fs.cpSync(source, target, {
        recursive: true,
        filter: item => !filter || filter(path.relative(source, item))
    });
}

function starterScriptFilter(relativePath) {
    if (!relativePath) return true;
    const name = path.basename(relativePath);
    return name !== '.DS_Store' &&
        relativePath !== 'init.js' &&
        relativePath !== 'eval.js' &&
        relativePath !== 'validate-hashes.sh';
}

async function collectValues(options) {
    const targetBase = path.basename(path.resolve(options.target));
    const defaults = {
        name: targetBase.split(/[-_]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ') || 'My Knowledge Base',
        shortName: slugify(targetBase) || 'my-knowledge-base',
        url: 'https://example.com/',
        repo: `https://github.com/your-org/${slugify(targetBase) || 'my-knowledge-base'}`,
        primary: 'Requirements',
        container: 'Frameworks',
        authority: 'Organizations',
        secondary: 'Provisions'
    };

    if (options.defaults || !process.stdin.isTTY) return { ...defaults, ...options };

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (question, fallback) => (await rl.question(`${question} [${fallback}]: `)).trim() || fallback;
    try {
        return {
            ...options,
            name: options.name || await ask('Reference name', defaults.name),
            shortName: options.shortName || await ask('Project slug', defaults.shortName),
            url: options.url || await ask('Published https URL', defaults.url),
            repo: options.repo || await ask('Repository https URL', defaults.repo),
            primary: options.primary || await ask('Stable concepts are called', defaults.primary),
            container: options.container || await ask('Changing collections are called', defaults.container),
            authority: options.authority || await ask('Sources are called', defaults.authority),
            secondary: options.secondary || await ask('Mappings are called', defaults.secondary)
        };
    } finally {
        rl.close();
    }
}

function validateValues(values) {
    values.shortName = slugify(values.shortName);
    validateSlug(values.shortName, 'Project slug');
    validateHttps(values.url, 'Published URL', true);
    validateHttps(values.repo, 'Repository URL', true);
    for (const key of ['name', 'primary', 'container', 'authority', 'secondary']) {
        if (!String(values[key]).trim()) throw new Error(`${key} cannot be empty.`);
        values[key] = String(values[key]).trim();
    }
}

function generateProject(targetDir, values) {
    const parent = path.dirname(targetDir);
    fs.mkdirSync(parent, { recursive: true });
    const stageDir = path.join(parent, `.${path.basename(targetDir)}.kac-init-${process.pid}`);
    if (fs.existsSync(stageDir)) throw new Error(`Temporary initializer path already exists: ${stageDir}`);

    try {
        fs.mkdirSync(stageDir);
        copyDirectory('data', stageDir);
        copyDirectory('scripts', stageDir, starterScriptFilter);
        copyFile('mcp-server.js', stageDir);
        copyFile('mcp.json', stageDir);
        copyFile('LICENSE', stageDir);
        copyFile('.github/workflows/verify.yml', stageDir);

        fs.writeFileSync(path.join(stageDir, 'project.yml'), customizeConfig(values));
        fs.writeFileSync(path.join(stageDir, 'README.md'), starterReadme(values));
        fs.writeFileSync(path.join(stageDir, 'package.json'), starterPackage(values));
        fs.writeFileSync(path.join(stageDir, '.gitignore'), '.DS_Store\nnode_modules/\ndocs/\n');
        fs.writeFileSync(path.join(stageDir, '.github', 'workflows', 'ci.yml'), starterCi());
        fs.writeFileSync(path.join(stageDir, '.github', 'workflows', 'pages.yml'), starterPages());

        fs.renameSync(stageDir, targetDir);
    } catch (error) {
        fs.rmSync(stageDir, { recursive: true, force: true });
        throw error;
    }
}

async function main() {
    let options;
    try {
        options = parseArgs(process.argv.slice(2));
        if (options.help) {
            usage();
            return;
        }
        if (!options.target) throw new Error('A target directory is required.');

        const targetDir = path.resolve(process.cwd(), options.target);
        if (fs.existsSync(targetDir)) throw new Error(`Target already exists: ${targetDir}`);

        const values = await collectValues(options);
        validateValues(values);
        generateProject(targetDir, values);

        console.log(`Created ${values.name} in ${targetDir}`);
        console.log(`Next: cd ${path.relative(process.cwd(), targetDir) || '.'}`);
        console.log('      node scripts/validate.js');
        console.log('      node scripts/build.js');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    }
}

main();
