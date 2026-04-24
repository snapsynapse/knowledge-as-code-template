#!/usr/bin/env node
'use strict';

/**
 * Knowledge-as-Code — Internal Link Checker
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Scans all generated HTML files in docs/ and verifies that every internal
 * href resolves to an existing file. Reports broken links with source file
 * and line number.
 *
 * Usage: node scripts/check-links.js
 *
 * Exit codes:
 *   0 — all internal links valid
 *   1 — broken links found
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = process.env.KAC_LINK_CHECK_DIR
    ? path.resolve(process.cwd(), process.env.KAC_LINK_CHECK_DIR)
    : path.join(__dirname, '..', 'docs');

// ---------------------------------------------------------------------------
// Collect all HTML files
// ---------------------------------------------------------------------------

function walkDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full));
        } else if (entry.name.endsWith('.html')) {
            results.push(full);
        }
    }
    return results;
}

// ---------------------------------------------------------------------------
// Extract href values from HTML
// ---------------------------------------------------------------------------

function extractLinks(html, filePath) {
    const links = [];
    const hrefRegex = /href="([^"]+)"/g;
    let match;
    let lineNum = 0;
    const lines = html.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        while ((match = hrefRegex.exec(line)) !== null) {
            links.push({
                href: match[1],
                line: i + 1,
                source: filePath
            });
        }
    }

    return links;
}

// ---------------------------------------------------------------------------
// Check if an internal link resolves to an existing file
// ---------------------------------------------------------------------------

function resolveLink(href, sourceFile) {
    // Skip external links, anchors, javascript, mailto, tel, and JS template expressions
    if (href.startsWith('http://') || href.startsWith('https://') ||
        href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:') ||
        href.startsWith('data:') ||
        href.includes("' +") || href.includes("${") || href.includes("'+")) {
        return null; // Not a resolvable link
    }

    // Strip query string and anchor
    const cleanHref = href.split('?')[0].split('#')[0];
    if (!cleanHref) return null;

    const sourceDir = path.dirname(sourceFile);
    const resolved = cleanHref.startsWith('/')
        ? path.join(DOCS_DIR, cleanHref.slice(1))
        : path.resolve(sourceDir, cleanHref);

    // Check if it resolves to a file
    if (fs.existsSync(resolved)) return null; // OK

    // If it's a directory, check for index.html
    if (cleanHref.endsWith('/')) {
        const indexPath = path.join(resolved, 'index.html');
        if (fs.existsSync(indexPath)) return null; // OK
    }

    // Broken link
    return resolved;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const label = path.relative(path.join(__dirname, '..'), DOCS_DIR) || 'docs';
    console.log(`Checking internal links in ${label}/...\n`);

    if (!fs.existsSync(DOCS_DIR)) {
        console.error(`Error: ${label}/ directory not found. Run "node scripts/build.js" first.`);
        process.exit(1);
    }

    const htmlFiles = walkDir(DOCS_DIR);
    console.log(`  HTML files: ${htmlFiles.length}`);

    let totalLinks = 0;
    let internalLinks = 0;
    const broken = [];

    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, 'utf-8');
        const links = extractLinks(html, file);
        totalLinks += links.length;

        for (const link of links) {
            const result = resolveLink(link.href, link.source);
            if (result === null && !link.href.startsWith('http')) {
                internalLinks++;
            }
            if (result !== null) {
                internalLinks++;
                const relSource = path.relative(DOCS_DIR, link.source);
                broken.push({
                    source: relSource,
                    line: link.line,
                    href: link.href,
                    resolved: path.relative(DOCS_DIR, result)
                });
            }
        }
    }

    console.log(`  Total links: ${totalLinks}`);
    console.log(`  Internal links checked: ${internalLinks}`);

    if (broken.length === 0) {
        console.log('\n  All internal links valid.');
        process.exit(0);
    }

    console.log(`\n  BROKEN LINKS (${broken.length}):\n`);

    // Group by source file
    const bySource = {};
    for (const b of broken) {
        if (!bySource[b.source]) bySource[b.source] = [];
        bySource[b.source].push(b);
    }

    for (const [source, items] of Object.entries(bySource)) {
        console.log(`  ${source}:`);
        for (const item of items) {
            console.log(`    Line ${item.line}: ${item.href}`);
            console.log(`      → resolves to: ${item.resolved} (not found)`);
        }
        console.log('');
    }

    console.log(`Result: ${broken.length} broken internal link${broken.length !== 1 ? 's' : ''} found.`);
    process.exit(1);
}

main();
