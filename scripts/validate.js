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
const { loadProjectData } = require('./lib/data-loaders');
const { parseYaml } = require('./lib/parsers');
const { normalizeCustomDomain, normalizeHttpsUrl, normalizeSiteUrl, normalizeSocialConfig } = require('./lib/urls');

const { validateProjectData } = require('./lib/validation');

const ROOT = path.join(__dirname, '..');

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

    try {
        normalizeSiteUrl(config.url);
        normalizeHttpsUrl(config.repo, 'Repository URL');
        normalizeSocialConfig(config.social);
        normalizeCustomDomain(config.deployment?.custom_domain);
    } catch (error) {
        console.error(`  ERROR: ${error.message}`);
        process.exit(1);
    }
    let loaded;
    try {
        loaded = loadProjectData(path.dirname(configPath), config, {
            dataDir: process.env.KAC_DATA_DIR ? path.resolve(process.cwd(), process.env.KAC_DATA_DIR) : undefined,
            requireMapping: true
        });
    } catch (error) {
        console.error(`  ERROR: ${error.message}`);
        process.exit(1);
    }

    const { primaries, containers, authorities, mappings } = loaded;
    const primaryIds = primaries.map(entity => entity.id);
    const containerIds = containers.map(entity => entity.id);
    const authorityIds = authorities.map(entity => entity.id);

    console.log(`  ${config.entities?.primary?.plural || 'Primaries'}: ${primaryIds.length}`);
    console.log(`  ${config.entities?.container?.plural || 'Containers'}: ${containerIds.length}`);
    console.log(`  ${config.entities?.authority?.plural || 'Authorities'}: ${authorityIds.length}`);

    console.log(`  Mappings: ${mappings.length}`);

    try {
        validateProjectData(config, loaded, path.dirname(configPath));
    } catch (error) {
        const issues = error.issues || [error.message];
        for (const issue of issues) console.error(`  ERROR: ${issue}`);
        console.error(`\n${issues.length} validation error${issues.length === 1 ? '' : 's'} found.`);
        process.exit(1);
    }

    console.log('\nAll cross-references valid.');
}

validate();
