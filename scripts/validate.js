#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — Cross-Reference Validator
 * Validates that all references between entities are consistent.
 *
 * Usage: node scripts/validate.js
 */

const fs = require('fs');
const path = require('path');
const { loadMappingIndex, parseSimpleFrontmatter } = require('./lib/data-loaders');
const { parseYaml } = require('./lib/parsers');

const ROOT = path.join(__dirname, '..');

function isSafeId(id) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id || ''));
}

function validate() {
    const configPath = process.env.KAC_CONFIG_PATH
        ? path.resolve(process.cwd(), process.env.KAC_CONFIG_PATH)
        : path.join(ROOT, 'project.yml');
    if (!fs.existsSync(configPath)) {
        console.error('Error: project.yml not found.');
        process.exit(1);
    }

    const config = parseYaml(fs.readFileSync(configPath, 'utf-8'));
    console.log('Validating cross-references...\n');

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

    // Load IDs
    let errors = 0;

    const loadIds = (dir, role) => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_')).map(f => {
            const id = f.replace('.md', '');
            if (!isSafeId(id)) {
                console.error(`  ERROR: ${role} filename "${f}" produces unsafe ID "${id}"`);
                errors++;
            }
            return id;
        });
    };

    const primaryIds = loadIds(primaryDir, config.entities?.primary?.name || 'Primary');
    const containerIds = loadIds(containerDir, config.entities?.container?.name || 'Container');
    const authorityIds = loadIds(authorityDir, config.entities?.authority?.name || 'Authority');

    console.log(`  ${config.entities?.primary?.plural || 'Primaries'}: ${primaryIds.length}`);
    console.log(`  ${config.entities?.container?.plural || 'Containers'}: ${containerIds.length}`);
    console.log(`  ${config.entities?.authority?.plural || 'Authorities'}: ${authorityIds.length}`);

    // Load mapping
    const mappingFile = config.mapping?.file || 'provisions/index.yml';
    let mappingPath = path.join(dataDir, mappingFile);
    if (!fs.existsSync(mappingPath)) mappingPath = path.join(dataDir, 'mapping', 'index.yml');
    const mappings = loadMappingIndex(mappingPath);
    console.log(`  Mappings: ${mappings.length}`);

    // Validate mapping references
    for (const m of mappings) {
        if (!isSafeId(m.id)) {
            console.error(`  ERROR: Mapping has unsafe ID "${m.id}"`);
            errors++;
        }
        if (m.regulation && !isSafeId(m.regulation)) {
            console.error(`  ERROR: Mapping "${m.id}" has unsafe container reference "${m.regulation}"`);
            errors++;
        }
        if (m.regulation && !containerIds.includes(m.regulation)) {
            console.error(`  ERROR: Mapping "${m.id}" references unknown container "${m.regulation}"`);
            errors++;
        }
        for (const obl of m.obligations) {
            if (!isSafeId(obl)) {
                console.error(`  ERROR: Mapping "${m.id}" has unsafe primary reference "${obl}"`);
                errors++;
            }
            if (!primaryIds.includes(obl)) {
                console.error(`  ERROR: Mapping "${m.id}" references unknown primary "${obl}"`);
                errors++;
            }
        }
        if (m.authority && !isSafeId(m.authority)) {
            console.error(`  ERROR: Mapping "${m.id}" has unsafe authority reference "${m.authority}"`);
            errors++;
        }
        if (m.authority && !authorityIds.includes(m.authority)) {
            console.error(`  ERROR: Mapping "${m.id}" references unknown authority "${m.authority}"`);
            errors++;
        }
    }

    // Validate container authority references
    for (const cId of containerIds) {
        const content = fs.readFileSync(path.join(containerDir, `${cId}.md`), 'utf-8');
        const fm = parseSimpleFrontmatter(content);
        if (fm.authority && !authorityIds.includes(fm.authority)) {
            console.error(`  ERROR: Container "${cId}" references unknown authority "${fm.authority}"`);
            errors++;
        }
    }

    if (errors > 0) {
        console.error(`\n${errors} validation error${errors !== 1 ? 's' : ''} found.`);
        process.exit(1);
    }

    console.log('\nAll cross-references valid.');
}

validate();
