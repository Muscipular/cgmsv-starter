#include "sdk-headers.h"
#include "sciter-x-api.h"
#include "sdk/include/sciter-x-window.hpp"
#define SKIP_MAIN
#include "sciter-main.cpp"
//#include "../Exec.hpp"

#include "tool/tool.h"
#include <filesystem>

void initJsExt();
BOOL send_ctrl_c(DWORD pid);
int wmain (int argc, wchar_t *argv[])
{
    for (int n = 0; n < argc; ++n)
        _argv.push_back(argv[n]);
    for (int i = 0; i < argc; ++i) {
        if (wcscmp(L"--kill", argv[i]) == 0) {
            send_ctrl_c(wtoi(argv[i + 1]));
            exit(0);
        }
    }
    sciter::application::start(argc, (const WCHAR **) argv);
    int r = uimain([]() -> int { return sciter::application::run(); });
    sciter::application::shutdown();
}

int uimain(std::function<int()> run) {
#include "resources.cpp"
    ::SciterSetOption(NULL, SCITER_SET_SCRIPT_RUNTIME_FEATURES,
                      ALLOW_FILE_IO |
                      ALLOW_SOCKET_IO |
                      ALLOW_EVAL |
                      ALLOW_CMODULES |
                      ALLOW_SYSINFO);
    const auto argv = sciter::application::argv();
    sciter::debug_output_console* console = nullptr;

#ifdef _DEBUG
    console = new sciter::debug_output_console();
#else
    if (!console && !argv.empty()) {
        for (auto &s: argv) {
            if (s == L"--debug") {
                console = new sciter::debug_output_console();
            }
        }
    }
#endif
    initJsExt();
    sciter::archive &archive = sciter::archive::instance();
#ifndef _DEBUG
    archive.open(aux::elements_of(resources)); // bind resources[] (defined in "resources.cpp") with the archive
#endif
    setlocale(LC_ALL, "zn_CN.GBK");

    SetConsoleCtrlHandler([](auto s) {
        if (s == CTRL_BREAK_EVENT) return TRUE;
        return FALSE;
    }, true);

    auto pwin = new sciter::window(SW_MAIN | SW_ENABLE_DEBUG);

    SciterSetMediaType(pwin->get_hwnd(), WSTR("desktop,cgmsv"));
//    SciterSetGlobalAsset(new EXEC());

    static const sciter::value &ver = sciter::value::make_string("1.0.0");
    SciterSetVariable(NULL, "__VERSION", &ver);
    static const sciter::value &debug_ = sciter::value(console != nullptr);
    SciterSetVariable(NULL, "__DEBUG", &debug_);
//    bool loaded = false;

    // note: this:://app URL is dedicated to the sciter::archive content associated with the application
    if (console!= nullptr) {
        wchar_t buff[2048];
        wchar_t buff2[2048];
        wchar_t ui[] = L"res";
        auto s = std::find(argv.begin(), argv.end(), L"--ui");
        GetCurrentDirectoryW(sizeof(buff), buff);
        if (argv.end() != s) {
            swprintf_s(buff2, L"%s/index.htm", (s + 1)->c_str());
        } else {
            swprintf_s(buff2, L"%s/%s/index.htm", buff, ui);
        }
        if (!std::filesystem::exists(buff2)) {
            swprintf_s(buff2, L"%s/../%s/index.htm", buff, ui);
        }
        swprintf_s(buff, L"file://%s", buff2);
        pwin->load(buff);
    } else {
        pwin->load(WSTR("this://app/index.htm"));
    }


    pwin->expand();
    return run();
}

