'use strict';

function parseYaml(content) {
    const lines = content.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -2 }];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (raw.trim() === '' || raw.trim().startsWith('#')) continue;

        const indent = raw.search(/\S/);
        const trimmed = raw.trim();

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

        const isList = trimmed.startsWith('- ');
        const lineContent = isList ? trimmed.slice(2).trim() : trimmed;

        if (isList) {
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

            const ci = lineContent.indexOf(':');
            if (ci !== -1) {
                const k = lineContent.slice(0, ci).trim();
                const v = lineContent.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
                const nextI = i + 1;
                const hasChildren = nextI < lines.length &&
                    lines[nextI].trim() !== '' && !lines[nextI].trim().startsWith('#') &&
                    !lines[nextI].trim().startsWith('- ') &&
                    lines[nextI].search(/\S/) > indent;

                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;

                if (hasChildren || v === '') {
                    const obj = {};
                    if (v) obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) parent[listKey].push(obj);
                    stack.push({ obj, indent, lastListKey: null });
                } else {
                    const obj = {};
                    obj[k] = v;
                    if (listKey && Array.isArray(parent[listKey])) parent[listKey].push(obj);
                }
            } else {
                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;
                if (listKey && Array.isArray(parent[listKey])) {
                    parent[listKey].push(lineContent.replace(/^["']|["']$/g, ''));
                }
            }
            continue;
        }

        const ci = trimmed.indexOf(':');
        if (ci === -1) continue;

        const key = trimmed.slice(0, ci).trim();
        const val = trimmed.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
        const parent = stack[stack.length - 1].obj;

        if (val === '') {
            const nextI = i + 1;
            let nextNonEmpty = null;
            for (let j = nextI; j < lines.length; j++) {
                if (lines[j].trim() && !lines[j].trim().startsWith('#')) {
                    nextNonEmpty = lines[j].trim();
                    break;
                }
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

module.exports = {
    parseFrontmatter,
    parseYaml
};
