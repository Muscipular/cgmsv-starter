import {$, decode} from "@sciter"
import {fs} from "@sys"
import {alert} from "./common.mjs"
import {readConfig, startCG} from "./cg.mjs";
import * as shell from "@shell";

const {signal} = Reactor;

const Title = () => {
    return <div class={"windows-caption-area"}>
        <div class={"windows-caption"} role={"window-caption"}>
            <div class={"windows-icon"} role={'window-icon'}></div>
            <div class={"windows-title"} title="CGMSV">CGMSV</div>
            {__DEBUG && <button id={"reload"} accesskey="!F5" title="reload html"
                                onClick={(e) => {
                                    stopEngine();
                                    Window.this.load(window.location);
                                }}>Reload
            </button>}
        </div>
        <button class={"windows-close"} role={"window-close"}></button>
    </div>
}

const engineState = signal(false);
const check = signal(0);
let enginePid = 0;
let engineChecker = 0;
let hide = false;

const App = () => {
    return <div class={'app-container'}>
        <div class={'step-block'}>
            <h1>官网: <a href="https://www.cgmsv.com" target="@system">www.cgmsv.com</a></h1>
            <h1>论坛: <a href="https://bbs.cgmsv.com" target="@system">bbs.cgmsv.com</a></h1>
        </div>
        <div class={'step-block'}>
            <h1>1. 启动引擎</h1>
            {!engineState.value ? <button onClick={() => startEngine()}>启动引擎</button> : <button class={'red-button'} onClick={() => stopEngine()}>停止引擎</button>}
            {engineState.value && <button onclick={() => toggleView()}>隐藏/显示</button>}
        </div>
        <div class={'step-block'}>
            <h1>2. 开始游戏</h1>
            {/*<input type="text" placeholder={"账号"}/>*/}
            {/*<input type="text" placeholder={"密码"}/>*/}
            <label><input type="checkbox" onChange={e => checkValue(8, e)} checked={check.value & 8} onCheck/>音乐</label>
            <label><input type="checkbox" onChange={e => checkValue(16, e)} checked={check.value & 16}/>音效</label>
            <label><input type="checkbox" onChange={e => checkValue(32, e)} checked={check.value & 32}/>全屏</label>
            <label><select as='integer' onChange={e => selectValue(e)}>{[4, 3, 2, 1].map(e => <option value={e + ''} selected={check.value & 7}>{e}档</option>)}</select></label>
            <button onClick={() => startGame()}>开始游戏</button>
        </div>
    </div>
}


function checkValue(flg, e) {
    let v = (check.value & ~flg) | (e.target.checked ? flg : 0);
    check.value = v;
    check.send(v);
    // console.log([flg, e.target.checked, e.target.value, v, check.value]);
}

function selectValue(e) {
    let v = (check.value & ~7) | (+e.target.value);
    check.value = v;
    check.send(v);
    // console.log([e.target.checked, e.target.value, v, check.value]);
}

async function startEngine() {
    console.log('startEngine');
    engineState.value = true;
    engineState.send(true);
    let data = await readConfig().catch(e => alert(e));
    if (!data || !data.gmsv) {
        return;
    }
    try {
        enginePid = shell.launch(fs.realpathSync(data.gmsv));
        if (!enginePid) {
            engineState.value = false;
            engineState.send(false);
            return;
        }
        hide = false;
        setTimeout(() => {
            if (!hide) toggleView()
        }, 3000)
    } catch (e) {
        alert('启动失败,请检查配置和data');
    }
    startChecker();
}

function toggleView() {
    if (hide)
        shell.show(enginePid)
    else
        shell.hide(enginePid)
    hide = !hide;
}

function stopEngine() {
    console.log('stopEngine');
    if (enginePid) {
        hide = true;
        toggleView();
        shell.ctrl_c(enginePid);
    }
}

async function startGame() {
    let data = await readConfig().catch(e => alert(e));
    if (!data || !data.exe) {
        return;
    }
    await startCG(data.exe, check.value, data.ip, data.port);
}


function main() {
    $("#app").append([<Title/>, <App/>]);
    Window.this.on("closerequest", event => {
        console.log('close ' + event.reason)
        if (enginePid)
            shell.ctrl_c(enginePid);
    });
    findPid().finally(() => 0);
}

async function findPid() {
    let data = await readConfig().catch(e => alert(e));
    if (!data || !data.gmsv) {
        return;
    }
    console.log('start find pid ' + data.gmsv);
    try {
        let pids = await shell.find_pid(fs.realpathSync(data.gmsv));
        console.log("pids:");
        console.log(pids);
        if (pids && pids[0]) {
            enginePid = pids[0];
            engineState.value = true;
            engineState.send(true);
            hide = false;
            pids = null;
            startChecker();
        } else {
            if (!data.ip || data.ip !== '127.0.0.1') {
                startEngine().finally(() => 0);
            }
        }
    } catch (e) {
        console.log(e);
    }
}

function startChecker() {
    clearInterval(engineChecker);
    engineChecker = setInterval(() => {
        if (!shell.is_live(enginePid)) {
            clearInterval(engineChecker);
            engineChecker = null;
            enginePid = null;
            engineState.value = false;
            engineState.send(false);
        }
    }, 1000);
}

main();
