#ifndef CGMSV_STARTER_JSEXTW_H
#define CGMSV_STARTER_JSEXTW_H
#include "JsExt.h"
#include "sdk-headers.h"
#include "tool/tool.h"
#include "xdomjs/xdom.h"
#include "xdomjs/xcontext.h"
#include "xdomjs/xom.h"
#include "quickjs/quickjs.h"

bool addJsExt(std::function<void(qjs::context& c)>);
#endif //CGMSV_STARTER_JSEXTW_H
