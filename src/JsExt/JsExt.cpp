#include "JsExtW.h"
#include <vector>

extern void SCAPI QuickJsContextInit_api(void (* fn)(qjs::context &c));

static std::vector<std::function<void(qjs::context &c)>> fnList;

static void Callback(qjs::context &c) {
    for (const auto &item: fnList) {
        item(c);
    }
}

void initJsExt() {
    QuickJsContextInit_api(Callback);
}

bool addJsExt(std::function<void(qjs::context &c)> fn) {
    fnList.emplace_back(fn);
    return true;
}