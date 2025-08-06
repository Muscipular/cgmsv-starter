cmake_minimum_required(VERSION 3.25)
project(cgmsv_starter C CXX)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 20)

set(SCITER_SDK "" CACHE STRING "SCITER_SDK")


# Windows-specific
if(WIN32)
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        set(PLATFORM_ARCH "x64")
    else()
        set(PLATFORM_ARCH "x32")
    endif()
endif()

add_compile_definitions(UNICODE)
add_compile_definitions(_UNICODE)
add_compile_definitions(__WIN32)
add_compile_definitions(_WIN32)
add_compile_definitions(WIN32)
add_compile_definitions(_CRT_SECURE_NO_WARNINGS)

include_directories(${SCITER_SDK}/)
include_directories(${SCITER_SDK}/engine)
include_directories(${SCITER_SDK}/engine/tool)
include_directories(${SCITER_SDK}/engine/gool)
include_directories(${SCITER_SDK}/engine/html)
include_directories(${SCITER_SDK}/engine/external/uv/include)
include_directories(${SCITER_SDK}/engine/external/uv-tls/include)
include_directories(${SCITER_SDK}/engine/external/zlib)
include_directories(${SCITER_SDK}/engine/external/minizip)
include_directories(${SCITER_SDK}/sdk/include)
include_directories(${SCITER_SDK}/sdk/)
include_directories(${SCITER_SDK}/glfw/include)

link_directories(${SCITER_SDK}/lib.d2d/windows/${PLATFORM_ARCH}/Release)

add_compile_definitions(SCITERJS)
add_compile_definitions(SCRIPT_JS)
add_compile_definitions(JS_STRICT_NAN_BOXING)
add_compile_definitions(CONFIG_BIGNUM)
add_compile_definitions(CONFIG_UNITS)
add_compile_definitions(CONFIG_JSX)
add_compile_definitions(CONFIG_JSX_SCITER)
add_compile_definitions(CONFIG_DEBUGGER)
add_compile_definitions(CONFIG_STORAGE)
add_compile_definitions(CONFIG_OBJECT_LITERAL_CALL)
add_compile_definitions(SCITER_BUILD)
add_compile_definitions(DEVICE=DESKTOP)
add_compile_definitions(NOMINMAX)
add_compile_definitions(PLATFORM_HAS_SYS_METRICS)
add_compile_definitions(PLATFORM_HAS_SYS_DIALOGS)
add_compile_definitions(PLATFORM_HAS_WINDOW_DECORATIONS)
add_compile_definitions(WIN32)
add_compile_definitions(NDEBUG)
add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
add_compile_definitions(_UCRT_NOISY_NAN)
add_compile_definitions(FX)
add_compile_definitions(CONFIG_STORAGE_SECURE)
add_compile_definitions(D2D)
add_compile_definitions(STATIC_LIB)

set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /SUBSYSTEM:WINDOWS /ENTRY:wmainCRTStartup")

add_custom_target(PACKAGE)
file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/g)
include_directories(${CMAKE_CURRENT_BINARY_DIR}/g)

ADD_CUSTOM_COMMAND(
        PRE_BUILD
        TARGET PACKAGE
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        COMMAND ${SCITER_SDK}/sdk/bin/windows/packfolder.exe
        ARGS res ${CMAKE_CURRENT_BINARY_DIR}/g/resources.cpp -v "resources")
set_source_files_properties(${CMAKE_CURRENT_BINARY_DIR}/g/resources.cpp PROPERTIES GENERATED 1)

set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /GL")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG")

file(GLOB_RECURSE SRC_FILES src/**)

add_executable(cgmsv_starter WIN32 ${SRC_FILES} app.rc app.manifest)
set_property(TARGET cgmsv_starter PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
target_compile_definitions(cgmsv_starter PUBLIC UNICODE _UNICODE)

target_link_libraries(cgmsv_starter sciter-lib.lib
        usp10.lib
        ws2_32.lib
        wininet.lib
        windowscodecs.lib
        cfgmgr32.lib
        version.lib
        imm32.lib)

if (CMAKE_BUILD_TYPE MATCHES Debug)
else ()
add_dependencies(cgmsv_starter PACKAGE)
endif ()
