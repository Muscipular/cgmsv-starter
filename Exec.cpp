#include "Exec.hpp"
#include "windows.h"
#include "shellapi.h"
//#include "../utils.hpp"
#include "filesystem"
#include "quickjs/quickjs.h"

sciter::value EXEC::launch(sciter::string exe, sciter::string param, sciter::value hide) {
    sciter::string directory;
    const size_t last_slash_idx = exe.rfind('\\');
    if (std::string::npos != last_slash_idx) {
        directory = exe.substr(0, last_slash_idx);
    }
    SHELLEXECUTEINFOW si = {0};
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
    return sciter::value{(int) si.hProcess};
}

//sciter::value EXEC::launchEx(sciter::string exe, sciter::string dll) {
////    auto hProc = injectDll((wchar_t *) dll.c_str(), (wchar_t *) exe.c_str());
//    return sciter::value{(int) 0};
//}

sciter::value EXEC::readDir(sciter::string p) {
    namespace fs = std::filesystem;
    sciter::value v = sciter::value::make_array();
    if (fs::exists(p) && fs::is_directory(p)) {
        for (const auto &it: fs::recursive_directory_iterator(p,
                                                              std::filesystem::directory_options::follow_directory_symlink)) {
            if (it.is_regular_file()) {
                v.append(it.path().wstring());
            }
        }
    }
    return v;
}

sciter::value EXEC::createDir(sciter::string p) {
    namespace fs = std::filesystem;
    std::error_code ec;
    fs::create_directories(p, ec);
    return ec.value() == 0;
}

sciter::value EXEC::deleteAll(sciter::string p) {
    namespace fs = std::filesystem;
    std::error_code ec;
    fs::remove_all(p, ec);
    return ec.value() == 0;
}
