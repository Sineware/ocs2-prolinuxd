import { cloud } from ".";
export const logBuffer: string[] = [];
export function logger(msg: string, type: string, from: string = "prolinuxd") {
    if (logBuffer.length > 1024) {
        logBuffer.shift();
    }
    logBuffer.push(`[${type}] ${msg}`);

    if (cloud?.ready) {
        cloud.ws?.send(JSON.stringify({
            action: "device-log",
            payload: {
                uuid: cloud.uuid!,
                type,
                from,
                msg
            }
        }));
    }
    console.log(`[prolinuxd] [${type}] ${msg}`);
}
export const log = {
    info: (msg: string) => logger(msg, "info"),
    error: (msg: string) => logger(msg, "error"),
    debug: (msg: string) => logger(msg, "debug"),
}