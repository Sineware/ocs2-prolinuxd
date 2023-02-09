import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";
import isReachable from "is-reachable";
import * as TOML from '@ltd/j-toml';
import { log, logger } from "./logging";
import { OCS2Connection } from "./modules/ocs2/cloudapi";
import {loadPlasmaMobileNightlyModule} from "./modules/plasma-mobile-nightly";

log.info("Starting Sineware ProLinuxD... 🚀"); 

export let cloud: OCS2Connection;
export let localSocket: any;
export let config: {
    prolinuxd : {
        modules: string[]
    },
    ocs2: {
        gateway_url: string,
        access_token: string
    }
}

async function main() {
    // Read configuration file
    config = TOML.parse(fs.readFileSync(process.env.CONFIG_FILE ?? path.join(__dirname, "prolinux.toml"), "utf-8")) as typeof config;
    log.info("Configuration file loaded!");

    try{
        fs.unlinkSync("/tmp/prolinuxd.sock");
    } catch (err) {}
    const server = http.createServer()
    const wss = new WebSocket.Server({ server });
    localSocket = wss;

    // Local websocket server
    wss.on("connection", (socket) => {
        log.info("Client connected to ProLinuxD!");
        socket.on("message", (data) => {
            let msg = JSON.parse(data.toString());
            switch(msg.action) {
                case "log": {
                    logger(msg.payload.msg, msg.payload.type, msg.payload.from);
                } break;
                case "device-stream-terminal": {
                    cloud.callWS("device-stream-terminal", {
                        deviceUUID: cloud.uuid,
                        fromDevice: true,
                        text: msg.payload.data
                    }, false);
                } break;
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
            console.log("Starting Plasma Mobile Nightly Module...");
            await loadPlasmaMobileNightlyModule();
        }
        
        if(config.prolinuxd.modules.includes("ocs2")) {
            log.info("Connecting to Sineware Cloud...");
            let attempts = 0;
            let attemptCloudConnection = () => {
                isReachable("update.sineware.ca").then((reachable) => {
                    if(reachable) {
                        cloud = new OCS2Connection();
                    } else {
                        if(attempts >= 10) {
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
    });    
}
try {
    main();
} catch (err) {
    log.error("Fatal error: " + err);
    console.log(err);
}