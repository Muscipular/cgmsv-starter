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
    export const fs: {
        readFile(path: string): Promise<ArrayBuffer>
        realpathSync(path: string): string
    }
}

declare module "@sciter" {
    export function $(s: string): Element

    export function decode(a: ArrayBuffer, encoding?: string): string
}

declare interface Element {
    append(node: any): void
}