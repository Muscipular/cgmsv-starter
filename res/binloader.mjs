import {decode, encode} from "@sciter";
import {fs} from "@sys";
import {updateBinLoader} from "./mapping.mjs";

function sameBytes(left, right) {
    const a = new Uint8Array(left), b = new Uint8Array(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function textFile(buffer) {
    const bytes = new Uint8Array(buffer);
    let bom = 0, encoding = "utf-8";
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) bom = 3;
    else if (bytes[0] === 0xFF && bytes[1] === 0xFE) { bom = 2; encoding = "utf-16le"; }
    else if (bytes[0] === 0xFE && bytes[1] === 0xFF) { bom = 2; encoding = "utf-16be"; }
    const payload = bytes.slice(bom);
    const text = decode(payload.buffer, encoding);
    if (!sameBytes(payload.buffer, encode(text, encoding)))
        throw new Error("cgmsv.yml 无法按原编码无损读取，配置未修改");
    return {
        text,
        bytes(updated) {
            const body = new Uint8Array(encode(updated, encoding));
            const result = new Uint8Array(bom + body.length);
            result.set(bytes.subarray(0, bom));
            result.set(body, bom);
            return result.buffer;
        },
    };
}

async function scan(directory) {
    const files = [], pending = ["bin"];
    while (pending.length) {
        const relative = pending.pop();
        const entries = await fs.readdir(directory + "/" + relative);
        const children = [];
        try {
            for await (const entry of entries) children.push(entry);
        } finally {
            await entries.close();
        }
        for (const {name, type} of children) {
            const path = relative + "/" + name;
            if (type === fs.UV_DIRENT_DIR) pending.push(path);
            else if (type === fs.UV_DIRENT_FILE && /\.bin$/i.test(name)) files.push(path);
            else if (type === fs.UV_DIRENT_LINK || type === fs.UV_DIRENT_UNKNOWN)
                throw new Error("资源目录包含链接或无法识别的目录项：" + path);
        }
    }
    return files;
}

async function save(path, original, updated) {
    const temporary = await fs.mkstemp(path + ".starter.XXXXXX");
    const temporaryPath = temporary.path;
    let closed = false, replaced = false;
    try {
        const bytes = new Uint8Array(updated);
        for (let offset = 0; offset < bytes.length;) {
            const written = await temporary.write(bytes.subarray(offset, Math.min(offset + 1024 * 1024, bytes.length)));
            if (!(written > 0)) throw new Error("cgmsv.yml 临时文件写入不完整");
            offset += written;
        }
        await temporary.close();
        closed = true;
        if (!sameBytes(await fs.readFile(temporaryPath), updated))
            throw new Error("cgmsv.yml 临时文件校验失败");
        if (!sameBytes(await fs.readFile(path), original))
            throw new Error("cgmsv.yml 已被其他程序修改，请重新启动");
        await fs.rename(temporaryPath, path);
        replaced = true;
    } finally {
        try {
            if (!closed) await temporary.close();
        } finally {
            if (!replaced) {
                try { await fs.unlink(temporaryPath); }
                catch (error) { console.log("清理临时配置失败：" + temporaryPath + "，" + error); }
            }
        }
    }
}

export async function refreshBinLoader(executable) {
    const normalized = executable.replace(/\\/g, "/");
    const directory = normalized.slice(0, normalized.lastIndexOf("/"));
    const path = directory + "/cgmsv.yml";
    try {
        const original = await fs.readFile(path);
        const file = textFile(original);
        const updated = updateBinLoader(file.text, await scan(directory));
        if (updated !== file.text) await save(path, original, file.bytes(updated));
    } catch (error) {
        throw new Error("更新资源配置失败：" + path + "\n" + (error?.message || error));
    }
}
