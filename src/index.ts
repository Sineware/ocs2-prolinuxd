import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import isReachable from "is-reachable";
import * as TOML from '@ltd/j-toml';
import { log, logger } from "./logging";
import { OCS2Connection } from "./modules/ocs2/cloudapi";
import {loadPlasmaMobileNightlyModule} from "./modules/plasma-mobile-nightly";
import { loadPL2Module } from "./modules/pl2";
import { getProLinuxInfo } from "./helpers/getProLinuxInfo";

log.info("Starting Sineware ProLinuxD... 🚀"); 

export let cloud: OCS2Connection;
export let localSocket: any;
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
        hostname: ""
    }
}

async function main() {
    // Read configuration file
    try {
        config = TOML.parse(fs.readFileSync(process.env.CONFIG_FILE ?? path.join(__dirname, "prolinux.toml"), "utf-8")) as typeof config;
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
        socket.on("message", async (data) => {
            try {
                let msg = JSON.parse(data.toString());
                console.log("[Local] Received message: " + JSON.stringify(msg));
                switch(msg.action) {
                    case "log": {
                        logger(msg.payload.msg, msg.payload.type, msg.payload.from);
                    } break;
                    case "device-stream-terminal": {
                        cloud?.callWS("device-stream-terminal", {
                            deviceUUID: cloud.uuid,
                            fromDevice: true,
                            text: msg.payload.data
                        }, false);
                    } break;
                    case "set-token":  {
                        config.ocs2.access_token = msg.payload.token;
                        saveConfig();
                    } break;
                    case "set-selected-root": {
                        config.pl2.selected_root = msg.payload.selectedRoot;
                        saveConfig();
                    };
                    case "set-locked-root": {
                        config.pl2.locked_root = msg.payload.lockedRoot;
                        saveConfig();
                    };
                    case "set-hostname": {
                        config.pl2.hostname = msg.payload.hostname;
                        saveConfig();
                    };
                    case "status": {
                        console.log("Sending status...")
                        socket.send(JSON.stringify({
                            action: "result",
                            payload: {
                                forAction: "status",
                                status: true,
                                data: {
                                    status: "ok",
                                    ocsConnnected: cloud?.connected ?? false,
                                    ocsReady: cloud?.ready ?? false,
                                    modules: config.prolinuxd.modules,
                                    selectedRoot: config.pl2.selected_root,
                                    lockedRoot: config.pl2.locked_root,
                                    hostname: config.pl2.hostname,
                                    buildInfo: await getProLinuxInfo()
                                },
                                config: config
                            },
                            id: msg.id ?? null
                        }));
                    } break;
                    case "get-logs": {
                        socket.send(JSON.stringify({
                            action: "result",
                            payload: {
                                forAction: "get-logs",
                                status: true,
                                data: {
                                    logs: log.getLogs()
                                }
                            },
                            id: msg.id ?? null
                        }));
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
    
        // Start Plasma Mobile Nightly Module
        if(config.prolinuxd.modules.includes("plasma-mobile-nightly")) {
            log.info("Starting Plasma Mobile Nightly Module...");
            await loadPlasmaMobileNightlyModule();
        }
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