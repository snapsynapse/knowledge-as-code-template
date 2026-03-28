#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — MCP Server
 * Zero-dependency Model Context Protocol server over JSON-RPC / stdio.
 *
 * Reads project.yml at startup and exposes entity data as MCP tools
 * with dynamic names derived from the configured ontology.
 *
 * Usage: node mcp-server.js   (called by MCP host via stdio)
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ---------------------------------------------------------------------------
// YAML-lite parser (copied from scripts/build.js)
// ---------------------------------------------------------------------------

function parseYaml(content) {
    const lines = content.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -2 }];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (raw.trim() === '' || raw.trim().startsWith('#')) continue;

        const indent = raw.search(/\S/);
        const trimmed = raw.trim();

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

        const isList = trimmed.startsWith('- ');
        const lineContent = isList ? trimmed.slice(2).trim() : trimmed;

        if (isList) {
            if (lineContent.startsWith('{') && lineContent.endsWith('}')) {
                const obj = {};
                lineContent.slice(1, -1).split(',').forEach(pair => {
                    const ci = pair.indexOf(':');
                    if (ci !== -1) obj[pair.slice(0, ci).trim()] = pair.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
                });
                const parent = stack[stack.length - 1].obj;
                const lastKey = stack[stack.length - 1].lastListKey;
                if (lastKey && Array.isArray(parent[lastKey])) parent[lastKey].push(obj);
                continue;
            }

            const ci = lineContent.indexOf(':');
            if (ci !== -1) {
                const k = lineContent.slice(0, ci).trim();
                const v = lineContent.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
                const nextI = i + 1;
                const hasChildren = nextI < lines.length &&
                    lines[nextI].trim() !== '' && !lines[nextI].trim().startsWith('#') &&
                    !lines[nextI].trim().startsWith('- ') &&
                    lines[nextI].search(/\S/) > indent;

                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;

                if (hasChildren || v === '') {
                    const obj = {};
                    if (v) obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) parent[listKey].push(obj);
                    stack.push({ obj, indent, lastListKey: null });
                } else {
                    const obj = {};
                    obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) parent[listKey].push(obj);
                }
            } else {
                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;
                if (listKey && Array.isArray(parent[listKey])) {
                    parent[listKey].push(lineContent.replace(/^["']|["']$/g, ''));
                }
            }
            continue;
        }

        const ci = trimmed.indexOf(':');
        if (ci === -1) continue;

        const key = trimmed.slice(0, ci).trim();
        const val = trimmed.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
        const parent = stack[stack.length - 1].obj;

        if (val === '') {
            const nextI = i + 1;
            let nextNonEmpty = null;
            for (let j = nextI; j < lines.length; j++) {
                if (lines[j].trim() && !lines[j].trim().startsWith('#')) { nextNonEmpty = lines[j].trim(); break; }
            }
            if (nextNonEmpty && nextNonEmpty.startsWith('- ')) {
                parent[key] = [];
                stack.push({ obj: parent, indent, lastListKey: key });
            } else {
                parent[key] = {};
                stack.push({ obj: parent[key], indent });
            }
        } else {
            parent[key] = val;
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Shared helpers (from scripts/build.js)
// ---------------------------------------------------------------------------

function slugify(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHTML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function humanizeId(id) {
    return String(id || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { frontmatter: {}, body: content };

    const frontmatter = {};
    let currentKey = null;
    let listValues = [];

    match[1].split('\n').forEach(line => {
        if (line.match(/^\s+-\s+/)) {
            if (currentKey) listValues.push(line.replace(/^\s+-\s+/, '').trim());
            return;
        }
        if (currentKey && listValues.length > 0) {
            frontmatter[currentKey] = listValues;
            listValues = [];
            currentKey = null;
        }
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            if (value === '') {
                currentKey = key.trim();
            } else {
                frontmatter[key.trim()] = value;
                currentKey = null;
            }
        }
    });
    if (currentKey && listValues.length > 0) {
        frontmatter[currentKey] = listValues;
    }
    return { frontmatter, body: content.slice(match[0].length).trim() };
}

function findDataDir() {
    const dirs = ['data/examples', 'data'];
    for (const base of dirs) {
        const fullBase = path.join(ROOT, base);
        if (fs.existsSync(fullBase)) return fullBase;
    }
    return path.join(ROOT, 'data');
}

function loadDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .map(f => {
            const content = fs.readFileSync(path.join(dir, f), 'utf-8');
            const { frontmatter, body } = parseFrontmatter(content);
            return { id: f.replace('.md', ''), ...frontmatter, _body: body };
        });
}

function parseTable(tableText) {
    const lines = tableText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        const row = {};
        headers.forEach((h, idx) => { row[h.toLowerCase().replace(/\s+/g, '_')] = cells[idx] || ''; });
        rows.push(row);
    }
    return rows;
}

function parseProvisionSection(section) {
    const trimmed = section.trim();
    const lines = trimmed.split('\n');
    const nameMatch = lines[0].match(/^## (.+)/);
    if (!nameMatch) return null;
    const provision = { name: nameMatch[1] };
    const propTableMatch = trimmed.match(/\| Property \| Value \|[\s\S]*?\n\n/);
    if (propTableMatch) {
        parseTable(propTableMatch[0]).forEach(p => {
            provision[p.property.toLowerCase().replace(/\s+/g, '_')] = p.value;
        });
    }
    const reqMatch = trimmed.match(/### Requirements\n\n([\s\S]*?)(?=\n###|\n---|\n## |$)/);
    if (reqMatch) provision.requirements = parseTable(reqMatch[1]);
    return provision;
}

function loadContainers(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .map(f => {
            const content = fs.readFileSync(path.join(dir, f), 'utf-8');
            const { frontmatter, body } = parseFrontmatter(content);
            const id = f.replace('.md', '');
            const timelineMatch = body.match(/## Timeline\n\n([\s\S]*?)(?=\n---|\n## )/);
            const timeline = timelineMatch ? parseTable(timelineMatch[1]) : [];
            const provisionSections = body.split(/\n---\n/).slice(1);
            const provisions = provisionSections.map(parseProvisionSection).filter(Boolean);
            return { id, ...frontmatter, timeline, provisions, _body: body };
        });
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

// ---------------------------------------------------------------------------
// Load project data
// ---------------------------------------------------------------------------

const config = (() => {
    const configPath = path.join(ROOT, 'project.yml');
    if (!fs.existsSync(configPath)) {
        process.stderr.write('Error: project.yml not found.\n');
        process.exit(1);
    }
    return parseYaml(fs.readFileSync(configPath, 'utf-8'));
})();

const dataDir = findDataDir();
const primaryDir = path.join(dataDir, config.entities?.primary?.directory || 'primary');
const containerDir = path.join(dataDir, config.entities?.container?.directory || 'container');
const authorityDir = path.join(dataDir, config.entities?.authority?.directory || 'authority');

const primaries = loadDir(primaryDir);
const containers = loadContainers(containerDir);
const authorities = loadDir(authorityDir);

const mappingFile = config.mapping?.file || 'provisions/index.yml';
let mappingPath = path.join(dataDir, mappingFile);
if (!fs.existsSync(mappingPath)) mappingPath = path.join(dataDir, 'mapping', 'index.yml');
const mappings = loadMappingIndex(mappingPath);

// ---------------------------------------------------------------------------
// Tool name derivation
// ---------------------------------------------------------------------------

const primaryName = slugify(config.entities?.primary?.name || 'primary');
const primaryPlural = slugify(config.entities?.primary?.plural || 'primaries');
const containerName = slugify(config.entities?.container?.name || 'container');
const containerPlural = slugify(config.entities?.container?.plural || 'containers');
const authorityName = slugify(config.entities?.authority?.name || 'authority');
const authorityPlural = slugify(config.entities?.authority?.plural || 'authorities');

// ---------------------------------------------------------------------------
// Boundary helper
// ---------------------------------------------------------------------------

function boundary(message, suggestions, why) {
    const b = { message, suggestions: suggestions || [] };
    if (why) b.why = why;
    return b;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function getToolDefinitions() {
    const pName = config.entities?.primary?.name || 'Primary';
    const pPlural = config.entities?.primary?.plural || 'Primaries';
    const cName = config.entities?.container?.name || 'Container';
    const cPlural = config.entities?.container?.plural || 'Containers';
    const aName = config.entities?.authority?.name || 'Authority';
    const aPlural = config.entities?.authority?.plural || 'Authorities';

    return [
        {
            name: `list_${primaryPlural}`,
            description: `List all ${pPlural.toLowerCase()} in the knowledge base. Returns id, title, and group for each.`,
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: `get_${primaryName}`,
            description: `Get a single ${pName.toLowerCase()} by its ID. Returns all frontmatter fields and body content.`,
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'string', description: `The ${pName.toLowerCase()} ID (filename without .md)` } },
                required: ['id']
            }
        },
        {
            name: `list_${containerPlural}`,
            description: `List all ${cPlural.toLowerCase()} in the knowledge base. Returns id, title, status, and authority.`,
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: `get_${containerName}`,
            description: `Get a single ${cName.toLowerCase()} by its ID. Returns frontmatter, timeline, and provisions.`,
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'string', description: `The ${cName.toLowerCase()} ID (filename without .md)` } },
                required: ['id']
            }
        },
        {
            name: `list_${authorityPlural}`,
            description: `List all ${aPlural.toLowerCase()} in the knowledge base.`,
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: `get_${authorityName}`,
            description: `Get a single ${aName.toLowerCase()} by its ID. Returns all frontmatter fields and body content.`,
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'string', description: `The ${aName.toLowerCase()} ID (filename without .md)` } },
                required: ['id']
            }
        },
        {
            name: 'search',
            description: 'Full-text search across all entities in the knowledge base. Searches titles, IDs, and body content.',
            inputSchema: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Search query (case-insensitive substring match)' } },
                required: ['query']
            }
        },
        {
            name: 'get_matrix',
            description: `Coverage matrix showing which ${pPlural.toLowerCase()} are addressed by which ${cPlural.toLowerCase()}.`,
            inputSchema: { type: 'object', properties: {}, required: [] }
        },
        {
            name: 'get_mappings',
            description: `All mapping entries connecting ${cPlural.toLowerCase()} to ${pPlural.toLowerCase()} via ${config.entities?.secondary?.plural?.toLowerCase() || 'secondaries'}.`,
            inputSchema: { type: 'object', properties: {}, required: [] }
        }
    ];
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

function handleToolCall(name, args) {
    // --- list primaries ---
    if (name === `list_${primaryPlural}`) {
        const items = primaries.map(p => ({ id: p.id, title: p.title || humanizeId(p.id), group: p.group || '' }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    }

    // --- get primary ---
    if (name === `get_${primaryName}`) {
        const entity = primaries.find(p => p.id === args.id);
        if (!entity) {
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    error: `${config.entities?.primary?.name || 'Primary'} not found: ${args.id}`,
                    boundary: boundary(
                        `No ${(config.entities?.primary?.name || 'primary').toLowerCase()} with id "${args.id}" exists.`,
                        [`Use list_${primaryPlural} to see available IDs`, 'Check spelling and use lowercase-hyphenated format'],
                        'IDs are derived from filenames in the data directory'
                    )
                }, null, 2) }],
                isError: true
            };
        }
        const { _body, ...rest } = entity;
        return { content: [{ type: 'text', text: JSON.stringify({ ...rest, body: _body }, null, 2) }] };
    }

    // --- list containers ---
    if (name === `list_${containerPlural}`) {
        const items = containers.map(c => ({ id: c.id, title: c.title || humanizeId(c.id), status: c.status || '', authority: c.authority || '' }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    }

    // --- get container ---
    if (name === `get_${containerName}`) {
        const entity = containers.find(c => c.id === args.id);
        if (!entity) {
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    error: `${config.entities?.container?.name || 'Container'} not found: ${args.id}`,
                    boundary: boundary(
                        `No ${(config.entities?.container?.name || 'container').toLowerCase()} with id "${args.id}" exists.`,
                        [`Use list_${containerPlural} to see available IDs`, 'Check spelling and use lowercase-hyphenated format'],
                        'IDs are derived from filenames in the data directory'
                    )
                }, null, 2) }],
                isError: true
            };
        }
        const { _body, ...rest } = entity;
        return { content: [{ type: 'text', text: JSON.stringify({ ...rest, body: _body }, null, 2) }] };
    }

    // --- list authorities ---
    if (name === `list_${authorityPlural}`) {
        const items = authorities.map(a => ({ id: a.id, title: a.title || humanizeId(a.id), type: a.type || '' }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    }

    // --- get authority ---
    if (name === `get_${authorityName}`) {
        const entity = authorities.find(a => a.id === args.id);
        if (!entity) {
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    error: `${config.entities?.authority?.name || 'Authority'} not found: ${args.id}`,
                    boundary: boundary(
                        `No ${(config.entities?.authority?.name || 'authority').toLowerCase()} with id "${args.id}" exists.`,
                        [`Use list_${authorityPlural} to see available IDs`, 'Check spelling and use lowercase-hyphenated format'],
                        'IDs are derived from filenames in the data directory'
                    )
                }, null, 2) }],
                isError: true
            };
        }
        const { _body, ...rest } = entity;
        return { content: [{ type: 'text', text: JSON.stringify({ ...rest, body: _body }, null, 2) }] };
    }

    // --- search ---
    if (name === 'search') {
        const q = (args.query || '').toLowerCase();
        if (!q) {
            return {
                content: [{ type: 'text', text: JSON.stringify({
                    error: 'Empty search query',
                    boundary: boundary('A non-empty query string is required.', ['Provide a keyword or phrase to search for'])
                }, null, 2) }],
                isError: true
            };
        }

        const results = [];
        const searchEntity = (entity, type) => {
            const haystack = [entity.id, entity.title || '', entity._body || ''].join(' ').toLowerCase();
            if (haystack.includes(q)) {
                results.push({ type, id: entity.id, title: entity.title || humanizeId(entity.id) });
            }
        };

        primaries.forEach(e => searchEntity(e, config.entities?.primary?.name || 'primary'));
        containers.forEach(e => searchEntity(e, config.entities?.container?.name || 'container'));
        authorities.forEach(e => searchEntity(e, config.entities?.authority?.name || 'authority'));

        return { content: [{ type: 'text', text: JSON.stringify({ query: args.query, count: results.length, results }, null, 2) }] };
    }

    // --- get_matrix ---
    if (name === 'get_matrix') {
        const matrix = {};
        for (const c of containers) {
            matrix[c.id] = {};
            for (const p of primaries) matrix[c.id][p.id] = false;
        }
        for (const m of mappings) {
            const cId = m.regulation || m.container || m.framework;
            if (cId && matrix[cId]) {
                for (const obl of (m.obligations || [])) {
                    if (matrix[cId][obl] !== undefined) matrix[cId][obl] = true;
                }
            }
        }
        return { content: [{ type: 'text', text: JSON.stringify(matrix, null, 2) }] };
    }

    // --- get_mappings ---
    if (name === 'get_mappings') {
        return { content: [{ type: 'text', text: JSON.stringify(mappings, null, 2) }] };
    }

    // --- unknown tool ---
    return {
        content: [{ type: 'text', text: JSON.stringify({
            error: `Unknown tool: ${name}`,
            boundary: boundary(
                `The tool "${name}" does not exist on this server.`,
                ['Use tools/list to see available tools'],
                'Tool names are derived from entity names in project.yml'
            )
        }, null, 2) }],
        isError: true
    };
}

// ---------------------------------------------------------------------------
// JSON-RPC / MCP protocol
// ---------------------------------------------------------------------------

function makeResponse(id, result) {
    return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message) {
    return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleMessage(msg) {
    const { id, method, params } = msg;

    if (method === 'initialize') {
        return makeResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
                name: config.name || 'Knowledge Base MCP',
                version: '1.0.0'
            }
        });
    }

    if (method === 'notifications/initialized') {
        return null; // notification, no response
    }

    if (method === 'tools/list') {
        return makeResponse(id, { tools: getToolDefinitions() });
    }

    if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const result = handleToolCall(toolName, toolArgs);
        return makeResponse(id, result);
    }

    return makeError(id, -32601, `Method not found: ${method}`);
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', chunk => {
    buffer += chunk;
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        try {
            const msg = JSON.parse(line);
            const response = handleMessage(msg);
            if (response) {
                process.stdout.write(response + '\n');
            }
        } catch (err) {
            const errResp = makeError(null, -32700, 'Parse error: ' + err.message);
            process.stdout.write(errResp + '\n');
        }
    }
});

process.stdin.on('end', () => process.exit(0));
