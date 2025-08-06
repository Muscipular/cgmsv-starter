export function alert(e) {
    if (e && e instanceof Error && e.handled) {
        return null;
    }
    reportException(e);
    return null;
}

export function reportException(err, isPromise) {
    console.log('error: ' + err);
    if (err instanceof Error) {
        if (err.handled) {
            return;
        }
        if (err) {
            err.handled = true;
        }
        if (!__DEBUG) {
            err = err.message;
        }
    }
    Window.this.modal(<alert>{err.toString()}</alert>);
    return "";
}

console.reportException = reportException
