import { WebSocket } from 'ws';
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';

async function connectWS() {
    let ws = new WebSocket("ws+unix:///tmp/prolinuxd.sock");
    return ws;
}
export function callWS(action: string, payload: any, promise: boolean = true): Promise<any> {
    return new Promise (async (resolve, reject) => {
        const ws = await connectWS();
        let id = uuidv4();
        let msg = { action, payload, id };
        console.log("[Call] Sending message: " + JSON.stringify(msg));
        if(promise) {
          const listener = (e: any) => {
              let msg = JSON.parse(e.data);
              if (msg.id === id) {
                  if(msg.payload.status) {
                      resolve(msg.payload.data);
                  } else {
                      reject(new Error(msg.payload.data.msg));
                  }
                  ws.removeEventListener("message", listener);
              }
          }
          ws.addEventListener("message", listener);
        }
        ws.send(JSON.stringify(msg));
        if(!promise) resolve({});
    });
}

const program = new Command();

program
    .name('pactl')
    .description('ProLinuxD CLI Utility')
    .version('0.0.1');

program.command('status')
    .description('get the status of ProLinuxD')
    .action((str, options) => {
        
    });
program.command('set-device-token')
    .description('set the Sineware Cloud device token')
    .argument('<token>', 'device token')
    .action((str, options) => {
        
    });

program.command('restart')
    .description('Restart ProLinuxD')
    .action((str, options) => {
        
    });

program.parse();