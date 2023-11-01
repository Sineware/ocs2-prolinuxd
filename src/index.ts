import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import isReachable from "is-reachable";
import * as TOML from '@ltd/j-toml';
import axios from "axios";
import * as _ from "lodash";

import { log, logger } from "./logging";
import { OCS2Connection } from "./modules/ocs2/cloudapi";
import { loadPL2Module } from "./modules/pl2";
import { getProLinuxInfo } from "./helpers/getProLinuxInfo";
import { LocalActions } from "./constants";

log.info("Starting Sineware ProLinuxD... 🚀"); 

interface LocalWSMessage {
    action: LocalActions,
    payload: any,
    id?: string | null
}

export let cloud: OCS2Connection;
export let localSocket: any;
export const localSocketBroadcast = (msg: LocalWSMessage) => {
    localSocket.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
        }
    });
}
export let config = {
    prolinuxd: {
        modules: [
            "plasma-mobile-nightly", 
            "ocs2",
            "pl2"
        ]
    },
    ocs2: {
        gateway_url: "wss://update.sineware.ca/gateway",
        client_type: "prolinux,plasma-mobile-nightly",
        access_token: ""
    },
    pl2: {
        selected_root: "a",
        locked_root: true,
        hostname: "",
        disable_kexec: false
    }
}

async function main() {
    // Read configuration file
    try {
        const tomlConfig = TOML.parse(fs.readFileSync(process.env.CONFIG_FILE ?? path.join(__dirname, "prolinux.toml"), "utf-8")) as typeof config;
        config = _.merge(config, tomlConfig);
        log.info("Configuration file loaded!");
        log.info(JSON.stringify(config, null, 4));
    } catch(e) {
        console.log(e);
        console.log("Resetting to default configuration file...");
        let tomlConfig = TOML.stringify(config, {
            newline: "\n"
        });
        // todo check for a prolinux-default.toml
        fs.writeFileSync(process.env.CONFIG_FILE ?? path.join(__dirname, "prolinux.toml"), Buffer.from(tomlConfig), "utf-8");
    }

    try{
        fs.unlinkSync("/tmp/prolinuxd.sock");
    } catch (err) {}
    const server = http.createServer()
    const wss = new WebSocket.Server({ server });
    localSocket = wss;

    // Local websocket server (/tmp/prolinuxd.sock)
    wss.on("connection", (socket) => {
        log.info("Client connected to ProLinuxD!");
        const saveConfig = () => {
            let tomlConfig = TOML.stringify(config, {
                newline: "\n"
            });
            fs.writeFileSync(process.env.CONFIG_FILE ?? path.join(__dirname, "prolinux.toml"), Buffer.from(tomlConfig), "utf-8");
        }
        const reply = (msg: LocalWSMessage) => {
             socket.send(JSON.stringify(msg));
        }
        socket.on("message", async (data) => {
            try {
                let msg = JSON.parse(data.toString());
                const replyResult = (forAction: LocalActions, status: boolean, data: any) => { 
                    reply({
                        action: LocalActions.RESULT,
                        payload: {
                            forAction: forAction,
                            status: status,
                            data: data
                        },
                        id: msg.id ?? null
                    });
                }
                console.log("[Local] Received message: " + JSON.stringify(msg));
                switch(msg.action) {
                    case LocalActions.LOG: {
                        logger(msg.payload.msg, msg.payload.type, msg.payload.from);
                    } break;
                    case LocalActions.DEVICE_STREAM_TERMINAL: {
                        cloud?.callWS("device-stream-terminal", {
                            deviceUUID: cloud.uuid,
                            fromDevice: true,
                            text: msg.payload.data
                        }, false);
                    } break;
                    case LocalActions.SET_TOKEN:  {
                        config.ocs2.access_token = msg.payload.token;
                        saveConfig();
                        replyResult(LocalActions.SET_TOKEN, true, {});
                    } break;
                    case LocalActions.SET_SELECTED_ROOT: {
                        config.pl2.selected_root = msg.payload.selectedRoot;
                        saveConfig();
                        replyResult(LocalActions.SET_SELECTED_ROOT, true, {});
                    } break;
                    case LocalActions.SET_LOCKED_ROOT: {
                        config.pl2.locked_root = msg.payload.lockedRoot;
                        saveConfig();
                        replyResult(LocalActions.SET_LOCKED_ROOT, true, {});
                    } break;
                    case LocalActions.SET_HOSTNAME: {
                        config.pl2.hostname = msg.payload.hostname;
                        saveConfig();
                        replyResult(LocalActions.SET_HOSTNAME, true, {});
                    } break;
                    case LocalActions.SET_DISABLE_KEXEC: {
                        config.pl2.disable_kexec = msg.payload.disableKexec;
                        saveConfig();
                        replyResult(LocalActions.SET_DISABLE_KEXEC, true, {});
                    } break;
                    case LocalActions.STATUS: {
                        console.log("Sending status...")
                        socket.send(JSON.stringify({
                            action: LocalActions.RESULT,
                            payload: {
                                forAction: LocalActions.STATUS,
                                status: true,
                                data: {
                                    status: "ok",
                                    ocsConnnected: cloud?.connected ?? false,
                                    ocsReady: cloud?.ready ?? false,
                                    modules: config.prolinuxd.modules,
                                    selectedRoot: config.pl2.selected_root,
                                    lockedRoot: config.pl2.locked_root,
                                    hostname: config.pl2.hostname,
                                    disable_kexec: config.pl2.disable_kexec,
                                    buildInfo: await getProLinuxInfo(),
                                    config: config
                                },
                            },
                            id: msg.id ?? null
                        }));
                    } break;
                    case LocalActions.GET_LOGS: {
                        socket.send(JSON.stringify({
                            action: LocalActions.RESULT,
                            payload: {
                                forAction: LocalActions.GET_LOGS,
                                status: true,
                                data: {
                                    logs: log.getLogs()
                                }
                            },
                            id: msg.id ?? null
                        }));
                    } break;
                    case LocalActions.GET_UPDATE_INFO: {
                        const info = await getProLinuxInfo();
                        let res = await axios.get(`https://update.sineware.ca/updates/${info.product}/${info.variant}/${info.channel}`);
                        socket.send(JSON.stringify({
                            action: LocalActions.RESULT,
                            payload: {
                                forAction: LocalActions.GET_UPDATE_INFO,
                                status: true,
                                data: {
                                    update: res.data,
                                    updateAvailable: (res.data.buildnum > info.buildnum)
                                }
                            },
                            id: msg.id ?? null
                        }));
                    } break;
                    case LocalActions.START_UPDATE: {
                        try {
                            const info = await getProLinuxInfo();
                            const newRoot = (config.pl2.selected_root === "a") ? "b" : "a";
                            // Download the update from http://cdn.sineware.ca/repo/${info.product}/${info.variant}/${info.channel}/${res.data.arch}/${info.filename}.squish to /sineware/prolinux_${newRoot}.squish
                            // and send update-progress events
                            const {data, headers} = await axios({
                                method: 'get',
                                url: `http://cdn.sineware.ca/repo/${info.product}/${info.variant}/${info.channel}/${info.arch}/${info.filename}`,
                                responseType: 'stream'
                            });
                            const totalLength = headers['content-length'];
                            const writer = fs.createWriteStream(`/sineware/prolinux_${newRoot}.squish`);
                            
                            let progress = 0;
                            data.on('data', (chunk: any) => {
                                localSocketBroadcast({
                                    action: LocalActions.UPDATE_PROGRESS,
                                    payload: {
                                        progress: progress += chunk.length,
                                        total: totalLength,
                                        newRoot: newRoot,
                                        buildnum: info.buildnum,
                                    }
                                });

                                if(progress == totalLength) {
                                    config.pl2.selected_root = newRoot;
                                    saveConfig();
                                }
                            });
                            data.pipe(writer);
                            replyResult(LocalActions.START_UPDATE, true, {});
                        } catch(e: any) {
                            replyResult(LocalActions.START_UPDATE, false, {
                                msg: e.message
                            });
                        }
                    } break;
                }
            } catch(e) {
                console.log(e);
            }
        });
        socket.on("close", () => {
            log.info("Client disconnected from ProLinuxD!");
        });
    });
    
    wss.on("error", (err) => {
        log.error("WS Server error: " + err.message);
        console.log(err)
    });
    
    // todo check for updates before starting
    server.listen("/tmp/prolinuxd.sock");
    server.on("listening", async () => {
        fs.chmodSync("/tmp/prolinuxd.sock", 666);
        log.info("ProLinuxD is listening on /tmp/prolinuxd.sock!");
    
        if(config.prolinuxd.modules.includes("ocs2") && config.ocs2?.access_token !== "") {
            log.info("Connecting to Sineware Cloud...");
            let attempts = 0;
            let attemptCloudConnection = () => {
                isReachable("update.sineware.ca").then((reachable) => {
                    if(reachable) {
                        cloud = new OCS2Connection();
                    } else {
                        if(attempts >= 100) {
                            log.error("Could not connect to Sineware Cloud Services, giving up.");
                        } else {
                            log.info("Could not connect to Sineware Cloud Services, retrying in 5 seconds...");
                            setTimeout(attemptCloudConnection, 5000);
                        }
                        attempts++;
                    }
                });
            }
            attemptCloudConnection();
        }
        if(config.prolinuxd.modules.includes("pl2")) {
            log.info("Starting ProLinux 2 Module...");
            await loadPL2Module();
        }
    });    
}
try {
    main();
} catch (err) {
    log.error("Fatal error: " + err);
    console.log(err);
}