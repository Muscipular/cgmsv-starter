import {decode} from "@sciter";
import {fs, cwd} from "@sys";
import {refreshBinLoader} from "./binloader.mjs";
import * as shell from "@shell";

export const resolutions = ["640*480", "720*540", "800*600", "1024*768"];

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
        data = JSON.parse(decode(data, "utf-8"));
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
 * @param resolution {string}
 * @returns {Promise<void>}
 */
export async function startCG(s, flag, ip, port, resolution = resolutions[0]) {
    if (!resolutions.includes(resolution)) {
        throw new Error("启动失败：不支持的分辨率 " + resolution);
    }
    const [width, height] = resolution.split("*");
    let path = fs.realpathSync(s);
    const params = ['3Ddevice:' + (flag & 7), `/width:${width}`, `/height:${height}`];
    await refreshBinLoader(path);
    if (!(flag & 8)) {
        params.push('musicoff')
    }
    if (!(flag & 16)) {
        params.push('soundoff')
    }

    params.push(`IP:0:${ip || '127.0.0.1'}:${port || 9030}`)

    console.log(params.join(' '));
    shell.launch(path, params.join(' '));

}