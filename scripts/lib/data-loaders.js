'use strict';

function parseSimpleFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const fm = {};
    match[1].split('\n').forEach(line => {
        const [key, ...vParts] = line.split(':');
        if (key && vParts.length) {
            const value = vParts.join(':').trim();
            if (value) fm[key.trim()] = value;
        }
    });
    return fm;
}

function parseTable(tableText) {
    const lines = tableText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
        const row = {};
        headers.forEach((h, idx) => {
            row[h.toLowerCase().replace(/\s+/g, '_')] = cells[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

function loadMappingIndex(filePath) {
    const fs = require('fs');
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

module.exports = {
    loadMappingIndex,
    parseSimpleFrontmatter,
    parseTable
};
