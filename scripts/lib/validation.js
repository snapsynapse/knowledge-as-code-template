'use strict';

const fs = require('fs');
const path = require('path');
const { isSafeId } = require('./data-loaders');

function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Structural acceptance is shared by every source-data entry point. Freshness
// and external factual review belong to verify.js, not to this contract.
function validateProjectData(config, loaded, projectRoot) {
    const { primaries, containers, authorities, mappings } = loaded;
    const primaryIds = primaries.map(entity => entity.id);
    const containerIds = containers.map(entity => entity.id);
    const authorityIds = authorities.map(entity => entity.id);
    const issues = [];
    const report = message => {
        issues.push(message);
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

    for (const container of containers) {
        for (const provision of container.provisions) {
            if (!provision.obligation) {
                report(`Container "${container.id}" provision "${provision.name}" requires "Obligation"`);
            } else if (!isSafeId(provision.obligation) || !primaryIds.includes(provision.obligation)) {
                report(`Container "${container.id}" provision "${provision.name}" references unknown or unsafe primary "${provision.obligation}"`);
            }
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

    for (const mapping of mappings) {
        const container = containers.find(entity => entity.id === mapping.regulation);
        if (!container) continue; // The missing reference is reported above.
        if (mapping.authority && mapping.authority !== container.authority) {
            report(`Mapping "${mapping.id}" authority "${mapping.authority}" does not match container "${container.id}" authority "${container.authority}"`);
        }
        if (!mapping.source_heading) {
            report(`Mapping "${mapping.id}" requires "source_heading"`);
        } else {
            const matches = container.provisions.filter(provision => provision.name === mapping.source_heading);
            if (matches.length !== 1) {
                report(`Mapping "${mapping.id}" source_heading must identify exactly one provision in container "${container.id}": ${mapping.source_heading}`);
            } else if (matches[0].obligation && !mapping.obligations.includes(matches[0].obligation)) {
                report(`Mapping "${mapping.id}" obligations must include provision primary "${matches[0].obligation}"`);
            }
        }
        if (mapping.source_file) {
            const sourcePath = path.resolve(projectRoot, mapping.source_file);
            const relative = path.relative(projectRoot, sourcePath);
            const containerPath = path.join(loaded.dataDir, config.entities?.container?.directory || 'container', container.file);
            if (path.isAbsolute(mapping.source_file) || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
                report(`Mapping "${mapping.id}" source_file escapes the project root`);
            } else if (!fs.existsSync(sourcePath)) {
                report(`Mapping "${mapping.id}" source_file does not exist: ${mapping.source_file}`);
            } else if (fs.realpathSync(sourcePath) !== fs.realpathSync(containerPath)) {
                report(`Mapping "${mapping.id}" source_file must identify container "${container.id}"`);
            }
        }
    }

    if (issues.length) {
        const error = new Error(issues.join('\n'));
        error.issues = issues;
        throw error;
    }
}

module.exports = { validateProjectData };
