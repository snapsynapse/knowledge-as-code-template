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

    for (const line of content.split('\n')) {
        if (line.startsWith('- id:')) {
            if (current) entries.push(current);
            current = { id: line.replace('- id:', '').trim(), obligations: [] };
        } else if (current) {
            const match = line.match(/^\s+(\w[\w_]*):\s*(.+)/);
            if (match && match[1] !== 'obligations') current[match[1]] = match[2].trim();
            const listMatch = line.match(/^\s+-\s+(.+)/);
            if (listMatch) current.obligations.push(listMatch[1].trim());
        }
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
