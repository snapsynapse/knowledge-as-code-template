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
const { isSafeId, loadProjectData } = require('./lib/data-loaders');
const { parseYaml } = require('./lib/parsers');
const { normalizeCustomDomain, normalizeHttpsUrl, normalizeSiteUrl, normalizeSocialConfig } = require('./lib/urls');

const ROOT = path.join(__dirname, '..');

function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

    let errors = 0;
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

    const report = message => {
        console.error(`  ERROR: ${message}`);
        errors++;
    };

    const configuredGroups = new Set((config.entities?.primary?.groups || []).map(group => group.name || group));
    const configuredStatuses = new Set((config.entities?.container?.statuses || []).map(status => status.name || status));
    const scopeField = config.entities?.container?.scope_field;

    for (const primary of primaries) {
        if (!primary.name) report(`${primary.file} requires frontmatter "name"`);
        if (!primary.group) report(`${primary.file} requires frontmatter "group"`);
        else if (configuredGroups.size && !configuredGroups.has(primary.group)) {
            report(`${primary.file} uses unknown group "${primary.group}"`);
        }
    }

    for (const container of containers) {
        if (!container.name) report(`${container.file} requires frontmatter "name"`);
        if (!container.authority) report(`${container.file} requires frontmatter "authority"`);
        if (!container.status) report(`${container.file} requires frontmatter "status"`);
        else if (configuredStatuses.size && !configuredStatuses.has(container.status)) {
            report(`${container.file} uses unknown status "${container.status}"`);
        }
        if (scopeField && !container[scopeField]) {
            report(`${container.file} requires configured scope field "${scopeField}"`);
        }
    }

    for (const authority of authorities) {
        if (!authority.name) report(`${authority.file} requires frontmatter "name"`);
    }

    // Validate mapping references
    const mappingIds = new Set();
    for (const m of mappings) {
        if (!isSafeId(m.id)) {
            report(`Mapping has unsafe ID "${m.id}"`);
        }
        if (mappingIds.has(m.id)) {
            report(`Duplicate mapping ID "${m.id}"`);
        }
        mappingIds.add(m.id);
        if (!m.regulation) report(`Mapping "${m.id}" requires "regulation"`);
        if (m.regulation && !isSafeId(m.regulation)) {
            report(`Mapping "${m.id}" has unsafe container reference "${m.regulation}"`);
        }
        if (m.regulation && !containerIds.includes(m.regulation)) {
            report(`Mapping "${m.id}" references unknown container "${m.regulation}"`);
        }
        if (!m.obligations.length) report(`Mapping "${m.id}" requires at least one "obligations" entry`);
        for (const obl of m.obligations) {
            if (!isSafeId(obl)) {
                report(`Mapping "${m.id}" has unsafe primary reference "${obl}"`);
            }
            if (!primaryIds.includes(obl)) {
                report(`Mapping "${m.id}" references unknown primary "${obl}"`);
            }
        }
        if (!m.authority) report(`Mapping "${m.id}" requires "authority"`);
        if (m.authority && !isSafeId(m.authority)) {
            report(`Mapping "${m.id}" has unsafe authority reference "${m.authority}"`);
        }
        if (m.authority && !authorityIds.includes(m.authority)) {
            report(`Mapping "${m.id}" references unknown authority "${m.authority}"`);
        }
    }

    // Validate container authority references
    for (const container of containers) {
        if (container.authority && !authorityIds.includes(container.authority)) {
            report(`Container "${container.id}" references unknown authority "${container.authority}"`);
        }
    }

    const scopeRoutes = new Map();
    if (scopeField && config.bridges?.applies_to) {
        for (const container of containers) {
            const value = container[scopeField];
            if (!value) continue;
            const route = slugify(value);
            if (!route) report(`Container "${container.id}" has a scope value that cannot produce a route`);
            else if (scopeRoutes.has(route) && scopeRoutes.get(route) !== value) {
                report(`Scope values "${scopeRoutes.get(route)}" and "${value}" both produce route "${route}"`);
            } else {
                scopeRoutes.set(route, value);
            }
        }
    }

    const toolNames = [
        `list_${slugify(config.entities?.primary?.plural || 'primaries')}`,
        `get_${slugify(config.entities?.primary?.name || 'primary')}`,
        `list_${slugify(config.entities?.container?.plural || 'containers')}`,
        `get_${slugify(config.entities?.container?.name || 'container')}`,
        `list_${slugify(config.entities?.authority?.plural || 'authorities')}`,
        `get_${slugify(config.entities?.authority?.name || 'authority')}`,
        'search',
        'get_matrix',
        'get_mappings'
    ];
    const seenTools = new Set();
    for (const toolName of toolNames) {
        if (!toolName.replace(/^(list_|get_)/, '')) report(`Entity labels produce an empty MCP tool name "${toolName}"`);
        if (seenTools.has(toolName)) report(`Entity labels produce duplicate MCP tool name "${toolName}"`);
        seenTools.add(toolName);
    }

    if (errors > 0) {
        console.error(`\n${errors} validation error${errors !== 1 ? 's' : ''} found.`);
        process.exit(1);
    }

    console.log('\nAll cross-references valid.');
}

validate();
