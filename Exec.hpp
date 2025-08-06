#ifndef RORUNNER_EXEC_H
#define RORUNNER_EXEC_H

#include "sciter-x.h"

class EXEC : public sciter::om::asset<EXEC> {
public:

    sciter::value launch(sciter::string exe, sciter::string param, sciter::value hide);

//    sciter::value launchEx(sciter::string exe, sciter::string dll);

    sciter::value exit(sciter::value v) {
        ::exit(v.get(0));
        return 0;
    }

    sciter::value readDir(sciter::string p);

    sciter::value createDir(sciter::string p);

    sciter::value deleteAll(sciter::string p);

    SOM_PASSPORT_BEGIN(EXEC)
        SOM_FUNCS(
                SOM_FUNC(launch),
//                SOM_FUNC(launchEx),
                SOM_FUNC(readDir),
                SOM_FUNC(createDir),
                SOM_FUNC(deleteAll),
                SOM_FUNC(exit)
        )
    SOM_PASSPORT_END
};

#endif //RORUNNER_EXEC_H
