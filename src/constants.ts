export const PROLINUXD_DIR = '/opt/prolinuxd/';
export enum LocalActions {
    // Device actions
    LOG = "log",
    DEVICE_STREAM_TERMINAL = "device-stream-terminal",
    SET_TOKEN = "set-token",
    SET_SELECTED_ROOT = "set-selected-root",
    SET_LOCKED_ROOT = "set-locked-root",
    SET_HOSTNAME = "set-hostname",
    STATUS = "status",
    GET_LOGS = "get-logs",
    GET_UPDATE_INFO = "get-update-info",
    START_UPDATE = "start-update",
    UPDATE_PROGRESS = "update-progress",
    RESULT = "result",
    SET_DISABLE_KEXEC = "set-disable-kexec",
}
export interface ProLinuxInfo {
    buildnum: string,
    uuid: string,
    product: string,
    variant: string,
    channel: string,
    builddate: string,
    filename: string,
    arch: string,
    deviceinfoCodename: string
}

export interface RemoteUpdate {
    isreleased: string,
    product: string,
    variant: string,
    channel: string,
    arch: string,
    buildnum: number,
    uuid: string,
    id: number,
    buildstring: string,
    url: string,
    jwt: string
}