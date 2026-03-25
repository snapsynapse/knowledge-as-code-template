#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — Config-Driven Static Site Generator
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Reads project.yml for entity types, colors, and site config.
 * Generates: JSON API + full HTML site with detail and bridge pages.
 *
 * Usage: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const API_DIR = path.join(DOCS_DIR, 'api', 'v1');
const ASSETS_DIR = path.join(DOCS_DIR, 'assets');

// ---------------------------------------------------------------------------
// YAML-lite parser (handles project.yml without dependencies)
// ---------------------------------------------------------------------------

function parseYaml(content) {
    const lines = content.split('\n');
    const result = {};
    // Stack tracks: { obj, indent, key, isList }
    const stack = [{ obj: result, indent: -2 }];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (raw.trim() === '' || raw.trim().startsWith('#')) continue;

        const indent = raw.search(/\S/);
        const trimmed = raw.trim();

        // Pop stack back to appropriate parent
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

        const isList = trimmed.startsWith('- ');
        const lineContent = isList ? trimmed.slice(2).trim() : trimmed;

        if (isList) {
            // Inline object: - { key: val, key: val }
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

            // List item with key:value — start of a multi-line object or single-line
            const ci = lineContent.indexOf(':');
            if (ci !== -1) {
                const k = lineContent.slice(0, ci).trim();
                const v = lineContent.slice(ci + 1).trim().replace(/^["']|["']$/g, '');

                // Look ahead: are there continuation lines at deeper indent?
                const nextI = i + 1;
                const hasChildren = nextI < lines.length &&
                    lines[nextI].trim() !== '' && !lines[nextI].trim().startsWith('#') &&
                    !lines[nextI].trim().startsWith('- ') &&
                    lines[nextI].search(/\S/) > indent;

                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;

                if (hasChildren || v === '') {
                    // Multi-line list object: create obj, add first key, push for continuation
                    const obj = {};
                    if (v) obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) {
                        parent[listKey].push(obj);
                    }
                    stack.push({ obj, indent, lastListKey: null });
                } else {
                    // Single key:value list item — wrap as object
                    const obj = {};
                    obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) parent[listKey].push(obj);
                }
            } else {
                // Simple list item: - value
                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;
                if (listKey && Array.isArray(parent[listKey])) {
                    parent[listKey].push(lineContent.replace(/^["']|["']$/g, ''));
                }
            }
            continue;
        }

        // Regular key: value
        const ci = trimmed.indexOf(':');
        if (ci === -1) continue;

        const key = trimmed.slice(0, ci).trim();
        const val = trimmed.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
        const parent = stack[stack.length - 1].obj;

        if (val === '') {
            // Look ahead to determine if this is a list or object
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

function loadConfig() {
    const configPath = path.join(ROOT, 'project.yml');
    if (!fs.existsSync(configPath)) {
        console.error('Error: project.yml not found. See README.md for setup instructions.');
        process.exit(1);
    }
    return parseYaml(fs.readFileSync(configPath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Helpers
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

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function extractSection(body, heading) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = body.match(new RegExp(`## ${escaped}\\n\\n([\\s\\S]*?)(?=\\n## |$)`));
    return match ? match[1].trim() : '';
}

function parseBulletList(text) {
    return text.split('\n').map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2).trim());
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

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

    const penMatch = trimmed.match(/### Penalties\n\n([\s\S]*?)(?=\n###|\n---|\n## |$)/);
    if (penMatch) provision.penalties = parseTable(penMatch[1]);

    const srcMatch = trimmed.match(/### Sources\n\n([\s\S]*?)(?=\n###|\n---|\n## |$)/);
    if (srcMatch) {
        provision.sources = (srcMatch[1].match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).map(s => {
            const m = s.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return m ? { title: m[1], url: m[2] } : null;
        }).filter(Boolean);
    }

    const talkMatch = trimmed.match(/### Talking Point\n\n> "([^"]+)"/);
    if (talkMatch) provision.talking_point = talkMatch[1];

    return provision;
}

// ---------------------------------------------------------------------------
// Data loading (config-driven)
// ---------------------------------------------------------------------------

function findDataDir(config) {
    // Look for data in data/examples/ first, then data/ with config-specified directory names
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
            return { id: f.replace('.md', ''), ...frontmatter, _body: body, _file: f };
        });
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
            return { id, ...frontmatter, timeline, provisions, _body: body, _file: f };
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
// CSS generation from config
// ---------------------------------------------------------------------------

function generateConfigCSS(config) {
    const groups = config.entities?.primary?.groups || [];
    const statuses = config.entities?.container?.statuses || [];
    const theme = config.theme || {};

    let css = '/* Generated from project.yml — do not edit manually */\n';

    // Group colors
    groups.forEach(g => {
        const name = g.name || g;
        const color = g.color || '#888';
        const colorLight = g.color_light || color;
        css += `.group-badge.${name} { background: ${color}; }\n`;
        css += `:is(html, body).light-mode .group-badge.${name} { background: ${colorLight}; }\n`;
        css += `.matrix-table .matrix-row-header.group-${name} { border-left-color: ${color}; }\n`;
        css += `:is(html, body).light-mode .matrix-table .matrix-row-header.group-${name} { border-left-color: ${colorLight}; }\n`;
    });

    // Status colors
    statuses.forEach(s => {
        const name = s.name || s;
        const color = s.color || '#888';
        const colorLight = s.color_light || color;
        css += `.status-badge.${name} { background: ${color}; color: #000; }\n`;
        css += `:is(html, body).light-mode .status-badge.${name} { background: ${colorLight}; color: #fff; }\n`;
    });

    // Theme accent overrides
    if (theme.accent) {
        css += `:root { --accent: ${theme.accent}; }\n`;
    }
    if (theme.accent_light) {
        css += `:is(html, body).light-mode { --accent: ${theme.accent_light}; }\n`;
    }

    return css;
}

// ---------------------------------------------------------------------------
// Shared HTML renderers
// ---------------------------------------------------------------------------

function renderThemeInit() {
    return `<script>
        (function() {
            var params = new URLSearchParams(window.location.search);
            if (params.get('theme') === 'light' || localStorage.getItem('theme') === 'light') {
                document.documentElement.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
            }
        })();
    </script>`;
}

function renderThemeScript() {
    return `<script>
        function toggleTheme() {
            document.documentElement.classList.toggle('light-mode');
            localStorage.setItem('theme', document.documentElement.classList.contains('light-mode') ? 'light' : 'dark');
        }
        function toggleMobileMenu() {
            var btn = document.querySelector('.hamburger-btn');
            var menu = document.getElementById('siteNav');
            var isOpen = menu.classList.toggle('open');
            btn.classList.toggle('active', isOpen);
            btn.setAttribute('aria-expanded', isOpen);
        }
        document.addEventListener('click', function(e) {
            var menu = document.getElementById('siteNav');
            var btn = document.querySelector('.hamburger-btn');
            if (menu && btn && menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.remove('open');
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        function passTheme(link) {
            if (document.documentElement.classList.contains('light-mode')) {
                var url = new URL(link.href, window.location.href);
                url.searchParams.set('theme', 'light');
                link.href = url.pathname + url.search + url.hash;
            }
        }
        (function() {
            var btn = document.createElement('button');
            btn.className = 'back-to-top';
            btn.setAttribute('aria-label', 'Back to top');
            btn.textContent = '\\u2191';
            document.body.appendChild(btn);
            window.addEventListener('scroll', function() { btn.classList.toggle('visible', window.scrollY > 400); });
            btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
        })();
    </script>`;
}

function renderSiteNav(config, activePage, prefix) {
    prefix = prefix || '';
    const navItems = config.nav || [];
    const siteName = config.name || 'Knowledge Base';

    return `<a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
        <h1><a href="${prefix}index.html" onclick="passTheme(this)">${escapeHTML(siteName)}</a></h1>
        <button class="hamburger-btn" onclick="toggleMobileMenu()" aria-label="Toggle menu" aria-expanded="false" aria-controls="siteNav">
            <span class="hamburger-icon"></span>
        </button>
        <nav class="site-nav" id="siteNav" aria-label="Main navigation">
            ${navItems.map(item =>
                `<a href="${prefix}${item.href}" class="site-nav-link${item.id === activePage ? ' active' : ''}" onclick="passTheme(this)">${escapeHTML(item.label)}</a>`
            ).join('\n            ')}
        </nav>
        <div class="header-actions">
            <div class="site-search" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="searchResults">
                <input type="search" id="siteSearchInput" class="search-input" placeholder="Search..." aria-label="Search" aria-autocomplete="list" aria-controls="searchResults" autocomplete="off">
                <ul id="searchResults" class="search-results" role="listbox" hidden></ul>
            </div>
            <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode" aria-label="Toggle light/dark mode">&#x1F313;</button>
        </div>
    </header>`;
}

function renderFooter(config) {
    const repo = config.repo || '#';
    return `<footer>
        <p>Maintained with <a href="${escapeHTML(repo)}">version control</a>. This is a reference tool, not professional advice.</p>
        <p>&copy; ${new Date().getFullYear()} | Built with <a href="https://github.com/snapsynapse/knowledge-as-code-template">Knowledge-as-Code</a></p>
    </footer>`;
}

function renderPageShell(config, { title, activePage, prefix, content, description, canonicalPath, configCSS }) {
    prefix = prefix || '';
    const siteName = config.name || 'Knowledge Base';
    const siteUrl = config.url || '';
    const desc = description || config.description || '';
    const canonical = canonicalPath ? `<link rel="canonical" href="${siteUrl}${canonicalPath}">` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(title)} - ${escapeHTML(siteName)}</title>
    <meta name="theme-color" content="#1a1a2e">
    ${canonical}
    <link rel="stylesheet" href="${prefix}assets/styles.css">
    <style>${configCSS || ''}</style>
    <meta name="description" content="${escapeHTML(desc)}">
    <meta property="og:title" content="${escapeHTML(title)}">
    <meta property="og:description" content="${escapeHTML(desc)}">
    <meta property="og:type" content="website">
    ${renderThemeInit()}
</head>
<body>
    ${renderSiteNav(config, activePage, prefix)}
    <div class="container" id="main-content">
        ${content}
    </div>
    ${renderFooter(config)}
    <script src="${prefix}assets/search.js"></script>
    ${renderThemeScript()}
</body>
</html>`;
}

function renderBridgeShell(config, { title, depth, content, description, canonicalPath, structuredData, configCSS }) {
    const prefix = depth > 0 ? '../'.repeat(depth) : '';
    const siteUrl = config.url || '';
    const jsonLd = structuredData ? `\n    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(title)} - ${escapeHTML(config.name || '')}</title>
    <meta name="theme-color" content="#1a1a2e">
    <link rel="canonical" href="${siteUrl}${canonicalPath || ''}">
    <link rel="stylesheet" href="${prefix}assets/styles.css">
    <style>${configCSS || ''}</style>
    <meta name="description" content="${escapeHTML(description || '')}">
    <meta property="og:title" content="${escapeHTML(title)}">
    <meta property="og:description" content="${escapeHTML(description || '')}">
    <meta property="og:type" content="website">${jsonLd}
    ${renderThemeInit()}
</head>
<body>
    ${renderSiteNav(config, 'none', prefix)}
    <div class="container" id="main-content">
        ${content}
    </div>
    ${renderFooter(config)}
    <script src="${prefix}assets/search.js"></script>
    ${renderThemeScript()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Component renderers
// ---------------------------------------------------------------------------

function renderStatusBadge(status) {
    return `<span class="status-badge ${escapeHTML(status || '')}">${escapeHTML((status || 'unknown').replace(/-/g, ' '))}</span>`;
}

function renderGroupBadge(group) {
    return `<span class="group-badge ${escapeHTML(group || '')}">${escapeHTML(group || '')}</span>`;
}

function renderBreadcrumb(items, prefix) {
    return `<nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${prefix || ''}index.html" onclick="passTheme(this)">Home</a>
        ${items.map(item => `<span class="sep">/</span> ${item.href ? `<a href="${prefix || ''}${item.href}" onclick="passTheme(this)">${escapeHTML(item.label)}</a>` : `<span>${escapeHTML(item.label)}</span>`}`).join('\n        ')}
    </nav>`;
}

function renderProvisionCard(prov) {
    const reqRows = (prov.requirements || []).map(r => `<tr><td>${escapeHTML(r.requirement || '')}</td><td>${escapeHTML(r.details || '')}</td></tr>`).join('');
    const penRows = (prov.penalties || []).map(p => `<tr><td>${escapeHTML(p.violation || '')}</td><td>${escapeHTML(p.fine || '')}</td></tr>`).join('');
    const sources = (prov.sources || []).map(s => `<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.title)}</a>`).join(' ');

    return `<div class="provision-card" id="${slugify(prov.name)}">
        <h3>${escapeHTML(prov.name)}</h3>
        <div class="provision-meta">
            ${prov.obligation ? `<span><strong>Implements:</strong> <a href="../primary/${escapeHTML(prov.obligation)}/index.html" onclick="passTheme(this)">${escapeHTML(humanizeId(prov.obligation))}</a></span>` : ''}
            ${prov.status ? `<span>${renderStatusBadge(prov.status)}</span>` : ''}
            ${prov.effective ? `<span><strong>Effective:</strong> ${formatDate(prov.effective)}</span>` : ''}
        </div>
        ${prov.talking_point ? `<div class="talking-point">"${escapeHTML(prov.talking_point)}"</div>` : ''}
        ${reqRows ? `<h4>Requirements</h4><table class="data-table"><thead><tr><th>Requirement</th><th>Details</th></tr></thead><tbody>${reqRows}</tbody></table>` : ''}
        ${penRows ? `<h4>Penalties</h4><table class="data-table"><thead><tr><th>Violation</th><th>Fine</th></tr></thead><tbody>${penRows}</tbody></table>` : ''}
        ${sources ? `<div class="provision-sources"><strong>Sources:</strong> ${sources}</div>` : ''}
    </div>`;
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function generateHomepage(config, data, configCSS) {
    const { primaries, containers, authorities, totalProvisions, matrix } = data;
    const primaryName = config.entities?.primary?.plural || 'Primaries';
    const containerName = config.entities?.container?.plural || 'Containers';

    const content = `
        <h2 style="margin-top: 0.5rem;">${escapeHTML(config.name || 'Knowledge Base')}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${escapeHTML(config.description || '')}</p>

        <div class="stats-bar">
            <div class="stat-card"><span class="stat-number">${containers.length}</span><span class="stat-label">${escapeHTML(containerName)}</span></div>
            <div class="stat-card"><span class="stat-number">${primaries.length}</span><span class="stat-label">${escapeHTML(primaryName)}</span></div>
            <div class="stat-card"><span class="stat-number">${totalProvisions}</span><span class="stat-label">Provisions</span></div>
            <div class="stat-card"><span class="stat-number">${authorities.length}</span><span class="stat-label">${escapeHTML(config.entities?.authority?.plural || 'Authorities')}</span></div>
        </div>

        <h2>${escapeHTML(containerName)}</h2>
        <table class="data-table">
            <thead><tr><th>${escapeHTML(config.entities?.container?.name || 'Container')}</th><th>Scope</th><th>Status</th><th>Effective</th><th>Provisions</th></tr></thead>
            <tbody>
                ${containers.map(c => `<tr>
                    <td><a href="container/${c.id}/index.html" onclick="passTheme(this)">${escapeHTML(c.name)}</a></td>
                    <td>${escapeHTML(c.jurisdiction || '')}</td>
                    <td>${renderStatusBadge(c.status)}</td>
                    <td>${formatDate(c.effective)}</td>
                    <td>${c.provisions.length}</td>
                </tr>`).join('\n')}
            </tbody>
        </table>

        <h2>${escapeHTML(primaryName)}</h2>
        <div class="card-grid">
            ${primaries.map(p => {
                const regCount = Object.keys(matrix[p.id] || {}).length;
                const summary = p._body ? (p._body.match(/## Summary\n\n([^\n#]+)/) || [])[1]?.trim() || '' : '';
                return `<div class="obligation-card">
                    <div class="card-title"><a href="primary/${p.id}/index.html" onclick="passTheme(this)">${escapeHTML(p.name || humanizeId(p.id))}</a></div>
                    <div class="card-meta">${renderGroupBadge(p.group)} <span class="meta-item">${regCount} ${(config.entities?.container?.name || 'container').toLowerCase()}${regCount !== 1 ? 's' : ''}</span></div>
                    ${summary ? `<div class="card-description">${escapeHTML(summary)}</div>` : ''}
                </div>`;
            }).join('\n')}
        </div>

        <h2>Quick Links</h2>
        <div class="stats-bar">
            <div class="stat-card"><a href="matrix.html" onclick="passTheme(this)" style="text-decoration:none;color:inherit;"><span class="stat-number" style="font-size:1.5rem;">Grid</span><span class="stat-label">Coverage Matrix</span></a></div>
            <div class="stat-card"><a href="timeline.html" onclick="passTheme(this)" style="text-decoration:none;color:inherit;"><span class="stat-number" style="font-size:1.5rem;">Dates</span><span class="stat-label">Timeline</span></a></div>
            <div class="stat-card"><a href="compare.html" onclick="passTheme(this)" style="text-decoration:none;color:inherit;"><span class="stat-number" style="font-size:1.5rem;">vs</span><span class="stat-label">Compare</span></a></div>
            <div class="stat-card"><a href="api/v1/index.json" style="text-decoration:none;color:inherit;"><span class="stat-number" style="font-size:1.5rem;">API</span><span class="stat-label">JSON API</span></a></div>
        </div>
    `;

    return renderPageShell(config, { title: 'Home', activePage: 'home', content, canonicalPath: '', description: config.description, configCSS });
}

function generateContainersPage(config, data, configCSS) {
    const { containers } = data;
    const cName = config.entities?.container?.name || 'Container';
    const cPlural = config.entities?.container?.plural || 'Containers';
    const scopeField = config.entities?.container?.scope_field || 'jurisdiction';
    const scopes = [...new Set(containers.map(c => c[scopeField]).filter(Boolean))].sort();

    const content = `
        <h2 style="margin-top: 0.5rem;">${escapeHTML(cPlural)}</h2>
        <div class="filters">
            <div class="filter-group">
                <label for="scopeFilter">Scope</label>
                <select id="scopeFilter" onchange="filterItems()"><option value="">All</option>${scopes.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('')}</select>
            </div>
            <span class="result-count" id="itemCount"><strong>${containers.length}</strong> ${cPlural.toLowerCase()}</span>
        </div>
        <table class="data-table" id="itemTable">
            <thead><tr><th>${escapeHTML(cName)}</th><th>Scope</th><th>Status</th><th>Effective</th><th>Provisions</th></tr></thead>
            <tbody>
                ${containers.map(c => `<tr data-scope="${escapeHTML(c[scopeField] || '')}">
                    <td><a href="container/${c.id}/index.html" onclick="passTheme(this)">${escapeHTML(c.name)}</a></td>
                    <td>${escapeHTML(c[scopeField] || '')}</td>
                    <td>${renderStatusBadge(c.status)}</td>
                    <td>${formatDate(c.effective)}</td>
                    <td>${c.provisions.length}</td>
                </tr>`).join('\n')}
            </tbody>
        </table>
        <script>
        function filterItems() {
            var s = document.getElementById('scopeFilter').value;
            var rows = document.querySelectorAll('#itemTable tbody tr');
            var count = 0;
            rows.forEach(function(r) { var match = !s || r.dataset.scope === s; r.style.display = match ? '' : 'none'; if (match) count++; });
            document.getElementById('itemCount').innerHTML = '<strong>' + count + '</strong> ${cPlural.toLowerCase()}';
        }
        </script>
    `;

    return renderPageShell(config, { title: cPlural, activePage: 'containers', content, canonicalPath: 'containers.html', configCSS });
}

function generatePrimariesPage(config, data, configCSS) {
    const { primaries, matrix } = data;
    const pPlural = config.entities?.primary?.plural || 'Primaries';
    const groups = config.entities?.primary?.groups || [];
    const cNameLower = (config.entities?.container?.name || 'container').toLowerCase();

    const content = `
        <h2 style="margin-top: 0.5rem;">${escapeHTML(pPlural)}</h2>
        ${groups.map(g => {
            const groupName = g.name || g;
            const groupItems = primaries.filter(p => p.group === groupName);
            if (!groupItems.length) return '';
            return `<h3>${renderGroupBadge(groupName)} ${escapeHTML(humanizeId(groupName))}</h3>
            <div class="card-grid">
                ${groupItems.map(p => {
                    const regCount = Object.keys(matrix[p.id] || {}).length;
                    const summary = p._body ? (p._body.match(/## Summary\n\n([^\n#]+)/) || [])[1]?.trim() || '' : '';
                    return `<div class="obligation-card">
                        <div class="card-title"><a href="primary/${p.id}/index.html" onclick="passTheme(this)">${escapeHTML(p.name || humanizeId(p.id))}</a></div>
                        <div class="card-meta"><span class="meta-item">${regCount} ${cNameLower}${regCount !== 1 ? 's' : ''}</span></div>
                        ${summary ? `<div class="card-description">${escapeHTML(summary)}</div>` : ''}
                    </div>`;
                }).join('\n')}
            </div>`;
        }).join('\n')}
    `;

    return renderPageShell(config, { title: pPlural, activePage: 'primaries', content, canonicalPath: 'primaries.html', configCSS });
}

function generateMatrixPage(config, data, configCSS) {
    const { primaries, containers, matrix } = data;
    const pName = config.entities?.primary?.name || 'Primary';

    const headerCells = containers.map(c => `<th><a href="container/${c.id}/index.html" onclick="passTheme(this)" title="${escapeHTML(c.name)}">${escapeHTML(c.jurisdiction || c.id)}</a></th>`).join('');

    const rows = primaries.map(p => {
        const pLabel = p.name || humanizeId(p.id);
        const cells = containers.map(c => {
            const entry = (matrix[p.id] || {})[c.id];
            if (entry && entry.covered) {
                const n = entry.provisions.length;
                return `<td class="matrix-cell covered" title="${escapeHTML(pLabel)} — ${escapeHTML(c.name)}: ${n}"><a href="requires/${c.id}/${p.id}/index.html" onclick="passTheme(this)" style="color:inherit;text-decoration:none;">${n}</a></td>`;
            }
            return `<td class="matrix-cell empty">&mdash;</td>`;
        }).join('');
        return `<tr><td class="matrix-row-header group-${p.group || 'other'}"><a href="primary/${p.id}/index.html" onclick="passTheme(this)" style="color:inherit;">${escapeHTML(pLabel)}</a></td>${cells}</tr>`;
    }).join('\n');

    const content = `
        <h2 style="margin-top: 0.5rem;">Coverage Matrix</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Which ${(config.entities?.container?.plural || 'containers').toLowerCase()} cover which ${(config.entities?.primary?.plural || 'primaries').toLowerCase()}. Green cells link to details.</p>
        <div class="matrix-wrapper">
            <table class="matrix-table">
                <thead><tr><th class="matrix-corner">${escapeHTML(pName)}</th>${headerCells}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    return renderPageShell(config, { title: 'Coverage Matrix', activePage: 'matrix', content, canonicalPath: 'matrix.html', configCSS });
}

function generateTimelinePage(config, data, configCSS) {
    const { containers } = data;
    const today = new Date().toISOString().split('T')[0];
    const scopeField = config.entities?.container?.scope_field || 'jurisdiction';
    const events = [];

    for (const c of containers) {
        for (const t of c.timeline) {
            if (t.date) events.push({ date: t.date, milestone: t.milestone || t.notes || '', container: c.name, containerId: c.id, scope: c[scopeField] });
        }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    const byYear = {};
    for (const ev of events) { const y = ev.date.slice(0, 4); (byYear[y] = byYear[y] || []).push(ev); }

    const html = Object.keys(byYear).sort().map(year =>
        `<div class="timeline-year">${year}</div>\n` +
        byYear[year].map(ev => `<div class="timeline-entry ${ev.date <= today ? 'past' : 'future'}">
            <div class="timeline-date">${formatDate(ev.date)}</div>
            <div class="timeline-content">
                <a href="container/${ev.containerId}/index.html" onclick="passTheme(this)" class="timeline-regulation">${escapeHTML(ev.container)}</a>
                <span class="timeline-milestone">${escapeHTML(ev.milestone)}</span>
                <span class="timeline-jurisdiction">${escapeHTML(ev.scope || '')}</span>
            </div>
        </div>`).join('\n')
    ).join('\n');

    const content = `<h2 style="margin-top: 0.5rem;">Timeline</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Key dates. Solid dots are past; hollow dots are future.</p>
        <div class="timeline">${html}</div>`;

    return renderPageShell(config, { title: 'Timeline', activePage: 'timeline', content, canonicalPath: 'timeline.html', configCSS });
}

function generateComparePage(config, data, configCSS) {
    const { containers, primaries, mappingIndex } = data;
    const cName = config.entities?.container?.name || 'Container';
    const cPlural = config.entities?.container?.plural || 'Containers';

    const checkboxes = containers.map(c => `<label><input type="checkbox" name="cmp" value="${escapeHTML(c.id)}" onchange="updateComparison()"> <span>${escapeHTML(c.name)}</span></label>`).join('\n');

    const content = `
        <h2 style="margin-top: 0.5rem;">Compare ${escapeHTML(cPlural)}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Select 2 or 3 to compare coverage.</p>
        <div class="compare-selector" id="compareSelector">${checkboxes}</div>
        <div id="compareResult" class="compare-result"></div>
        <script>
        var cmpData = ${JSON.stringify(containers.map(c => ({ id: c.id, name: c.name, primaries: [...new Set(mappingIndex.filter(m => m.regulation === c.id).flatMap(m => m.obligations))] })))};
        var pNames = ${JSON.stringify(Object.fromEntries(primaries.map(p => [p.id, p.name || humanizeId(p.id)])))};
        function updateComparison() {
            var checked = Array.from(document.querySelectorAll('#compareSelector input:checked'));
            if (checked.length > 3) { checked[0].checked = false; checked = checked.slice(1); }
            var sel = checked.map(function(cb) { return cb.value; });
            if (sel.length < 2) { document.getElementById('compareResult').innerHTML = '<p style="color:var(--text-secondary);">Select at least 2.</p>'; return; }
            var items = sel.map(function(id) { return cmpData.find(function(c) { return c.id === id; }); });
            var all = new Set(); items.forEach(function(i) { i.primaries.forEach(function(p) { all.add(p); }); });
            var shared = [], unique = {}; items.forEach(function(i) { unique[i.id] = []; });
            all.forEach(function(p) {
                var has = items.filter(function(i) { return i.primaries.indexOf(p) !== -1; });
                if (has.length === items.length) shared.push(p);
                else has.forEach(function(i) { unique[i.id].push(p); });
            });
            var html = '<div class="compare-section"><h3>Shared (' + shared.length + ')</h3>' +
                (shared.length ? '<ul class="compare-list">' + shared.map(function(p) { return '<li><a href="primary/' + p + '/index.html">' + (pNames[p]||p) + '</a></li>'; }).join('') + '</ul>' : '<p style="color:var(--text-secondary);">None shared.</p>') + '</div>';
            items.forEach(function(i) {
                var u = unique[i.id];
                html += '<div class="compare-section"><h3>Only in ' + i.name + ' (' + u.length + ')</h3>' +
                    (u.length ? '<ul class="compare-list">' + u.map(function(p) { return '<li><a href="primary/' + p + '/index.html">' + (pNames[p]||p) + '</a></li>'; }).join('') + '</ul>' : '<p style="color:var(--text-secondary);">None unique.</p>') + '</div>';
            });
            document.getElementById('compareResult').innerHTML = html;
            var url = new URL(window.location); url.searchParams.set('items', sel.join(',')); history.replaceState(null, '', url);
        }
        (function() { var p = new URLSearchParams(window.location.search); var ids = (p.get('items')||'').split(',').filter(Boolean);
            if (ids.length) { ids.forEach(function(id) { var cb = document.querySelector('#compareSelector input[value="'+id+'"]'); if (cb) cb.checked = true; }); updateComparison(); }
        })();
        </script>
    `;

    return renderPageShell(config, { title: 'Compare', activePage: 'compare', content, canonicalPath: 'compare.html', configCSS });
}

function generateAboutPage(config, data, configCSS) {
    const { primaries, containers, authorities, totalProvisions } = data;
    const pName = config.entities?.primary?.name || 'Primary';
    const pPlural = config.entities?.primary?.plural || 'Primaries';
    const cName = config.entities?.container?.name || 'Container';
    const cPlural = config.entities?.container?.plural || 'Containers';
    const secName = config.entities?.secondary?.name || 'Provision';
    const authName = config.entities?.authority?.name || 'Authority';
    const rel = config.entities?.secondary?.relationship || 'implements';

    const content = `<div class="about-content">
        <h2 style="margin-top: 0.5rem;">About</h2>
        <p>${escapeHTML(config.description || '')} Tracks <strong>${containers.length} ${cPlural.toLowerCase()}</strong>, <strong>${primaries.length} ${pPlural.toLowerCase()}</strong>, <strong>${totalProvisions} ${secName.toLowerCase()}s</strong>, and <strong>${authorities.length} ${authName.toLowerCase()}${authorities.length !== 1 ? 's' : ''}</strong>.</p>
        <h3>Data Model</h3>
        <p><strong>${escapeHTML(authName)}</strong> &rarr; <strong>${escapeHTML(cName)}</strong> &rarr; <strong>${escapeHTML(secName)}</strong> &rarr; <strong>${escapeHTML(pName)}</strong></p>
        <p>${escapeHTML(pPlural)} are the stable anchors. ${escapeHTML(secName)}s are the implementations — different ${cPlural.toLowerCase()} ${rel} the same ${pPlural.toLowerCase()} differently.</p>
        <h3>JSON API</h3>
        <ul>
            <li><span class="api-endpoint"><a href="api/v1/index.json">api/v1/index.json</a></span> — API manifest</li>
            <li><span class="api-endpoint"><a href="api/v1/primaries.json">api/v1/primaries.json</a></span> — All ${pPlural.toLowerCase()}</li>
            <li><span class="api-endpoint"><a href="api/v1/containers.json">api/v1/containers.json</a></span> — All ${cPlural.toLowerCase()}</li>
        </ul>
        <h3>Contributing</h3>
        <p>See the <a href="${escapeHTML(config.repo || '#')}">repository</a> for contribution guidelines.</p>
    </div>`;

    return renderPageShell(config, { title: 'About', activePage: 'about', content, canonicalPath: 'about.html', configCSS });
}

// ---------------------------------------------------------------------------
// Detail page generators
// ---------------------------------------------------------------------------

function generateContainerDetail(config, container, data, configCSS) {
    const { primaries, mappingIndex, matrix } = data;
    const cPlural = config.entities?.container?.plural || 'Containers';
    const cProvisions = mappingIndex.filter(m => m.regulation === container.id);
    const cPrimaries = [...new Set(cProvisions.flatMap(m => m.obligations))];

    const timelineRows = container.timeline.map(t => `<tr><td>${escapeHTML(t.milestone || '')}</td><td>${formatDate(t.date)}</td><td>${escapeHTML(t.notes || '')}</td></tr>`).join('');

    const content = `
        ${renderBreadcrumb([{ label: cPlural, href: 'containers.html' }, { label: container.name }], '../../')}
        <div class="detail-header">
            <h2>${escapeHTML(container.name)}</h2>
            <div class="detail-meta">
                ${container.jurisdiction ? `<span><strong>Scope:</strong> ${escapeHTML(container.jurisdiction)}</span>` : ''}
                ${renderStatusBadge(container.status)}
                ${container.effective ? `<span><strong>Effective:</strong> ${formatDate(container.effective)}</span>` : ''}
                ${container.official_url ? `<span><a href="${escapeHTML(container.official_url)}" target="_blank" rel="noopener">Official source</a></span>` : ''}
            </div>
        </div>
        ${cPrimaries.length ? `<h3>${config.entities?.primary?.plural || 'Primaries'} Covered</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem;">
            ${cPrimaries.map(pId => { const p = primaries.find(pr => pr.id === pId); return `<a href="../primary/${pId}/index.html" onclick="passTheme(this)" class="group-badge ${p?.group || ''}" style="text-decoration:none;">${escapeHTML(p?.name || humanizeId(pId))}</a>`; }).join(' ')}
        </div>` : ''}
        ${timelineRows ? `<h3>Timeline</h3><table class="data-table"><thead><tr><th>Milestone</th><th>Date</th><th>Notes</th></tr></thead><tbody>${timelineRows}</tbody></table>` : ''}
        <h3>Provisions (${container.provisions.length})</h3>
        ${container.provisions.map(p => renderProvisionCard(p)).join('\n')}
    `;

    return renderBridgeShell(config, { title: container.name, depth: 2, content, canonicalPath: `container/${container.id}/`, description: `${container.name} — ${container.provisions.length} provisions.`, configCSS });
}

function generatePrimaryDetail(config, primary, data, configCSS) {
    const { containers, matrix } = data;
    const pPlural = config.entities?.primary?.plural || 'Primaries';
    const cName = (config.entities?.container?.name || 'Container').toLowerCase();
    const pMatrix = matrix[primary.id] || {};
    const coveredContainers = Object.keys(pMatrix);
    const summary = primary._body ? extractSection(primary._body, 'Summary') : '';
    const whatCounts = primary._body ? extractSection(primary._body, 'What Counts') : '';
    const whatDoesNot = primary._body ? extractSection(primary._body, 'What Does Not Count') : '';

    const content = `
        ${renderBreadcrumb([{ label: pPlural, href: 'primaries.html' }, { label: primary.name || humanizeId(primary.id) }], '../../')}
        <div class="detail-header">
            <h2>${escapeHTML(primary.name || humanizeId(primary.id))}</h2>
            <div class="detail-meta">${renderGroupBadge(primary.group)} <span class="meta-item">${coveredContainers.length} ${cName}${coveredContainers.length !== 1 ? 's' : ''}</span></div>
        </div>
        ${summary ? `<p style="font-size:1rem;line-height:1.6;margin:1rem 0;">${escapeHTML(summary)}</p>` : ''}
        ${whatCounts ? `<h3>What Counts</h3><ul>${parseBulletList(whatCounts).map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul>` : ''}
        ${whatDoesNot ? `<h3>What Does Not Count</h3><ul>${parseBulletList(whatDoesNot).map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul>` : ''}
        <h3>Implementing ${config.entities?.container?.plural || 'Containers'}</h3>
        ${coveredContainers.length ? `<table class="data-table"><thead><tr><th>${config.entities?.container?.name || 'Container'}</th><th>Scope</th><th>Status</th><th>Provisions</th></tr></thead><tbody>
            ${coveredContainers.map(cId => { const c = containers.find(co => co.id === cId); if (!c) return ''; return `<tr><td><a href="../container/${cId}/index.html" onclick="passTheme(this)">${escapeHTML(c.name)}</a></td><td>${escapeHTML(c.jurisdiction || '')}</td><td>${renderStatusBadge(c.status)}</td><td>${pMatrix[cId].provisions.length}</td></tr>`; }).join('\n')}
        </tbody></table>` : `<p style="color:var(--text-secondary);">No ${cName}s currently implement this.</p>`}
    `;

    return renderBridgeShell(config, { title: primary.name || humanizeId(primary.id), depth: 2, content, canonicalPath: `primary/${primary.id}/`, description: `${primary.name || humanizeId(primary.id)} — ${summary.slice(0, 150)}`, configCSS });
}

function generateAuthorityDetail(config, auth, data, configCSS) {
    const { containers } = data;
    const authContainers = containers.filter(c => c.authority === auth.id);

    const content = `
        ${renderBreadcrumb([{ label: auth.name || humanizeId(auth.id) }], '../../')}
        <div class="detail-header">
            <h2>${escapeHTML(auth.name || humanizeId(auth.id))}</h2>
            <div class="detail-meta">
                ${auth.jurisdiction ? `<span><strong>Scope:</strong> ${escapeHTML(auth.jurisdiction)}</span>` : ''}
                ${auth.website ? `<span><a href="${escapeHTML(auth.website)}" target="_blank" rel="noopener">${escapeHTML(auth.website)}</a></span>` : ''}
            </div>
        </div>
        <h3>${config.entities?.container?.plural || 'Containers'} (${authContainers.length})</h3>
        ${authContainers.length ? `<table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Effective</th><th>Provisions</th></tr></thead><tbody>
            ${authContainers.map(c => `<tr><td><a href="../container/${c.id}/index.html" onclick="passTheme(this)">${escapeHTML(c.name)}</a></td><td>${renderStatusBadge(c.status)}</td><td>${formatDate(c.effective)}</td><td>${c.provisions.length}</td></tr>`).join('\n')}
        </tbody></table>` : '<p style="color:var(--text-secondary);">None tracked.</p>'}
    `;

    return renderBridgeShell(config, { title: auth.name || humanizeId(auth.id), depth: 2, content, canonicalPath: `authority/${auth.id}/`, configCSS });
}

// ---------------------------------------------------------------------------
// Bridge pages
// ---------------------------------------------------------------------------

function generateRequiresBridge(config, containerId, primaryId, data, configCSS) {
    const { containers, primaries, mappingIndex } = data;
    const container = containers.find(c => c.id === containerId);
    const primary = primaries.find(p => p.id === primaryId);
    if (!container || !primary) return null;

    const matching = mappingIndex.filter(m => m.regulation === containerId && m.obligations?.includes(primaryId));
    const covered = matching.length > 0;
    const pName = primary.name || humanizeId(primaryId);
    const provCards = container.provisions.filter(p => matching.some(m => m.source_heading === p.name));

    const content = `
        ${renderBreadcrumb([{ label: container.name, href: `container/${containerId}/index.html` }, { label: pName }], '../../../')}
        <div class="bridge-header">
            <h2>Does ${escapeHTML(container.name)} require ${escapeHTML(pName)}?</h2>
        </div>
        <div class="bridge-answer">
            ${covered ? `<p class="answer-yes">Yes &mdash; ${matching.length} provision${matching.length !== 1 ? 's' : ''}</p>` : `<p class="answer-no">Not specifically addressed</p>`}
        </div>
        ${provCards.map(p => renderProvisionCard(p)).join('\n')}
        <div style="margin-top: 2rem; text-align: center;">
            <a href="../../../container/${containerId}/index.html" onclick="passTheme(this)" class="bridge-cta">View ${escapeHTML(config.entities?.container?.name || 'container')}</a>
            <a href="../../../primary/${primaryId}/index.html" onclick="passTheme(this)" class="bridge-cta">View ${escapeHTML(config.entities?.primary?.name || 'primary')}</a>
            <a href="../../../matrix.html" onclick="passTheme(this)" class="bridge-cta">Coverage matrix</a>
        </div>
    `;

    return renderBridgeShell(config, { title: `${container.name} — ${pName}`, depth: 3, content, canonicalPath: `requires/${containerId}/${primaryId}/`, description: `Does ${container.name} require ${pName}? ${covered ? 'Yes' : 'No'}.`, configCSS });
}

function generateCompareBridge(config, cA, cB, comparison, data, configCSS) {
    const { primaries } = data;
    const pName = id => { const p = primaries.find(pr => pr.id === id); return p ? (p.name || humanizeId(id)) : humanizeId(id); };

    const content = `
        ${renderBreadcrumb([{ label: 'Compare', href: 'compare.html' }, { label: `${cA.name} vs ${cB.name}` }], '../../../')}
        <div class="bridge-header"><h2>${escapeHTML(cA.name)} vs ${escapeHTML(cB.name)}</h2></div>
        <div class="compare-section"><h3>Shared (${comparison.shared_count})</h3>
            ${comparison.shared_obligations.length ? `<ul class="compare-list">${comparison.shared_obligations.map(o => `<li><a href="../../primary/${o}/index.html" onclick="passTheme(this)">${escapeHTML(pName(o))}</a></li>`).join('')}</ul>` : '<p style="color:var(--text-secondary);">None shared.</p>'}
        </div>
        <div class="compare-section"><h3>Only in ${escapeHTML(cA.name)} (${comparison.only_a_count})</h3>
            ${comparison.only_a.length ? `<ul class="compare-list">${comparison.only_a.map(o => `<li><a href="../../primary/${o}/index.html">${escapeHTML(pName(o))}</a></li>`).join('')}</ul>` : '<p style="color:var(--text-secondary);">None unique.</p>'}
        </div>
        <div class="compare-section"><h3>Only in ${escapeHTML(cB.name)} (${comparison.only_b_count})</h3>
            ${comparison.only_b.length ? `<ul class="compare-list">${comparison.only_b.map(o => `<li><a href="../../primary/${o}/index.html">${escapeHTML(pName(o))}</a></li>`).join('')}</ul>` : '<p style="color:var(--text-secondary);">None unique.</p>'}
        </div>
        <div style="margin-top: 2rem; text-align: center;">
            <a href="../../container/${cA.id}/index.html" onclick="passTheme(this)" class="bridge-cta">${escapeHTML(cA.name)}</a>
            <a href="../../container/${cB.id}/index.html" onclick="passTheme(this)" class="bridge-cta">${escapeHTML(cB.name)}</a>
        </div>
    `;

    return renderBridgeShell(config, { title: `${cA.name} vs ${cB.name}`, depth: 3, content, canonicalPath: `compare/${cA.id}-vs-${cB.id}/`, configCSS });
}

function generateAppliesToBridge(config, scopeValue, data, configCSS) {
    const { containers } = data;
    const scopeField = config.entities?.container?.scope_field || 'jurisdiction';
    const scopeContainers = containers.filter(c => c[scopeField] === scopeValue);

    const content = `
        ${renderBreadcrumb([{ label: scopeValue }], '../../')}
        <div class="bridge-header"><h2>${escapeHTML(config.entities?.container?.plural || 'Containers')} in ${escapeHTML(scopeValue)}</h2>
            <p class="bridge-subtitle">${scopeContainers.length} tracked</p>
        </div>
        <table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Effective</th><th>Provisions</th></tr></thead><tbody>
            ${scopeContainers.map(c => `<tr><td><a href="../../container/${c.id}/index.html" onclick="passTheme(this)">${escapeHTML(c.name)}</a></td><td>${renderStatusBadge(c.status)}</td><td>${formatDate(c.effective)}</td><td>${c.provisions.length}</td></tr>`).join('\n')}
        </tbody></table>
        <div style="margin-top: 2rem; text-align: center;"><a href="../../containers.html" onclick="passTheme(this)" class="bridge-cta">All ${escapeHTML((config.entities?.container?.plural || 'containers').toLowerCase())}</a></div>
    `;

    return renderBridgeShell(config, { title: `${scopeValue}`, depth: 2, content, canonicalPath: `applies-to/${slugify(scopeValue)}/`, configCSS });
}

// ---------------------------------------------------------------------------
// Search index + sitemap
// ---------------------------------------------------------------------------

function buildSearchIndex(config, data) {
    const items = [];
    for (const c of data.containers) {
        items.push({ type: config.entities?.container?.name?.toLowerCase() || 'container', name: c.name, id: c.id, href: `container/${c.id}/index.html`, jurisdiction: c.jurisdiction || '', _search: [c.name, c.jurisdiction || '', c.id, c.status || ''].join(' ').toLowerCase() });
    }
    for (const p of data.primaries) {
        const summary = p._body ? (p._body.match(/## Summary\n\n([^\n#]+)/) || [])[1]?.trim() || '' : '';
        items.push({ type: config.entities?.primary?.name?.toLowerCase() || 'primary', name: p.name || humanizeId(p.id), id: p.id, href: `primary/${p.id}/index.html`, group: p.group || '', _search: [p.name || '', p.id, p.group || '', summary, ...(p.search_terms || [])].join(' ').toLowerCase() });
    }
    for (const a of data.authorities) {
        items.push({ type: config.entities?.authority?.name?.toLowerCase() || 'authority', name: a.name || humanizeId(a.id), id: a.id, href: `authority/${a.id}/index.html`, jurisdiction: a.jurisdiction || '', _search: [a.name || '', a.id, a.jurisdiction || ''].join(' ').toLowerCase() });
    }
    return items;
}

function generateSitemap(config, pages) {
    const base = config.url || '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${base}${p}</loc></url>`).join('\n')}\n</urlset>`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
    const startTime = Date.now();
    const config = loadConfig();
    console.log(`Building ${config.name || 'project'}...\n`);

    const dataDir = findDataDir(config);
    const primaryDir = path.join(dataDir, config.entities?.primary?.directory || 'primary');
    const containerDir = path.join(dataDir, config.entities?.container?.directory || 'container');
    const authorityDir = path.join(dataDir, config.entities?.authority?.directory || 'authority');

    // Determine mapping file path
    const mappingFile = config.mapping?.file || 'provisions/index.yml';
    let mappingPath = path.join(dataDir, mappingFile);
    // Also check under mapping/ subdirectory for examples
    if (!fs.existsSync(mappingPath)) {
        mappingPath = path.join(dataDir, 'mapping', 'index.yml');
    }

    const primaries = loadDir(primaryDir);
    const containers = loadContainers(containerDir);
    const authorities = loadDir(authorityDir);
    const mappingIndex = loadMappingIndex(mappingPath);

    console.log(`  ${config.entities?.primary?.plural || 'Primaries'}: ${primaries.length}`);
    console.log(`  ${config.entities?.container?.plural || 'Containers'}: ${containers.length}`);
    console.log(`  ${config.entities?.authority?.plural || 'Authorities'}: ${authorities.length}`);
    console.log(`  Mappings: ${mappingIndex.length}`);

    const totalProvisions = containers.reduce((sum, c) => sum + c.provisions.length, 0);

    ensureDir(API_DIR);
    ensureDir(ASSETS_DIR);

    // Build matrix
    const matrix = {};
    for (const p of primaries) {
        matrix[p.id] = {};
        for (const c of containers) {
            const matching = mappingIndex.filter(m => m.regulation === c.id && m.obligations?.includes(p.id));
            if (matching.length > 0) matrix[p.id][c.id] = { covered: true, provisions: matching.map(m => m.id) };
        }
    }

    // Build comparisons
    const comparisons = [];
    const cIds = containers.map(c => c.id);
    for (let i = 0; i < cIds.length; i++) {
        for (let j = i + 1; j < cIds.length; j++) {
            const a = cIds[i], b = cIds[j];
            const aP = new Set(mappingIndex.filter(m => m.regulation === a).flatMap(m => m.obligations));
            const bP = new Set(mappingIndex.filter(m => m.regulation === b).flatMap(m => m.obligations));
            const shared = [...aP].filter(o => bP.has(o));
            const onlyA = [...aP].filter(o => !bP.has(o));
            const onlyB = [...bP].filter(o => !aP.has(o));
            if (shared.length || onlyA.length || onlyB.length) {
                comparisons.push({ regulations: [a, b], shared_obligations: shared, only_a: onlyA, only_b: onlyB, shared_count: shared.length, only_a_count: onlyA.length, only_b_count: onlyB.length });
            }
        }
    }

    const data = { primaries, containers, authorities, mappingIndex, matrix, comparisons, totalProvisions };
    const configCSS = generateConfigCSS(config);

    // --- JSON API ---
    fs.writeFileSync(path.join(API_DIR, 'primaries.json'), JSON.stringify({ meta: { generated: new Date().toISOString(), count: primaries.length }, items: primaries.map(p => ({ id: p.id, name: p.name || humanizeId(p.id), group: p.group || '', status: p.status || 'active' })) }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'containers.json'), JSON.stringify({ meta: { generated: new Date().toISOString(), count: containers.length }, items: containers.map(c => ({ id: c.id, name: c.name, status: c.status, effective: c.effective, provision_count: c.provisions.length })) }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'authorities.json'), JSON.stringify({ meta: { generated: new Date().toISOString(), count: authorities.length }, items: authorities.map(a => ({ id: a.id, name: a.name || humanizeId(a.id), jurisdiction: a.jurisdiction || '' })) }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'mappings.json'), JSON.stringify({ meta: { generated: new Date().toISOString(), count: mappingIndex.length }, items: mappingIndex }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'matrix.json'), JSON.stringify({ meta: { generated: new Date().toISOString() }, matrix }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'comparisons.json'), JSON.stringify({ meta: { generated: new Date().toISOString() }, comparisons }, null, 2));
    fs.writeFileSync(path.join(API_DIR, 'index.json'), JSON.stringify({ meta: { generated: new Date().toISOString(), version: '1.0', project: config.short_name || 'kac' }, files: { primaries: { path: 'primaries.json' }, containers: { path: 'containers.json' }, authorities: { path: 'authorities.json' }, mappings: { path: 'mappings.json' }, matrix: { path: 'matrix.json' }, comparisons: { path: 'comparisons.json' } } }, null, 2));

    console.log('  JSON API: 6 files');

    // --- HTML pages ---
    const sitemapPages = [];

    fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), generateHomepage(config, data, configCSS)); sitemapPages.push('');
    fs.writeFileSync(path.join(DOCS_DIR, 'containers.html'), generateContainersPage(config, data, configCSS)); sitemapPages.push('containers.html');
    fs.writeFileSync(path.join(DOCS_DIR, 'primaries.html'), generatePrimariesPage(config, data, configCSS)); sitemapPages.push('primaries.html');
    fs.writeFileSync(path.join(DOCS_DIR, 'matrix.html'), generateMatrixPage(config, data, configCSS)); sitemapPages.push('matrix.html');
    fs.writeFileSync(path.join(DOCS_DIR, 'timeline.html'), generateTimelinePage(config, data, configCSS)); sitemapPages.push('timeline.html');
    fs.writeFileSync(path.join(DOCS_DIR, 'compare.html'), generateComparePage(config, data, configCSS)); sitemapPages.push('compare.html');
    fs.writeFileSync(path.join(DOCS_DIR, 'about.html'), generateAboutPage(config, data, configCSS)); sitemapPages.push('about.html');
    console.log('  Core pages: 7');

    for (const c of containers) { const dir = path.join(DOCS_DIR, 'container', c.id); ensureDir(dir); fs.writeFileSync(path.join(dir, 'index.html'), generateContainerDetail(config, c, data, configCSS)); sitemapPages.push(`container/${c.id}/`); }
    console.log(`  Container detail pages: ${containers.length}`);

    for (const p of primaries) { const dir = path.join(DOCS_DIR, 'primary', p.id); ensureDir(dir); fs.writeFileSync(path.join(dir, 'index.html'), generatePrimaryDetail(config, p, data, configCSS)); sitemapPages.push(`primary/${p.id}/`); }
    console.log(`  Primary detail pages: ${primaries.length}`);

    for (const a of authorities) { const dir = path.join(DOCS_DIR, 'authority', a.id); ensureDir(dir); fs.writeFileSync(path.join(dir, 'index.html'), generateAuthorityDetail(config, a, data, configCSS)); sitemapPages.push(`authority/${a.id}/`); }
    console.log(`  Authority detail pages: ${authorities.length}`);

    // Bridge pages
    let reqCount = 0;
    if (config.bridges?.requires !== false) {
        for (const m of mappingIndex) {
            for (const oblId of m.obligations) {
                const dir = path.join(DOCS_DIR, 'requires', m.regulation, oblId); ensureDir(dir);
                const html = generateRequiresBridge(config, m.regulation, oblId, data, configCSS);
                if (html) { fs.writeFileSync(path.join(dir, 'index.html'), html); sitemapPages.push(`requires/${m.regulation}/${oblId}/`); reqCount++; }
            }
        }
    }
    console.log(`  Requires bridge pages: ${reqCount}`);

    let cmpCount = 0;
    if (config.bridges?.compare !== false) {
        for (const comp of comparisons) {
            const [aId, bId] = comp.regulations;
            const cA = containers.find(c => c.id === aId), cB = containers.find(c => c.id === bId);
            if (cA && cB) { const dir = path.join(DOCS_DIR, 'compare', `${aId}-vs-${bId}`); ensureDir(dir); fs.writeFileSync(path.join(dir, 'index.html'), generateCompareBridge(config, cA, cB, comp, data, configCSS)); sitemapPages.push(`compare/${aId}-vs-${bId}/`); cmpCount++; }
        }
    }
    console.log(`  Compare bridge pages: ${cmpCount}`);

    let appCount = 0;
    if (config.bridges?.applies_to) {
        const scopeField = config.entities?.container?.scope_field || config.bridges.applies_to.field || 'jurisdiction';
        const scopes = [...new Set(containers.map(c => c[scopeField]).filter(Boolean))];
        for (const s of scopes) { const dir = path.join(DOCS_DIR, 'applies-to', slugify(s)); ensureDir(dir); fs.writeFileSync(path.join(dir, 'index.html'), generateAppliesToBridge(config, s, data, configCSS)); sitemapPages.push(`applies-to/${slugify(s)}/`); appCount++; }
    }
    console.log(`  Applies-to bridge pages: ${appCount}`);

    // Search index
    const searchIndex = buildSearchIndex(config, data);
    fs.writeFileSync(path.join(ASSETS_DIR, 'data.json'), JSON.stringify(searchIndex));
    console.log(`  Search index: ${searchIndex.length} entries`);

    // Sitemap + robots
    fs.writeFileSync(path.join(DOCS_DIR, 'sitemap.xml'), generateSitemap(config, sitemapPages));
    fs.writeFileSync(path.join(DOCS_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.url || ''}sitemap.xml\n`);

    // Copy static assets if not present
    const srcCSS = path.join(ROOT, 'docs', 'assets', 'styles.css');
    const srcSearch = path.join(ROOT, 'docs', 'assets', 'search.js');
    // These are already in docs/assets/ from the repo — no copy needed

    const elapsed = Date.now() - startTime;
    const totalPages = 7 + containers.length + primaries.length + authorities.length + reqCount + cmpCount + appCount;
    console.log(`\nBuild complete in ${elapsed}ms — ${totalPages} HTML pages, 6 JSON API files`);
}

build();
