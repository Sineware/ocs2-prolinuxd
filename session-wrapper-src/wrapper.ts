import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { WebSocket } from "ws";
import * as pty from "node-pty";
console.log("ProLinuxd Session Wrapper - launching: " + process.argv[2]);

// /var/lib/tinydm/default-session.desktop
// Exec=/usr/bin/node /opt/prolinuxd/session-wrapper/index.js /usr/lib/libexec/plasma-dbus-run-session-if-needed /usr/bin/startplasmamobile

const ws = new WebSocket("ws+unix:///tmp/prolinuxd.sock");
let term: any;

function log(msg: string, type: string) {
    ws.send(JSON.stringify(
        {
            "action": "log",
            "payload": {
                "msg": msg,
                "type": "info",
                "from": "session-wrapper"
            }
        }
    ));
    console.log(`[prolinuxd-session-wrapper] ${msg}`);
}

ws.on('open', function open() {
    console.log('Connected to ProLinuxD!');

    // Eventually ProLinuxD will tell us to start/stop the session
    const child = spawn("/usr/bin/startplasmamobile", []);

    child.stdout.on("data", (data) => {
        log(data.toString(), "stdout");
        console.log(`[prolinuxd-session-wrapper] [stdout] ${data}`);
    });

    child.stderr.on("data", (data) => {
        log(data.toString(), "stderr");
        console.error(`[prolinuxd-session-wrapper] [stderr] ${data}`);
    });

    child.on("close", (code) => {
        log(`process exited with code ${code}`, "stderr")
        console.log(`[prolinuxd-session-wrapper] process exited with code ${code}`);
        process.exit(code || 123);
    });

    // Open a bash for device-stream-terminal
    term = pty.spawn("/bin/bash", [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        //@ts-ignore
        env: process.env
      });
    term.onData((data: any) => {
        log(`Sending back term`, "info")
        ws.send(JSON.stringify(
            {
                "action": "device-stream-terminal",
                "payload": {
                    data: Buffer.from(data).toString('base64')
                }
            }
        ));
    });
});

ws.on('message', function message(data) {
    console.log('received: %s', data);
    let msg = JSON.parse(data.toString());
    switch(msg.action) {
        case "device-stream-terminal": {
            log(`Received device-stream-terminal: ${msg.payload.data}, ${typeof term}`, "info")
            term?.write(Buffer.from(msg.payload.data, 'base64').toString('ascii'));
        } break;
    }
});

ws.on('close', function close() {
    console.log('disconnected');
    setTimeout(() => {
        process.exit(1);
    }, 2500);
});
ws.on('error', function error(err) {
    // if prolinuxd is not running, exit and openrc will restart us to try again
    console.log('error: ', err);
    setTimeout(() => {
        process.exit(1);
    }, 2500);
});