import {load} from "./js-yaml.mjs";

const fields = ["Graphic", "GraphicInfo", "Anime", "AnimeInfo", "Coordinate", "CoordinateInfo"];

function resource(path) {
    const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
    const slash = normalized.lastIndexOf("/");
    const match = /^(graphic|anime|coordinate)(info)?(.*)\.bin$/i.exec(normalized.slice(slash + 1));
    if (!match) return null;
    const suffix = match[3].toLowerCase();
    const version = /^_joy_ch\d+$/.test(suffix) ? null : /(\d+)$/.exec(suffix);
    return {
        kind: match[1].toLowerCase(),
        info: !!match[2],
        directory: normalized.slice(0, slash).toLowerCase(),
        suffix,
        family: version ? suffix.slice(0, -version[1].length) : suffix,
        version: version ? version[1].replace(/^0+(?=\d)/, "") : "0",
        path: normalized.replace(/\//g, "\\"),
    };
}

function resourcePairs(files) {
    const pairs = new Map();
    for (const path of files) {
        const item = resource(path);
        if (!item) continue;
        const key = `${item.directory}/${item.kind}/${item.suffix}`;
        if (!pairs.has(key)) pairs.set(key, {...item, data: "", infoPath: ""});
        const pair = pairs.get(key);
        const side = item.info ? "infoPath" : "data";
        if (pair[side]) throw new Error("发现重名资源，无法唯一选择：" + path);
        pair[side] = item.path;
    }
    return [...pairs.values()].filter(pair => pair.data && pair.infoPath);
}

function namedFamily(name) {
    const group = name.replace(/^\[|\]$/g, "").toLowerCase();
    if (group === "base") return {directory: "bin", family: "_"};
    if (group === "ex") return {directory: "bin", family: "ex_"};
    if (group === "a1") return {directory: "bin", family: "_v"};
    if (/^v[123]$/.test(group)) return {directory: "bin", family: group + "_"};
    if (/^puk\d+$/.test(group)) return {directory: "bin/" + group, family: "_" + group + "_"};
    if (/^joy(?:_ex)?$/.test(group)) return {directory: "bin", family: "_" + group + "_"};
    if (/^joy_ch\d+$/.test(group)) return {directory: "bin", family: "_" + group};
    return null;
}

function configuredFamily(group, kind) {
    let family = null;
    for (const key of fields.filter(key => key.toLowerCase().startsWith(kind))) {
        if (!group[key]) continue;
        const item = resource(group[key]);
        if (!item) continue;
        if (item.kind !== kind) throw new Error("现有资源路径与字段类型不一致：" + key);
        if (family && (family.directory !== item.directory || family.family !== item.family))
            throw new Error("同组的数据与 Info 指向不同资源类别：" + group.Name);
        family = item;
    }
    return family;
}

function largestPair(pairs, family, kind) {
    let best = null;
    let ambiguous = false;
    if (!family) return null;
    for (const pair of pairs) {
        if (pair.kind !== kind || pair.directory !== family.directory || pair.family !== family.family) continue;
        if (!best || pair.version.length > best.version.length
            || (pair.version.length === best.version.length && pair.version > best.version)) {
            best = pair;
            ambiguous = false;
        } else if (pair.version === best.version) {
            ambiguous = true;
        }
    }
    if (ambiguous) throw new Error("同类最大编号有多套资源，无法唯一选择");
    return best;
}

// 这里只定位源文本，不解析 YAML 的值；结构与最终结果都由 js-yaml 校验。
function tokens(text) {
    const result = [];
    let position = 0, line = 0, lineStart = 0, depth = 0;
    const advance = end => {
        while (position < end) {
            const character = text[position++];
            if (character === "\r") {
                if (text[position] === "\n" && position < end) ++position;
                ++line;
                lineStart = position;
            } else if (character === "\n") {
                ++line;
                lineStart = position;
            }
        }
    };
    while (position < text.length) {
        const character = text[position];
        if (/\s/.test(character)) {
            advance(position + (character === "\r" && text[position + 1] === "\n" ? 2 : 1));
            continue;
        }
        if (character === "#") {
            let end = position;
            while (end < text.length && !/[\r\n]/.test(text[end])) ++end;
            advance(end);
            continue;
        }
        const token = {start: position, end: position, line, lineStart, column: position - lineStart, depth, kind: "scalar"};
        let end = position + 1;
        if ("[]{}:,".includes(character)) {
            token.kind = character;
            if ("[{".includes(character)) ++depth;
            if ("]}".includes(character)) --depth;
        } else if (character === "-" && /[\s]|^$/.test(text[position + 1] || "")) {
            token.kind = "-";
        } else if (character === "'" || character === '"') {
            let closed = false;
            while (end < text.length) {
                if (character === '"' && text[end] === "\\") { end += 2; continue; }
                if (text[end++] !== character) continue;
                if (character === "'" && text[end] === "'") { ++end; continue; }
                closed = true;
                break;
            }
            if (!closed) throw new Error("YAML 引号未闭合");
        } else if ("&*!".includes(character)) {
            token.kind = character === "*" ? "alias" : "property";
            while (end < text.length && !/[\s,\[\]{}]/.test(text[end])) ++end;
        } else if ((character === "|" || character === ">")
            && /^[|>][1-9+-]*(?:\s|#|$)/.test(text.slice(position))) {
            const prefix = text.slice(lineStart, position);
            const indent = /^ */.exec(prefix)[0].length + (/^ *- /.test(prefix) ? 2 : 0);
            while (end < text.length && !/[\r\n]/.test(text[end])) ++end;
            while (end < text.length) {
                const next = end + (text[end] === "\r" && text[end + 1] === "\n" ? 2 : 1);
                let last = next;
                while (last < text.length && !/[\r\n]/.test(text[last])) ++last;
                const content = text.slice(next, last);
                if (content.trim() && /^ */.exec(content)[0].length <= indent) { end = next; break; }
                end = last;
            }
        } else {
            while (end < text.length && !/[\r\n]/.test(text[end])) {
                if (depth && /[,\[\]{}]/.test(text[end])) break;
                if (text[end] === ":" && /[\s,\[\]{}'"]|^$/.test(text[end + 1] || "")) break;
                if (text[end] === "#" && /\s/.test(text[end - 1])) break;
                ++end;
            }
            while (end > position && /[ \t]/.test(text[end - 1])) --end;
        }
        token.end = end;
        token.raw = text.slice(position, end);
        result.push(token);
        advance(end);
    }
    return result;
}

function keyOf(token) {
    if (token.kind !== "scalar") return null;
    if (/^['"]/.test(token.raw)) return load("value: " + token.raw).value;
    return token.raw;
}

function closing(list, start) {
    const end = list[start].kind === "[" ? "]" : "}";
    for (let index = start + 1; index < list.length; ++index)
        if (list[index].kind === end && list[index].depth === list[start].depth + 1) return index;
    throw new Error("YAML 集合未闭合");
}

function groupLayout(list, start, end, textLength) {
    const flow = list[start]?.kind === "{";
    const stop = flow ? closing(list, start) : end;
    const candidates = [];
    const groupDepth = flow ? list[start].depth + 1 : list[start].depth;
    for (let index = start + (flow ? 1 : 0); index < stop; ++index)
        if (list[index].depth === groupDepth && list[index + 1]?.kind === ":")
            candidates.push(index);
    const indent = flow ? null : Math.min(...candidates.map(index => list[index].column));
    const slots = new Map();
    for (const index of candidates) {
        const key = list[index];
        if (!flow && key.column !== indent) continue;
        const name = keyOf(key);
        if (slots.has(name)) throw new Error("资源组存在重复字段：" + name);
        const colon = list[index + 1];
        let value = index + 2;
        while (list[value]?.kind === "property") ++value;
        const first = list[value];
        const empty = value >= stop || !first || first.kind === "," || first.kind === "}"
            || (!flow && first.line > colon.line && first.column <= key.column);
        let last = value;
        if (!empty && !flow && first.kind === "scalar") {
            while (last + 1 < stop && list[last + 1].depth === groupDepth
                && list[last + 1].line > list[last].line && list[last + 1].column > key.column
                && list[last + 2]?.kind !== ":") ++last;
        }
        slots.set(name, empty ? {start: colon.end, end: colon.end, empty: true}
            : {start: first.start, end: list[last].end, empty: false});
    }
    if (!slots.has("Name")) throw new Error("无法定位现有资源组的 Name");
    return {
        slots, flow, indent,
        trailingComma: flow && list[stop - 1]?.kind === ",",
        insert: flow ? list[stop].start : end < list.length ? list[end].lineStart : textLength,
    };
}

function layouts(text, count) {
    const list = tokens(text);
    const first = list.find(token => token.raw !== "---" && !token.raw.startsWith("%"));
    const rootFlow = first?.kind === "{";
    const rootDepth = rootFlow ? 1 : 0;
    const rootKeys = list.filter((token, index) => token.depth === rootDepth && list[index + 1]?.kind === ":");
    const rootIndent = Math.min(...rootKeys.map(token => token.column));
    const headers = [];
    for (let index = 0; index < list.length; ++index) {
        const token = list[index];
        if (token.depth === rootDepth && (rootFlow || token.column === rootIndent)
            && keyOf(token) === "BinLoader" && list[index + 1]?.kind === ":") headers.push(index);
    }
    if (headers.length !== 1) throw new Error("无法唯一定位顶层 BinLoader，配置未修改");
    let start = headers[0] + 2;
    while (list[start]?.kind === "property") ++start;
    const result = [];
    if (list[start]?.kind === "[") {
        const end = closing(list, start);
        for (let index = start + 1; index < end;) {
            if (list[index].kind === ",") { ++index; continue; }
            if (list[index].kind !== "{") throw new Error("无法定位 BinLoader 中的资源组");
            const last = closing(list, index);
            result.push(groupLayout(list, index, last, text.length));
            index = last + 1;
        }
    } else {
        if (list[start]?.kind !== "-") throw new Error("无法定位 BinLoader 序列");
        const indent = list[start].column;
        const starts = [];
        let end = list.length;
        for (let index = start; index < list.length; ++index) {
            const token = list[index];
            if (token.depth !== rootDepth) continue;
            if (token.column < indent || (token.column === indent && token.kind !== "-")) { end = index; break; }
            if (token.kind === "-" && token.column === indent) starts.push(index);
        }
        for (let index = 0; index < starts.length; ++index)
            result.push(groupLayout(list, starts[index] + 1, starts[index + 1] ?? end, text.length));
    }
    if (result.length !== count) throw new Error("BinLoader 组别定位与解析结果不一致，配置未修改");
    return result;
}

function equal(left, right, seen = new Map()) {
    if (left === right) return true;
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    if (left instanceof Date || right instanceof Date)
        return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
    if (seen.get(left)?.has(right)) return true;
    if (!seen.has(left)) seen.set(left, new Set());
    seen.get(left).add(right);
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length
        && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key], seen));
}

function quoted(path) {
    return path ? "'" + path.replace(/'/g, "''") + "'" : '""';
}

export function updateBinLoader(text, files) {
    const configuration = load(text);
    const groups = configuration?.BinLoader;
    if (!Array.isArray(groups) || groups.length < 1 || groups.length > 32)
        throw new Error("BinLoader 必须包含 1–32 个现有组");
    const source = layouts(text, groups.length);
    const pairs = resourcePairs(files);
    const ending = /\r\n|\r|\n/.exec(text)?.[0] || "\n";
    const edits = [];
    const updatedGroups = groups.map((group, index) => {
        if (!group || typeof group !== "object" || typeof group.Name !== "string")
            throw new Error("BinLoader 资源组必须包含字符串 Name");
        for (const key of fields)
            if (group[key] != null && typeof group[key] !== "string")
                throw new Error("资源路径必须是字符串：" + key);
        const result = {...group};
        const kinds = ["graphic", "anime", "coordinate"];
        const families = kinds.map(kind => configuredFamily(group, kind));
        const fallback = namedFamily(group.Name) || families.find(Boolean);
        const layout = source[index];
        const missing = [];
        for (let kind = 0; kind < kinds.length; ++kind) {
            const pair = largestPair(pairs, families[kind] || fallback, kinds[kind]);
            for (let side = 0; side < 2; ++side) {
                const key = fields[kind * 2 + side];
                const path = pair ? (side ? pair.infoPath : pair.data) : "";
                if (typeof group[key] === "string"
                    && group[key].replace(/\//g, "\\").toLowerCase() === path.toLowerCase()) continue;
                if (!(key in group) && !path) continue;
                result[key] = path;
                const slot = layout.slots.get(key);
                if (!slot) {
                    missing.push(key + ": " + quoted(path));
                } else {
                    const trailing = /(?:\r\n|\r|\n)$/.test(text.slice(slot.start, slot.end)) ? ending : "";
                    edits.push({...slot, replacement: (slot.empty ? " " : "") + quoted(path) + trailing});
                }
            }
        }
        if (missing.length) {
            const prefix = layout.insert && !/[\r\n]/.test(text[layout.insert - 1]) ? ending : "";
            const replacement = layout.flow ? (layout.trailingComma ? " " : ", ") + missing.join(", ")
                : prefix + missing.map(field => " ".repeat(layout.indent) + field + ending).join("");
            edits.push({start: layout.insert, end: layout.insert, replacement});
        }
        return result;
    });
    let updated = text, boundary = text.length;
    for (const edit of edits.sort((left, right) => right.start - left.start)) {
        if (edit.end > boundary) throw new Error("YAML 更新位置重叠，配置未修改");
        updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
        boundary = edit.start;
    }
    if (!equal(load(updated), {...configuration, BinLoader: updatedGroups}))
        throw new Error("YAML 更新校验失败，配置未修改");
    return updated;
}