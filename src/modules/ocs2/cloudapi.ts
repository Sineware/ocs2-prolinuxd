import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import fs from 'node:fs';
import { log } from "../../logging";
import { config, localSocket } from '../../index';

export interface APIOrganization {
    id: number;
    uuid: string;
    name: string;
    tier: string;
}

export class OCS2Connection {
    ready: boolean = false;
    connected: boolean = false;
    ws?: WebSocket;
    uuid?: string;
    
    constructor() {
        this.startCloudConnection();
    }
    startCloudConnection() {
        this.ws = new WebSocket(config.ocs2.gateway_url);
        this.ws.on('open', () => { 
            log.info("Connected to the Sineware Cloud Gateway!");
            this.connected = true;
        });
        this.ws.on('message', async (data) => {
            try {
                let msg = JSON.parse(data.toString());
                if(msg.payload?.forAction !== "ping" && msg.action !== "device-stream-terminal") {
                    console.log(msg);
                }
                if(msg.action === "hello" && msg.payload.status) {
                    let machineID = fs.readFileSync("/etc/machine-id", "utf-8").trim();
                    let hostname = fs.readFileSync("/etc/hostname", "utf-8").trim();

                    this.uuid = machineID;
                    
                    let org: APIOrganization = await this.callWS("device-hello", { 
                        clientType: "prolinux,plasma-mobile-nightly",
                        accessToken: config.ocs2.access_token,
                        uuid: machineID,
                        name: hostname
                    });
                    log.info(JSON.stringify(org));
                    setInterval(() => {
                        this.callWS("ping", {text: ""}, false);
                    }, 10000);
                    this.ready = true;
                } else if(msg.action === "device-stream-terminal") {
                    if(!msg.payload.fromDevice) {
                        localSocket.clients.forEach((client: any) => {
                            //console.log("Sending message to client: " + msg.payload.text)
                            client.send(JSON.stringify({
                                action: "device-stream-terminal",
                                payload: {
                                    data: msg.payload.text
                                }
                            }));
                        });
                    }
                }
            } catch(e) {
                log.error("Error while parsing message from Sineware Cloud Gateway: " + e);
            }
        });
        this.ws.on('error', (err) => {
            log.info("Error while connecting to Sineware Cloud Gateway: " + err.message);
            console.error(err);
            // try to reconnect
            console.log("Reconnecting... " + err.message);
            this.startCloudConnection();
        });
        this.ws.on('close', (code, reason) => {
            console.error("Connection closed: " + code + " " + reason);
            // try to reconnect
            console.log("Reconnecting..." + reason);
            this.startCloudConnection();
        });
    };

    callWS(action: string, payload: any, promise: boolean = true): Promise<any> {
        if(!this.connected) {
            return new Promise((resolve, reject) => {
                resolve({})
            });
        }
        return new Promise ((resolve, reject) => {
            let id = uuidv4();
            let msg = { action, payload, id };
            //console.log("[Call] Sending message: " + JSON.stringify(msg));
            if(promise) {
              const listener = (e: any) => {
                  let msg = JSON.parse(e.data);
                  if (msg.id === id) {
                      if(msg.payload.status) {
                          resolve(msg.payload.data);
                      } else {
                          reject(new Error(msg.payload.data.msg));
                      }
                      this.ws?.removeEventListener("message", listener);
                  }
              }
              this.ws?.addEventListener("message", listener);
            }
            this.ws?.send(JSON.stringify(msg));
            if(!promise) resolve({});
        });
    }
}