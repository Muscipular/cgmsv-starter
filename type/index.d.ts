declare module '@shell' {
    export function launch(s: string, param?: string, hide?: boolean): number

    export function is_live(pid: number): boolean;

    export function ctrl_c(pid: number): void;

    export function show(pid: number): void;

    export function hide(pid: number): void;

    export function ctrl_c(pid: number): void;

    export function find_pid(s: string): Promise<number[]>;

    export function readdir(s: string): Promise<{ path: string, isDir: boolean }[]>;
}

declare interface SignalType<T> {
    value: T;

    send(t: T): void;
}

declare interface Window {
    modal(s: any): void

    on(e: 'closerequest', fn: (s: Event & { reason: number }) => boolean): void
}


declare interface Reactor {
    signal<T>(any: T): SignalType<T>
}

declare const Reactor: Reactor

declare module "@sys" {
    interface DirectoryEntry {
        name: string;
        type: number;
    }

    interface Directory extends AsyncIterable<DirectoryEntry> {
        close(): Promise<void>;
    }

    interface File {
        path: string;
        write(data: Uint8Array): Promise<number>;
        close(): Promise<void>;
    }

    export const fs: {
        readFile(path: string): Promise<ArrayBuffer>
        realpathSync(path: string): string
        readdir(path: string): Promise<Directory>
        mkstemp(template: string): Promise<File>
        rename(source: string, destination: string): Promise<void>
        unlink(path: string): Promise<void>
        UV_DIRENT_FILE: number
        UV_DIRENT_DIR: number
        UV_DIRENT_LINK: number
        UV_DIRENT_UNKNOWN: number
    }
}

declare module "@sciter" {
    export function $(s: string): Element

    export function decode(a: ArrayBuffer, encoding?: string): string
    export function encode(text: string, encoding?: string): ArrayBuffer
}

declare interface Element {
    append(node: any): void
}