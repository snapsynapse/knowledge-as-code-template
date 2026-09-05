'use strict';

function quotedScalar(raw, quote) {
    let value = '';
    let closingIndex = -1;

    if (quote === '"') {
        for (let i = 1; i < raw.length; i++) {
            if (raw[i] === '"') {
                let backslashes = 0;
                for (let j = i - 1; j >= 0 && raw[j] === '\\'; j--) backslashes++;
                if (backslashes % 2 === 0) {
                    closingIndex = i;
                    break;
                }
            }
        }
        if (closingIndex === -1) throw new Error('Unterminated double-quoted scalar.');
        const token = raw.slice(0, closingIndex + 1);
        try {
            value = JSON.parse(token);
        } catch (error) {
            throw new Error(`Invalid escape in double-quoted scalar: ${error.message}`);
        }
    } else {
        for (let i = 1; i < raw.length; i++) {
            if (raw[i] !== "'") {
                value += raw[i];
                continue;
            }
            if (raw[i + 1] === "'") {
                value += "'";
                i++;
                continue;
            }
            closingIndex = i;
            break;
        }
        if (closingIndex === -1) throw new Error('Unterminated single-quoted scalar.');
    }

    const remainder = raw.slice(closingIndex + 1);
    if (remainder && !/^\s+#.*$/.test(remainder) && !/^\s+$/.test(remainder)) {
        throw new Error('Only whitespace or an inline comment may follow a quoted scalar.');
    }
    return value;
}

function unquotedScalar(raw) {
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '#' && (i === 0 || /\s/.test(raw[i - 1]))) {
            return raw.slice(0, i).trimEnd();
        }
    }
    return raw;
}

function parseScalarToken(value, coerceSimpleValues = true) {
    const raw = String(value ?? '').trim();
    if (!raw || raw.startsWith('#')) return { hasValue: false, value: '' };

    if (raw[0] === '"' || raw[0] === "'") {
        return { hasValue: true, value: quotedScalar(raw, raw[0]) };
    }

    const scalar = unquotedScalar(raw).trim();
    if (!scalar) return { hasValue: false, value: '' };
    if (!coerceSimpleValues) return { hasValue: true, value: scalar };
    if (scalar === 'true') return { hasValue: true, value: true };
    if (scalar === 'false') return { hasValue: true, value: false };
    if (scalar === '[]') return { hasValue: true, value: [] };
    if (scalar === '{}') return { hasValue: true, value: {} };
    return { hasValue: true, value: scalar };
}

function parseScalar(value, coerceSimpleValues = true) {
    return parseScalarToken(value, coerceSimpleValues).value;
}

function parseYaml(content) {
    const lines = content.split(/\r?\n/);
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
                    if (ci !== -1) obj[pair.slice(0, ci).trim()] = parseScalar(pair.slice(ci + 1));
                });
                const parent = stack[stack.length - 1].obj;
                const lastKey = stack[stack.length - 1].lastListKey;
                if (lastKey && Array.isArray(parent[lastKey])) parent[lastKey].push(obj);
                continue;
            }

            if (lineContent.startsWith('"') || lineContent.startsWith("'")) {
                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;
                if (listKey && Array.isArray(parent[listKey])) {
                    try {
                        parent[listKey].push(parseScalar(lineContent));
                    } catch (error) {
                        throw new Error(`Invalid YAML scalar on line ${i + 1}: ${error.message}`);
                    }
                }
                continue;
            }

            const ci = lineContent.indexOf(':');
            if (ci !== -1) {
                const k = lineContent.slice(0, ci).trim();
                const rawV = lineContent.slice(ci + 1).trim();
                let scalarToken;
                try {
                    scalarToken = parseScalarToken(rawV);
                } catch (error) {
                    throw new Error(`Invalid YAML scalar on line ${i + 1}: ${error.message}`);
                }
                const v = scalarToken.value;
                const nextI = i + 1;
                const hasChildren = nextI < lines.length &&
                    lines[nextI].trim() !== '' && !lines[nextI].trim().startsWith('#') &&
                    !lines[nextI].trim().startsWith('- ') &&
                    lines[nextI].search(/\S/) > indent;

                const parent = stack[stack.length - 1].obj;
                const listKey = stack[stack.length - 1].lastListKey;

                if (hasChildren || !scalarToken.hasValue) {
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
                    parent[listKey].push(parseScalar(lineContent));
                }
            }
            continue;
        }

        const ci = trimmed.indexOf(':');
        if (ci === -1) continue;

        const key = trimmed.slice(0, ci).trim();
        const rawVal = trimmed.slice(ci + 1).trim();
        let scalarToken;
        try {
            scalarToken = parseScalarToken(rawVal);
        } catch (error) {
            throw new Error(`Invalid YAML scalar on line ${i + 1}: ${error.message}`);
        }
        const val = scalarToken.value;
        const parent = stack[stack.length - 1].obj;

        if (!scalarToken.hasValue) {
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
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) return { frontmatter: {}, body: content };

    const frontmatter = {};
    let currentKey = null;
    let listValues = [];

    match[1].split(/\r?\n/).forEach((line, index) => {
        if (!line.trim() || line.trim().startsWith('#')) return;
        if (line.match(/^\s+-\s+/)) {
            if (currentKey) {
                try {
                    const token = parseScalarToken(line.replace(/^\s+-\s+/, ''), false);
                    if (token.hasValue) listValues.push(token.value);
                } catch (error) {
                    throw new Error(`Invalid frontmatter scalar on line ${index + 2}: ${error.message}`);
                }
            }
            return;
        }
        if (currentKey && listValues.length > 0) {
            frontmatter[currentKey] = listValues;
            listValues = [];
            currentKey = null;
        }
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            const rawValue = valueParts.join(':');
            let token;
            try {
                token = parseScalarToken(rawValue, false);
            } catch (error) {
                throw new Error(`Invalid frontmatter scalar on line ${index + 2}: ${error.message}`);
            }
            if (!token.hasValue) {
                currentKey = key.trim();
            } else {
                frontmatter[key.trim()] = token.value;
                currentKey = null;
            }
        }
    });
    if (currentKey && listValues.length > 0) {
        frontmatter[currentKey] = listValues;
    }

    return {
        frontmatter,
        body: content.slice(match[0].length).trim().replace(/\r\n/g, '\n')
    };
}

module.exports = {
    parseFrontmatter,
    parseScalar,
    parseYaml
};
