#include "JsExtW.h"

#include "windows.h"
#include "shellapi.h"
//#include "../utils.hpp"
#include "filesystem"

#include <tlhelp32.h>
#include <xdomjs/xview.h>

namespace sciter {
    namespace application {
        const std::vector<sciter::string> &argv();

        HINSTANCE hinstance();
    }
}

using namespace qjs;
using namespace tool;

static value shell_launch(qjs::xcontext &c, ustring exe, ustring param, value hide) {
    sciter::string directory;
    const auto &sExe = exe.to_std();
    const size_t last_slash_idx = sExe.rfind('\\');
    if (std::string::npos != last_slash_idx) {
        directory = sExe.substr(0, last_slash_idx);
    }
    SHELLEXECUTEINFOW si = { 0 };
    si.cbSize = sizeof(SHELLEXECUTEINFO);
    si.fMask = SEE_MASK_NOCLOSEPROCESS;
    si.hwnd = NULL;
    si.lpVerb = L"";
    si.lpFile = exe.c_str();
    si.lpParameters = param.c_str();
    si.lpDirectory = directory.c_str();
    si.nShow = hide.get(false) ? SW_HIDE : SW_SHOW;
    si.hInstApp = NULL;
    ShellExecuteExW(&si);
    int pid = GetProcessId(si.hProcess);
    CloseHandle(si.hProcess);
    return value(pid);
}

HWND FindTopWindow(DWORD pid) {
    std::pair<HWND, DWORD> params = { 0, pid };

    // Enumerate the windows using a lambda to process each window
    BOOL bResult = EnumWindows([](HWND hwnd, LPARAM lParam) -> BOOL {
        auto pParams = (std::pair<HWND, DWORD>*) (lParam);
        if (!IsWindowVisible(hwnd)) {
            return TRUE;
        }
        DWORD processId;
        if (GetWindowThreadProcessId(hwnd, &processId) && processId == pParams->second) {
            // Stop enumerating
            SetLastError(-1);
            pParams->first = hwnd;
            return FALSE;
        }

        // Continue enumerating
        return TRUE;
    }, (LPARAM) &params);

    if (!bResult && GetLastError() == -1 && params.first) {
        return params.first;
    }

    return NULL;
}


static std::vector<HWND> g_windows;

BOOL CALLBACK EnumProc(HWND hwnd, LPARAM lParam) {
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);

    if (pid == (DWORD) lParam) {
        g_windows.push_back(hwnd);
    }

    return TRUE;
}

// 完全隐藏窗口
bool hideWindow(DWORD pid) {
    g_windows.clear();
    EnumWindows(EnumProc, (LPARAM) pid);

    if (g_windows.empty()) {
        return false;
    }

    for (HWND hwnd: g_windows) {
        // 设置窗口样式为工具窗口（不出现在任务栏）
        LONG_PTR exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        exStyle |= WS_EX_TOOLWINDOW;
        exStyle &= ~WS_EX_APPWINDOW;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);

        // 移动到屏幕外并隐藏
//        SetWindowPos(hwnd, NULL, -32000, -32000, 0, 0,
//                     SWP_NOZORDER | SWP_NOSIZE | SWP_NOACTIVATE);
        ShowWindow(hwnd, SW_HIDE);
    }

    return true;
}

// 恢复窗口显示
bool showWindow(DWORD pid) {
    g_windows.clear();
    EnumWindows(EnumProc, (LPARAM) pid);

    if (g_windows.empty()) {
        return false;
    }

    for (HWND hwnd: g_windows) {
        // 恢复窗口样式
        LONG_PTR exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        exStyle &= ~WS_EX_TOOLWINDOW;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);

        // 恢复窗口位置和显示
        ShowWindow(hwnd, SW_SHOW);
        SetForegroundWindow(hwnd);
    }

    return true;
}

static value shell_show(qjs::xcontext &c, value pid) {
    HWND window = FindTopWindow(pid.get_int());
//    printf("show %d %d\n", pid.get_int(), (int) window);
//    if (window) {
//        ShowWindow(window, SW_SHOW);
//    }
    return value(showWindow(pid.get_int()));
}

static value shell_hide(qjs::xcontext &c, value pid) {
    HWND window = FindTopWindow(pid.get_int());
//    printf("hide %d %d\n", pid.get_int(), (int) window);
//    if (window) {
//        ShowWindow(window, SW_HIDE);
//    }
    return value(hideWindow(pid.get_int()));
}

std::vector<uint32_t> GetPidByPath(std::wstring exePath) {
    std::vector<uint32_t> pidList;

    // 创建进程快照
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) {
        return pidList;
    }

    // 初始化进程条目结构
    PROCESSENTRY32W pe32;
    pe32.dwSize = sizeof(PROCESSENTRY32W);

    // 获取第一个进程信息
    if (!Process32FirstW(hSnapshot, &pe32)) {
        CloseHandle(hSnapshot);
        return pidList;
    }

    // 遍历所有进程
    do {
        // 打开进程以获取详细信息
        HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pe32.th32ProcessID);
        if (hProcess != NULL) {
            // 获取进程完整路径
            wchar_t processPath[MAX_PATH];
            DWORD pathSize = MAX_PATH;

            // 使用QueryFullProcessImageName获取完整路径
            if (QueryFullProcessImageNameW(hProcess, 0, processPath, &pathSize)) {
                // 比较路径（不区分大小写）
                if (_wcsicmp(processPath, exePath.c_str()) == 0) {
                    pidList.push_back(pe32.th32ProcessID);
                }
            }

            CloseHandle(hProcess);
        }

    } while (Process32NextW(hSnapshot, &pe32));

    // 清理资源
    CloseHandle(hSnapshot);

    return pidList;
}

DWORD GetParentProcessId(DWORD processId) {
    HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (hSnapshot == INVALID_HANDLE_VALUE) {
        std::cerr << "Failed to create snapshot. Error: " << GetLastError() << std::endl;
        return 0;
    }

    PROCESSENTRY32 pe32;
    pe32.dwSize = sizeof(PROCESSENTRY32);

    DWORD parentId = 0;

    if (Process32First(hSnapshot, &pe32)) {
        do {
            if (pe32.th32ProcessID == processId) {
                parentId = pe32.th32ParentProcessID;
                break;
            }
        } while (Process32Next(hSnapshot, &pe32));
    }

    CloseHandle(hSnapshot);
    return parentId;
}

BOOL send_ctrl_c(DWORD processId) {
//    // 打开目标进程
    if (!AttachConsole(processId)) {
        std::cerr << "Failed to attach to console. Error: " << GetLastError() << std::endl;
        return false;
    }

    // 发送控制台事件
    BOOL result = GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0);

    // 分离控制台
    FreeConsole();
    return TRUE;
}

static value shell_ctrl_c(qjs::xcontext &c, value pid) {
    const auto argv = sciter::application::argv();
    SHELLEXECUTEINFOW si = { 0 };
    si.cbSize = sizeof(SHELLEXECUTEINFO);
    si.fMask = SEE_MASK_NOCLOSEPROCESS;
    si.hwnd = NULL;
    si.lpVerb = L"";
    si.lpFile = argv[0].c_str();
    wchar_t b[256];
    wsprintf(b, L"--kill %d", pid.get_int());
    si.lpParameters = b;
    si.lpDirectory = L"";
    si.nShow = SW_HIDE;
    si.hInstApp = NULL;
    ShellExecuteExW(&si);
    CloseHandle(si.hProcess);
    return value(true);
}

bool process_isLive(DWORD pid) {
    // 使用PROCESS_QUERY_LIMITED_INFORMATION可以获得更好的性能
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (hProcess == NULL) {
        DWORD error = GetLastError();
        // ERROR_INVALID_PARAMETER通常表示进程不存在
        if (error == ERROR_INVALID_PARAMETER) {
            return false;
        }
        // 其他错误可能是权限问题，但仍可能表示进程不存在
        return false;
    }

    DWORD exitCode;
    BOOL result = GetExitCodeProcess(hProcess, &exitCode);
    CloseHandle(hProcess);

    if (!result) {
        return false;
    }

    return (exitCode == STILL_ACTIVE);
}

static value shell_isLive(qjs::xcontext &c, value pid) {
    return value(process_isLive(pid.get_int()));
}

static hvalue shell_findPid(qjs::xcontext &c, ustring path) {
    JSValue resolving_callbacks[2] = { JS_UNINITIALIZED, JS_UNINITIALIZED };
    JSValue promise = JS_NewPromiseCapability(c, resolving_callbacks);

    handle<view> pv = c.pview();
    JSValue resolver = resolving_callbacks[0];
//    hvalue rejector = resolving_callbacks[1];
//    printf("resolve = %d\n", JS_IsFunction(c, resolver));
    std::thread([resolver](auto pv, auto path) {
//        wprintf(L"find %s\n", path.c_str());
        auto pids = GetPidByPath(path.to_std());
//        wprintf(L"find %s %d\n", path.c_str(), pids.size());

//        printf("pview %p ctx %p\n", pv, pv->pdoc.ptr());
        pv->exec([pv, pids, resolver]() {
//            printf("pview %p ctx %p\n", pv, pv->pdoc.ptr());
            if (!pv->pdoc) {
                return;
            }
            xcontext ctx(pv->pdoc);
//            printf("find = %d\n", pids.size());
//            printf("resolve = %d\n", JS_IsFunction(ctx, resolver));
            if (!JS_IsFunction(ctx, resolver)) {
                return;
            }
            auto argv = JS_NewArray(ctx);
            if (!pids.empty()) {
                for (int i = 0; i < pids.size(); ++i) {
                    auto e = JS_NewInt32(ctx, pids[i]);
                    JS_SetPropertyUint32(ctx, argv, i, e);
                }
            }
//            printf("call %d\n", pids.size());

            qjs::microtasks_processor _(ctx.pxview());

            JSValue r = JS_Call(ctx, resolver, JS_UNDEFINED, 1, &argv);
//            printf("call ret %s\n", JS_ToCString(ctx, r));
            JS_FreeValue(ctx, argv);
            JS_FreeValue(ctx, r);
            JS_FreeValue(ctx, resolver);
//            JS_FreeValue(ctx, resolving_callbacks[1]);
        });
    }, pv, path).detach();
    JS_FreeValue(c, resolving_callbacks[1]);
//    JS_FreeValue(c, resolving_callbacks[0]);

    return promise;
}

static hvalue shell_readdir(qjs::xcontext &c, ustring path) {
    JSValue resolving_callbacks[2] = { JS_UNINITIALIZED, JS_UNINITIALIZED };
    JSValue promise = JS_NewPromiseCapability(c, resolving_callbacks);

    handle<view> pv = c.pview();
    JSValue resolver = resolving_callbacks[0];
    std::thread([resolver](handle<view> pv, ustring path) {
        std::filesystem::recursive_directory_iterator it(path.to_std());
        std::vector<std::filesystem::directory_entry> pathList;
        for (const auto entry: it) {
            pathList.emplace_back(entry);
        }
        printf("dir lookup %d\n", pathList.size());
        pv->exec([pv, pathList, resolver]() {
            if (!pv->pdoc) {
                return;
            }
            xcontext ctx(pv->pdoc);
            printf("find = %d\n", pathList.size());
            printf("resolve = %d\n", JS_IsFunction(ctx, resolver));
            if (!JS_IsFunction(ctx, resolver)) {
                return;
            }
            auto argv = JS_NewArray(ctx);
            if (!pathList.empty()) {
                for (int i = 0; i < pathList.size(); ++i) {
                    JSValue o = JS_NewObject(ctx);
                    string s = u8::cvt(pathList[i].path().wstring());
                    JSValue e = JS_NewString(ctx, s.c_str());
                    JS_SetPropertyStr(ctx, o, "path", e);
                    JSValue e2 = JS_NewBool(ctx,  pathList[i].is_directory());
                    JS_SetPropertyStr(ctx, o, "isDir", e2);
                    JS_SetPropertyUint32(ctx, argv, i, o);
                }
            }
            printf("call %d\n", pathList.size());

            qjs::microtasks_processor _(ctx.pxview());

            JSValue r = JS_Call(ctx, resolver, JS_UNDEFINED, 1, &argv);
//            printf("call ret %s\n", JS_ToCString(ctx, r));
            JS_FreeValue(ctx, argv);
            JS_FreeValue(ctx, r);
            JS_FreeValue(ctx, resolver);
//            JS_FreeValue(ctx, resolving_callbacks[1]);
        });
    }, pv, path).detach();
    JS_FreeValue(c, resolving_callbacks[1]);
//    JS_FreeValue(c, resolving_callbacks[0]);

    return promise;
}

///@formatter:off
JSOM_PASSPORT_BEGIN(exec_static_def, qjs::xcontext)
    JSOM_GLOBAL_FUNC_DEF("launch", shell_launch),
    JSOM_GLOBAL_FUNC_DEF("show", shell_show),
    JSOM_GLOBAL_FUNC_DEF("hide", shell_hide),
    JSOM_GLOBAL_FUNC_DEF("ctrl_c", shell_ctrl_c),
    JSOM_GLOBAL_FUNC_DEF("is_live", shell_isLive),
    JSOM_GLOBAL_FUNC_DEF("find_pid", shell_findPid),
    JSOM_GLOBAL_FUNC_DEF("readdir", shell_readdir),
JSOM_PASSPORT_END
///@formatter:on

auto def = exec_static_def();

static int module_init(JSContext* ctx, JSModuleDef* m) {
    JS_SetModuleExportList(ctx, m, def.start, def.size());
    return 0;
}

static void init_js(qjs::context &c) {
    JSModuleDef* m = JS_NewCModule(c, "@shell", module_init);
    JS_AddModuleExportList(c, m, def.start, def.size());
}

bool n = addJsExt(init_js);