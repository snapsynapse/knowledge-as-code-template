#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — Verification Script
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Checks entity staleness (based on last_verified dates) and
 * completeness (mapping coverage, cross-reference integrity).
 *
 * Usage: node scripts/verify.js
 * Exit code 0 = all fresh, 1 = stale entities found
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Minimal YAML parser (same as build.js — handles project.yml)
// ---------------------------------------------------------------------------

function parseYaml(content) {
    const result = {};
    const stack = [{ obj: result, indent: -1 }];

    for (const rawLine of content.split('\n')) {
        if (rawLine.trim().startsWith('#') || rawLine.trim() === '') continue;
        const indent = rawLine.search(/\S/);
        const line = rawLine.trim();

        if (line.startsWith('- ')) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1].obj;

        if (value === '') {
            parent[key] = {};
            stack.push({ obj: parent[key], indent });
        } else {
            parent[key] = value;
        }
    }
    return result;
}

function parseFrontmatter(content) {
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
// Verification
// ---------------------------------------------------------------------------

function verify() {
    const configPath = path.join(ROOT, 'project.yml');
    if (!fs.existsSync(configPath)) {
        console.error('Error: project.yml not found.');
        process.exit(1);
    }

    const config = parseYaml(fs.readFileSync(configPath, 'utf-8'));
    const stalenessDays = parseInt(config.verification?.staleness_days || '90', 10);
    const now = new Date();

    console.log('Knowledge Base Verification Report');
    console.log('==================================\n');
    console.log(`Staleness threshold: ${stalenessDays} days\n`);

    // Find data directory
    const dataDirs = ['data/examples', 'data'];
    let dataDir;
    for (const d of dataDirs) {
        if (fs.existsSync(path.join(ROOT, d))) { dataDir = path.join(ROOT, d); break; }
    }
    if (!dataDir) { console.error('No data directory found.'); process.exit(1); }

    const primaryDir = path.join(dataDir, config.entities?.primary?.directory || 'primary');
    const containerDir = path.join(dataDir, config.entities?.container?.directory || 'container');
    const authorityDir = path.join(dataDir, config.entities?.authority?.directory || 'authority');

    // Load all entity files with frontmatter
    const loadEntities = dir => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(f => f.endsWith('.md') && !f.startsWith('_'))
            .map(f => ({
                id: f.replace('.md', ''),
                file: f,
                ...parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf-8'))
            }));
    };

    const primaries = loadEntities(primaryDir);
    const containers = loadEntities(containerDir);
    const authorities = loadEntities(authorityDir);
    const allEntities = [
        ...primaries.map(e => ({ ...e, role: config.entities?.primary?.name || 'Primary' })),
        ...containers.map(e => ({ ...e, role: config.entities?.container?.name || 'Container' })),
        ...authorities.map(e => ({ ...e, role: config.entities?.authority?.name || 'Authority' }))
    ];

    // -----------------------------------------------------------------------
    // 1. Staleness check
    // -----------------------------------------------------------------------
    console.log('--- Staleness Check ---\n');
    const staleEntities = [];
    const neverVerified = [];

    for (const entity of allEntities) {
        if (!entity.last_verified) {
            neverVerified.push(entity);
            continue;
        }
        const verifiedDate = new Date(entity.last_verified + 'T00:00:00');
        const daysSince = Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
        if (daysSince > stalenessDays) {
            staleEntities.push({ ...entity, daysSince });
        }
    }

    if (staleEntities.length > 0) {
        console.log(`STALE (${staleEntities.length}):`);
        for (const e of staleEntities) {
            console.log(`  [${e.role}] ${e.id} — last verified ${e.daysSince} days ago (${e.last_verified})`);
        }
        console.log();
    }

    if (neverVerified.length > 0) {
        console.log(`NEVER VERIFIED (${neverVerified.length}):`);
        for (const e of neverVerified) {
            console.log(`  [${e.role}] ${e.id} — no last_verified date in frontmatter`);
        }
        console.log();
    }

    const freshCount = allEntities.length - staleEntities.length - neverVerified.length;
    console.log(`Fresh: ${freshCount}  |  Stale: ${staleEntities.length}  |  Never verified: ${neverVerified.length}\n`);

    // -----------------------------------------------------------------------
    // 2. Completeness check
    // -----------------------------------------------------------------------
    console.log('--- Completeness Check ---\n');

    const mappingFile = config.mapping?.file || 'provisions/index.yml';
    let mappingPath = path.join(dataDir, mappingFile);
    if (!fs.existsSync(mappingPath)) mappingPath = path.join(dataDir, 'mapping', 'index.yml');
    const mappings = loadMappingIndex(mappingPath);

    const primaryIds = new Set(primaries.map(p => p.id));
    const containerIds = new Set(containers.map(c => c.id));

    let completenessErrors = 0;

    // Check each container has at least one mapping
    const containersMapped = new Set();
    for (const m of mappings) {
        const cId = m.regulation || m.container || m.framework;
        if (cId) containersMapped.add(cId);
    }

    for (const c of containers) {
        if (!containersMapped.has(c.id)) {
            console.log(`  WARNING: ${config.entities?.container?.name || 'Container'} "${c.id}" has no mapping entries`);
            completenessErrors++;
        }
    }

    // Check each mapping references valid primaries
    for (const m of mappings) {
        for (const obl of m.obligations) {
            if (!primaryIds.has(obl)) {
                console.log(`  ERROR: Mapping "${m.id}" references unknown ${(config.entities?.primary?.name || 'primary').toLowerCase()} "${obl}"`);
                completenessErrors++;
            }
        }
        const cId = m.regulation || m.container || m.framework;
        if (cId && !containerIds.has(cId)) {
            console.log(`  ERROR: Mapping "${m.id}" references unknown ${(config.entities?.container?.name || 'container').toLowerCase()} "${cId}"`);
            completenessErrors++;
        }
    }

    if (completenessErrors === 0) {
        console.log('  All mappings valid and complete.\n');
    } else {
        console.log(`\n  ${completenessErrors} completeness issue(s) found.\n`);
    }

    // -----------------------------------------------------------------------
    // 3. Summary
    // -----------------------------------------------------------------------
    console.log('--- Summary ---\n');
    console.log(`  ${config.entities?.primary?.plural || 'Primaries'}: ${primaries.length}`);
    console.log(`  ${config.entities?.container?.plural || 'Containers'}: ${containers.length}`);
    console.log(`  ${config.entities?.authority?.plural || 'Authorities'}: ${authorities.length}`);
    console.log(`  Mappings: ${mappings.length}`);
    console.log();

    // -----------------------------------------------------------------------
    // AI-assisted verification (placeholder)
    // -----------------------------------------------------------------------
    //
    // To add model-based verification, uncomment and adapt the section below.
    // This demonstrates the pattern for sending entity content to an LLM API
    // to check factual accuracy, detect outdated information, or suggest updates.
    //
    // async function aiVerify(entity) {
    //     const prompt = `Review this ${entity.role} entity for accuracy:
    //       Title: ${entity.title || entity.id}
    //       Content: ${entity._body || '(no body)'}
    //
    //       Check for:
    //       1. Outdated facts or references
    //       2. Broken or changed URLs
    //       3. Superseded standards or regulations
    //       4. Factual inaccuracies
    //
    //       Respond with JSON: { "status": "current"|"needs_review", "issues": [] }`;
    //
    //     const response = await fetch(process.env.AI_API_URL, {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'Authorization': `Bearer ${process.env.AI_API_KEY}`
    //         },
    //         body: JSON.stringify({ prompt, max_tokens: 500 })
    //     });
    //     return response.json();
    // }
    //
    // To run AI verification on stale entities:
    //
    // for (const entity of staleEntities) {
    //     const result = await aiVerify(entity);
    //     console.log(`  AI review [${entity.id}]: ${result.status}`);
    //     if (result.issues?.length) {
    //         result.issues.forEach(issue => console.log(`    - ${issue}`));
    //     }
    // }

    // Exit code
    if (staleEntities.length > 0) {
        console.log('Result: STALE — some entities need re-verification.');
        process.exit(1);
    }
    console.log('Result: OK — no stale entities detected.');
    process.exit(0);
}

verify();
