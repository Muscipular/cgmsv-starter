import {decode} from "@sciter";
import {fs, cwd} from "@sys";
import {mapping} from "./mapping.mjs";
import * as shell from "@shell";

/**
 * @returns {Promise<Data>}
 */
export async function readConfig() {
    let data;
    try {
        data = await fs.readFile(fs.realpathSync(cwd() + '\\config.json'));
    } catch (e) {
        throw new Error("启动失败:配置文件不存在 " + cwd() + '\\config.json');
    }
    try {
        data = JSON.parse(decode(data));
    } catch (e) {
        throw new Error("启动失败:配置文件错误");
    }
    return data;
}

/**
 *
 * @param s {string}
 * @param flag {number}
 * @param ip {string}
 * @param port {string|number}
 * @returns {Promise<void>}
 */
export async function startCG(s, flag, ip, port) {
    let path = fs.realpathSync(s);
    const params = ['updated'];

    let rPos = path.lastIndexOf('\\');
    console.log(path, rPos);

    let dir = rPos >= 0 ? path.slice(0, rPos) : fs.realpathSync('file://./');

    console.log('files ' + dir + '\\bin');
    let files = (await shell.readdir(dir + '\\bin')).filter(e => /\.bin$/.test(e.path));
    console.log('files' + files.length);

    for (const {path, name} of files) {
        for (const [i, k, ri, rk] of mapping) {
            let mi = ri.exec(path);
            if (mi) {
                params.push(i + mi[1]);
                break;
            } else {
                let mk = rk.exec(path);
                if (mk) {
                    params.push(k + mk[1]);
                    break;
                }
            }
        }
    }

    params.push('3Ddevice:' + (flag & 7));
    if (!(flag & 32)) {
        params.push('windowmode')
    }
    if (!(flag & 8)) {
        params.push('musicoff')
    } else {
        params.push('musicon')
    }
    if (!(flag & 16)) {
        params.push('soundoff')
    } else {
        params.push('soundon')
    }

    files = null;
    params.push(`IP:0:${ip || '127.0.0.1'}:${port || 9030}`)

    console.log(params.join(' '));
    shell.launch(path, params.join(' '));

}