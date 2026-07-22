#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — Verification Script
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Checks entity staleness, evidence metadata, and mapping integrity.
 * An optional external executable can add factual review through JSONL.
 *
 * Usage: node scripts/verify.js
 * Exit code 0 = all checks pass, 1 = review required, 2 = configuration error
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadMappingIndex, parseSimpleFrontmatter } = require('./lib/data-loaders');
const { parseYaml } = require('./lib/parsers');

const ROOT = path.join(__dirname, '..');

function extractUrls(content) {
    return [...new Set((String(content).match(/https?:\/\/[^\s)<>{}"']+/g) || [])
        .map(url => url.replace(/[.,;:!?]+$/, '')))];
}

function runExternalVerifier(entities) {
    const command = process.env.KAC_VERIFY_COMMAND;
    if (!command) return { errors: 0, ran: false };

    let args = [];
    try {
        args = JSON.parse(process.env.KAC_VERIFY_ARGS || '[]');
        if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) throw new Error('expected a JSON array of strings');
    } catch (error) {
        console.error(`Error: KAC_VERIFY_ARGS must be a JSON array of strings (${error.message}).`);
        process.exit(2);
    }

    const input = entities.map(entity => JSON.stringify({
        id: entity.id,
        role: entity.roleKey,
        title: entity.name || entity.title || entity.id,
        last_verified: entity.last_verified || null,
        urls: entity.urls,
        content: entity.content
    })).join('\n') + '\n';
    const timeout = parseInt(process.env.KAC_VERIFY_TIMEOUT_MS || '60000', 10);
    if (!Number.isFinite(timeout) || timeout < 1) {
        console.error('Error: KAC_VERIFY_TIMEOUT_MS must be a positive integer.');
        process.exit(2);
    }
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        input,
        maxBuffer: 10 * 1024 * 1024,
        timeout
    });

    if (result.error || result.status !== 0) {
        const detail = result.error?.message || result.stderr.trim() || `exit code ${result.status}`;
        console.log(`  ERROR: external verifier failed: ${detail}`);
        return { errors: 1, ran: true };
    }

    const lines = result.stdout.split('\n').map(line => line.trim()).filter(Boolean);
    const seen = new Set();
    const known = new Set(entities.map(entity => `${entity.roleKey}:${entity.id}`));
    let errors = 0;
    for (const line of lines) {
        let review;
        try { review = JSON.parse(line); } catch {
            console.log(`  ERROR: external verifier emitted invalid JSONL: ${line.slice(0, 120)}`);
            errors++;
            continue;
        }
        if (!review.id || !review.role || typeof review.status !== 'string') {
            console.log('  ERROR: external verifier result requires string fields "id", "role", and "status"');
            errors++;
            continue;
        }
        const key = `${review.role}:${review.id}`;
        if (!known.has(key)) {
            console.log(`  ERROR: external verifier returned an unknown entity: ${review.role}/${review.id}`);
            errors++;
            continue;
        }
        if (seen.has(key)) {
            console.log(`  ERROR: external verifier returned a duplicate result for ${review.role}/${review.id}`);
            errors++;
            continue;
        }
        seen.add(key);
        const issues = Array.isArray(review.issues) ? review.issues : [];
        const passes = ['current', 'pass', 'ok'].includes(review.status.toLowerCase());
        console.log(`  ${passes ? 'OK' : 'REVIEW'}: ${review.role}/${review.id} — ${review.status}`);
        for (const issue of issues) console.log(`    - ${String(issue)}`);
        if (!passes) errors++;
    }
    for (const entity of entities) {
        if (!seen.has(`${entity.roleKey}:${entity.id}`)) {
            console.log(`  ERROR: external verifier returned no result for ${entity.roleKey}/${entity.id}`);
            errors++;
        }
    }
    return { errors, ran: true };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function verify() {
    const configPath = process.env.KAC_CONFIG_PATH
        ? path.resolve(process.cwd(), process.env.KAC_CONFIG_PATH)
        : path.join(ROOT, 'project.yml');
    if (!fs.existsSync(configPath)) {
        console.error('Error: project.yml not found.');
        process.exit(1);
    }

    const config = parseYaml(fs.readFileSync(configPath, 'utf-8'));
    const projectRoot = path.dirname(configPath);
    const stalenessDays = parseInt(config.verification?.staleness_days || '90', 10);
    if (!Number.isFinite(stalenessDays) || stalenessDays < 0) {
        console.error('Error: verification.staleness_days must be a non-negative integer.');
        process.exit(2);
    }
    const now = process.env.KAC_NOW ? new Date(process.env.KAC_NOW) : new Date();
    if (Number.isNaN(now.getTime())) {
        console.error('Error: KAC_NOW must be a valid ISO-8601 date or timestamp.');
        process.exit(1);
    }

    console.log('Knowledge Base Verification Report');
    console.log('==================================\n');
    console.log(`Staleness threshold: ${stalenessDays} days\n`);

    // Find data directory
    const dataDirs = process.env.KAC_DATA_DIR
        ? [process.env.KAC_DATA_DIR]
        : ['data/examples', 'data'];
    let dataDir;
    for (const d of dataDirs) {
        const candidate = path.resolve(process.cwd(), d);
        if (fs.existsSync(candidate)) { dataDir = candidate; break; }
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
            .map(f => {
                const content = fs.readFileSync(path.join(dir, f), 'utf-8');
                return { id: f.replace('.md', ''), file: f, content, urls: extractUrls(content), ...parseSimpleFrontmatter(content) };
            });
    };

    const primaries = loadEntities(primaryDir);
    const containers = loadEntities(containerDir);
    const authorities = loadEntities(authorityDir);
    const allEntities = [
        ...primaries.map(e => ({ ...e, roleKey: 'primary', role: config.entities?.primary?.name || 'Primary' })),
        ...containers.map(e => ({ ...e, roleKey: 'container', role: config.entities?.container?.name || 'Container' })),
        ...authorities.map(e => ({ ...e, roleKey: 'authority', role: config.entities?.authority?.name || 'Authority' }))
    ];

    // -----------------------------------------------------------------------
    // 1. Staleness check
    // -----------------------------------------------------------------------
    console.log('--- Staleness Check ---\n');
    const staleEntities = [];
    const neverVerified = [];
    const invalidDates = [];

    for (const entity of allEntities) {
        if (!entity.last_verified) {
            neverVerified.push(entity);
            continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entity.last_verified)) {
            invalidDates.push({ ...entity, reason: 'must use YYYY-MM-DD' });
            continue;
        }
        const verifiedDate = new Date(entity.last_verified + 'T00:00:00Z');
        if (Number.isNaN(verifiedDate.getTime()) || verifiedDate.toISOString().slice(0, 10) !== entity.last_verified) {
            invalidDates.push({ ...entity, reason: 'is not a valid calendar date' });
            continue;
        }
        const daysSince = Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
        if (daysSince < 0) {
            invalidDates.push({ ...entity, reason: 'is in the future' });
            continue;
        }
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

    if (invalidDates.length > 0) {
        console.log(`INVALID DATES (${invalidDates.length}):`);
        for (const e of invalidDates) console.log(`  [${e.role}] ${e.id} — ${e.last_verified} ${e.reason}`);
        console.log();
    }

    const freshCount = allEntities.length - staleEntities.length - neverVerified.length - invalidDates.length;
    console.log(`Fresh: ${freshCount}  |  Stale: ${staleEntities.length}  |  Never verified: ${neverVerified.length}  |  Invalid dates: ${invalidDates.length}\n`);

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
    const authorityIds = new Set(authorities.map(a => a.id));

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
        if (m.authority && !authorityIds.has(m.authority)) {
            console.log(`  ERROR: Mapping "${m.id}" references unknown ${(config.entities?.authority?.name || 'authority').toLowerCase()} "${m.authority}"`);
            completenessErrors++;
        }
        if (m.source_file) {
            const sourcePath = path.resolve(projectRoot, m.source_file);
            const relative = path.relative(projectRoot, sourcePath);
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                console.log(`  ERROR: Mapping "${m.id}" source_file escapes the project root`);
                completenessErrors++;
            } else if (!fs.existsSync(sourcePath)) {
                console.log(`  ERROR: Mapping "${m.id}" source_file does not exist: ${m.source_file}`);
                completenessErrors++;
            } else if (m.source_heading) {
                const source = fs.readFileSync(sourcePath, 'utf8');
                const escapedHeading = m.source_heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (!(new RegExp(`^#{1,6}\\s+${escapedHeading}\\s*$`, 'm')).test(source)) {
                    console.log(`  ERROR: Mapping "${m.id}" source_heading not found in ${m.source_file}: ${m.source_heading}`);
                    completenessErrors++;
                }
            }
        }
    }

    if (completenessErrors === 0) {
        console.log('  All mappings valid and complete.\n');
    } else {
        console.log(`\n  ${completenessErrors} completeness issue(s) found.\n`);
    }

    // -----------------------------------------------------------------------
    // 3. Evidence metadata check
    // -----------------------------------------------------------------------
    console.log('--- Evidence Check ---\n');
    const requiredEvidenceRoles = Array.isArray(config.verification?.require_evidence_roles)
        ? config.verification.require_evidence_roles
        : [];
    let evidenceErrors = 0;
    for (const entity of allEntities) {
        for (const url of entity.urls) {
            if (!url.startsWith('https://')) {
                console.log(`  ERROR: ${entity.id} uses a non-HTTPS evidence URL: ${url}`);
                evidenceErrors++;
                continue;
            }
            try { new URL(url); } catch {
                console.log(`  ERROR: ${entity.id} has an invalid evidence URL: ${url}`);
                evidenceErrors++;
            }
        }
        if (requiredEvidenceRoles.includes(entity.roleKey) && entity.urls.length === 0) {
            console.log(`  ERROR: ${entity.role} "${entity.id}" has no evidence URL`);
            evidenceErrors++;
        }
    }
    if (evidenceErrors === 0) console.log('  Evidence URL metadata is present and well-formed.\n');
    else console.log(`\n  ${evidenceErrors} evidence issue(s) found.\n`);

    // -----------------------------------------------------------------------
    // 4. Optional external review
    // -----------------------------------------------------------------------
    console.log('--- External Review ---\n');
    const external = runExternalVerifier(allEntities);
    if (!external.ran) console.log('  Not configured. Deterministic checks only.\n');
    else console.log(`\n  ${external.errors} external review issue(s) found.\n`);

    // -----------------------------------------------------------------------
    // 5. Summary
    // -----------------------------------------------------------------------
    console.log('--- Summary ---\n');
    console.log(`  ${config.entities?.primary?.plural || 'Primaries'}: ${primaries.length}`);
    console.log(`  ${config.entities?.container?.plural || 'Containers'}: ${containers.length}`);
    console.log(`  ${config.entities?.authority?.plural || 'Authorities'}: ${authorities.length}`);
    console.log(`  Mappings: ${mappings.length}`);
    console.log();

    const issueCount = staleEntities.length + neverVerified.length + invalidDates.length + completenessErrors + evidenceErrors + external.errors;
    if (issueCount > 0) {
        console.log(`Result: REVIEW REQUIRED — ${issueCount} issue(s) need attention.`);
        process.exit(1);
    }
    console.log('Result: OK — deterministic checks and configured reviews passed.');
    process.exit(0);
}

verify();
