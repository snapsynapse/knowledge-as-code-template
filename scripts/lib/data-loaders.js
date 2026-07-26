'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./parsers');

function isSafeId(id) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id || ''));
}

function assertSafeId(id, label = 'ID') {
    const value = String(id || '');
    if (!isSafeId(value)) {
        throw new Error(`${label} must be lowercase alphanumeric with single hyphens: ${value || '(empty)'}`);
    }
    return value;
}

function parseTable(tableText) {
    const lines = tableText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const parseCells = line => {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        return trimmed.split('|').map(c => c.trim());
    };
    const headers = parseCells(lines[0]);
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = parseCells(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h.toLowerCase().replace(/\s+/g, '_')] = cells[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

function loadMappingIndex(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = [];
    let current = null;
    let listKey = null;
    let seenKeys = new Set();
    const allowedKeys = new Set(['regulation', 'authority', 'source_file', 'source_heading', 'obligations']);

    const fail = (lineNumber, message) => {
        throw new Error(`${path.basename(filePath)}:${lineNumber}: ${message}`);
    };

    for (const [index, line] of content.split('\n').entries()) {
        const lineNumber = index + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const entryMatch = line.match(/^- id:\s*(.*)$/);
        if (entryMatch) {
            if (current) entries.push(current);
            const id = entryMatch[1].trim();
            if (!id) fail(lineNumber, 'mapping entry requires a non-empty id.');
            current = { id, obligations: [] };
            listKey = null;
            seenKeys = new Set();
            continue;
        }

        if (!current) fail(lineNumber, 'expected a mapping entry beginning with "- id:".');

        const listMatch = line.match(/^\s+-\s+(.+)$/);
        if (listMatch) {
            if (listKey !== 'obligations') fail(lineNumber, 'list items are only supported under "obligations".');
            const obligation = listMatch[1].trim();
            if (current.obligations.includes(obligation)) {
                fail(lineNumber, `duplicate obligation "${obligation}" in mapping "${current.id}".`);
            }
            current.obligations.push(obligation);
            continue;
        }

        const propertyMatch = line.match(/^\s+([a-z][a-z0-9_]*):\s*(.*)$/);
        if (!propertyMatch) fail(lineNumber, 'unsupported mapping syntax.');
        const [, key, rawValue] = propertyMatch;
        if (!allowedKeys.has(key)) fail(lineNumber, `unsupported mapping key "${key}".`);
        if (seenKeys.has(key)) fail(lineNumber, `duplicate key "${key}" in mapping "${current.id}".`);
        seenKeys.add(key);
        if (key === 'obligations') {
            if (rawValue.trim()) fail(lineNumber, '"obligations" must be a YAML list, not a scalar value.');
            listKey = 'obligations';
            continue;
        }
        const value = rawValue.trim();
        if (!value) fail(lineNumber, `"${key}" requires a value.`);
        current[key] = value;
        listKey = null;
    }
    if (current) entries.push(current);
    return entries;
}

function parseProvisionSection(section) {
    const trimmed = String(section || '').trim();
    const lines = trimmed.split('\n');
    const nameMatch = lines[0]?.match(/^## (.+)/);
    if (!nameMatch) return null;

    const provision = { name: nameMatch[1] };
    const propTableMatch = trimmed.match(/\| Property \| Value \|[\s\S]*?\n\n/);
    if (propTableMatch) {
        parseTable(propTableMatch[0]).forEach(item => {
            provision[item.property.toLowerCase().replace(/\s+/g, '_')] = item.value;
        });
    }

    for (const heading of ['Requirements', 'Penalties']) {
        const match = trimmed.match(new RegExp(`### ${heading}\\n\\n([\\s\\S]*?)(?=\\n###|\\n---|\\n## |$)`));
        if (match) provision[heading.toLowerCase()] = parseTable(match[1]);
    }

    const sourcesMatch = trimmed.match(/### Sources\n\n([\s\S]*?)(?=\n###|\n---|\n## |$)/);
    if (sourcesMatch) {
        provision.sources = (sourcesMatch[1].match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).map(source => {
            const match = source.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return match ? { title: match[1], url: match[2] } : null;
        }).filter(Boolean);
    }

    const talkingPointMatch = trimmed.match(/### Talking Point\n\n> "([^"]+)"/);
    if (talkingPointMatch) provision.talking_point = talkingPointMatch[1];
    return provision;
}

function loadEntityDirectory(dir, roleLabel = 'Entity') {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(file => file.endsWith('.md') && !file.startsWith('_'))
        .map(file => {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            const { frontmatter, body } = parseFrontmatter(content);
            const filenameId = assertSafeId(file.slice(0, -3), `${roleLabel} filename ${file}`);
            if (frontmatter.id && frontmatter.id !== filenameId) {
                throw new Error(`${roleLabel} ${file} frontmatter id "${frontmatter.id}" must match filename id "${filenameId}".`);
            }
            return {
                ...frontmatter,
                id: filenameId,
                file,
                content,
                _body: body,
                _file: file
            };
        });
}

function loadContainerDirectory(dir, roleLabel = 'Container') {
    return loadEntityDirectory(dir, roleLabel).map(entity => {
        const timelineMatch = entity._body.match(/## Timeline\n\n([\s\S]*?)(?=\n---|\n## )/);
        const provisionSections = entity._body.split(/\n---\n/).slice(1);
        return {
            ...entity,
            timeline: timelineMatch ? parseTable(timelineMatch[1]) : [],
            provisions: provisionSections.map(parseProvisionSection).filter(Boolean)
        };
    });
}

function findDataDir(projectRoot, configured) {
    const candidates = configured ? [configured] : ['data/examples', 'data'];
    for (const candidate of candidates) {
        const resolved = path.resolve(projectRoot, candidate);
        if (fs.existsSync(resolved)) return resolved;
    }
    return null;
}

function resolveMappingPath(dataDir, config, required = false) {
    const configured = config.mapping?.file || 'provisions/index.yml';
    const candidates = [
        path.join(dataDir, configured),
        path.join(dataDir, 'mapping', 'index.yml')
    ];
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (!found && required) {
        throw new Error(`Mapping file not found. Checked ${candidates.map(candidate => path.relative(process.cwd(), candidate)).join(' and ')}.`);
    }
    return found || candidates[0];
}

function loadProjectData(projectRoot, config, options = {}) {
    const dataDir = findDataDir(projectRoot, options.dataDir);
    if (!dataDir) throw new Error('No data directory found.');

    const primaryDir = path.join(dataDir, config.entities?.primary?.directory || 'primary');
    const containerDir = path.join(dataDir, config.entities?.container?.directory || 'container');
    const authorityDir = path.join(dataDir, config.entities?.authority?.directory || 'authority');
    const mappingPath = resolveMappingPath(dataDir, config, options.requireMapping !== false);

    return {
        dataDir,
        mappingPath,
        primaries: loadEntityDirectory(primaryDir, config.entities?.primary?.name || 'Primary'),
        containers: loadContainerDirectory(containerDir, config.entities?.container?.name || 'Container'),
        authorities: loadEntityDirectory(authorityDir, config.entities?.authority?.name || 'Authority'),
        mappings: loadMappingIndex(mappingPath)
    };
}

module.exports = {
    assertSafeId,
    findDataDir,
    isSafeId,
    loadContainerDirectory,
    loadEntityDirectory,
    loadMappingIndex,
    loadProjectData,
    parseProvisionSection,
    parseTable,
    resolveMappingPath
};
