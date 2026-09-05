'use strict';

const fs = require('fs');
const path = require('path');

function refuse(outputDir, detail = '') {
    const suffix = detail ? ` (${detail})` : '';
    throw new Error(`Refusing to clean unsafe output directory: ${outputDir}${suffix}`);
}

function assertOwnedChild(entry, outputDir) {
    if (typeof entry !== 'string' || !entry || path.isAbsolute(entry) ||
        entry === '.' || entry === '..' || path.dirname(entry) !== '.') {
        refuse(outputDir, `invalid generated path: ${String(entry)}`);
    }
}

/**
 * Confirm that an output directory is a direct or nested child of the repository
 * and that no existing component below the repository root is a symbolic link.
 * Symlinks above the repository boundary are intentionally ignored so platform
 * aliases such as macOS /tmp -> /private/tmp do not reject an otherwise safe path.
 */
function assertSafeOutputDirectory(repoRoot, outputDir) {
    const resolvedRepoRoot = path.resolve(repoRoot);
    const resolvedOutputDir = path.resolve(outputDir);
    const relative = path.relative(resolvedRepoRoot, resolvedOutputDir);

    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        refuse(outputDir);
    }

    let current = resolvedRepoRoot;
    for (const segment of relative.split(path.sep)) {
        current = path.join(current, segment);
        let stat;
        try {
            stat = fs.lstatSync(current);
        } catch (err) {
            if (err.code === 'ENOENT') break;
            throw err;
        }

        if (stat.isSymbolicLink()) {
            refuse(outputDir, `symbolic link in output path: ${current}`);
        }
        if (!stat.isDirectory()) {
            refuse(outputDir, `non-directory in output path: ${current}`);
        }
    }

    return resolvedOutputDir;
}

function cleanGeneratedOutput({ repoRoot, outputDir, ownedDirs = [], ownedFiles = [] }) {
    const resolvedOutputDir = assertSafeOutputDirectory(repoRoot, outputDir);

    for (const entry of [...ownedDirs, ...ownedFiles]) {
        assertOwnedChild(entry, outputDir);
    }

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    for (const dir of ownedDirs) {
        fs.rmSync(path.join(resolvedOutputDir, dir), { recursive: true, force: true });
    }
    for (const file of ownedFiles) {
        fs.rmSync(path.join(resolvedOutputDir, file), { force: true });
    }
}

module.exports = {
    assertSafeOutputDirectory,
    cleanGeneratedOutput
};
