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
    ws?: WebSocket;
    uuid?: string;
    
    constructor() {
        this.startCloudConnection();
    }
    startCloudConnection() {
        this.ws = new WebSocket(config.ocs2.gateway_url);
        this.ws.on('open', function open() { 
            log.info("Connected to the Sineware Cloud Gateway!");
        });
        this.ws.on('message', async (data) => {
            let msg = JSON.parse(data.toString());
            console.log(msg) // temp
            if(msg.action === "hello" && msg.payload.status) {
                let machineID = fs.readFileSync("/etc/machine-id", "utf-8").trim();
                let hostname = fs.readFileSync("/etc/hostname", "utf-8").trim();

                this.uuid = machineID;
                
                let org: APIOrganization = await this.callWS("device-hello", { 
                    clientType: "prolinux",
                    accessToken: config.ocs2.access_token,
                    uuid: machineID,
                    name: hostname
                });
                console.log(org);
                setInterval(() => {
                    this.callWS("ping", {text: ""}, false);
                }, 10000);
                this.ready = true;
            } else if(msg.action === "device-stream-terminal") {
                if(!msg.payload.fromDevice) {
                    localSocket.clients.forEach((client: any) => {
                        console.log("Sending message to client: " + msg.payload.text)
                        client.send(JSON.stringify({
                            action: "device-stream-terminal",
                            payload: {
                                data: msg.payload.text
                            }
                        }));
                    });
                }
            }
        });
        this.ws.on('error', (err) => {
            console.log(err);
            // try to reconnect
            console.log("Reconnecting...");
            this.startCloudConnection();
        });
        this.ws.on('close', (code, reason) => {
            console.log("Connection closed: " + code + " " + reason);
            // try to reconnect
            console.log("Reconnecting...");
            this.startCloudConnection();
        });
    };

    callWS(action: string, payload: any, promise: boolean = true): Promise<any> {
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
        });
    }
}