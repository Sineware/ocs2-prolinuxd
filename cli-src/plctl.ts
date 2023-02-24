import { WebSocket } from 'ws';
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';

function isRoot() {
    if(process.getuid)
        return process.getuid() == 0;
    return false;
}

async function spawnChild(command: string): Promise<{data: string, exitCode: number}> {
    const child = spawn('/bin/sh', ["-c", command]);

    let data = "";
    for await (const chunk of child.stdout) {
        console.log('stdout chunk: '+chunk);
        data += chunk;
    }
    for await (const chunk of child.stderr) {
        console.error('stderr chunk: '+chunk);
        data += chunk;
    }
    const exitCode: number = await new Promise( (resolve, reject) => {
        child.on('close', resolve);
    });
    return {data, exitCode};
}

function connectWS(): Promise<WebSocket> {
    let ws = new WebSocket("ws+unix:///tmp/prolinuxd.sock");
    return new Promise((resolve, reject) => {
        ws.on("open", () => {
            resolve(ws);
        });
        ws.on("error", (err) => {
            reject(err);
        });
    });
}
export function callWS(action: string, payload: any, promise: boolean = true): Promise<any> {
    return new Promise (async (resolve, reject) => {
        const ws = await connectWS();
        let id = uuidv4();
        let msg = { action, payload, id };
        console.log("[Call] Sending message: " + JSON.stringify(msg));
        if(promise) {
          const listener = (e: any) => {
              //console.log("[Call] Received message: " + e.data);
              let msg = JSON.parse(e.data);
              if (msg.id === id) {
                  if(msg.payload.status) {
                      resolve(msg.payload.data);
                  } else {
                      reject(new Error(msg.payload.data.msg));
                  }
                  ws.removeEventListener("message", listener);
                  ws.close();
              }
          }
          ws.addEventListener("message", listener);
        }
        ws.send(JSON.stringify(msg));
        setTimeout(() => {
            if(promise) {
                ws.close();
                reject(new Error("Timed out waiting for response from ProLinuxD"));
            }
        }, 5000);
        if(!promise){
            ws.close();
            resolve({});
        };
    });
}

const program = new Command();

program
    .name('plctl')
    .description('ProLinuxD CLI Utility')
    .version('0.0.1');

/* ----------- */
program.command('status')
    .description('get the status of ProLinuxD')
    .action(async (str, options) => {
        let res = await callWS("status", {})
        console.log("-------------------------------------------------");
        console.log("Status: " + res.status);
        console.log("Cloud Connected: " + res.ocsConnnected);
        console.log("Cloud Ready (Authenticated): " + res.ocsReady);
        process.exit(0);
    });

/* ----------- */
program.command('set-device-token')
    .description('set the Sineware Cloud device token')
    .argument('<token>', 'device token')
    .action((str, options) => {
        callWS("set-token", { token: str }, false);
        console.log("Device token set to " + str);
    });

/* ----------- */
program.command('logs')
    .description('view logs collected by prolinuxd on this device')
    .action(async (str, options) => {
        let res = await callWS("get-logs", {});
        console.log("-------------------------------------------------");
        console.log(res.logs.join("\n"));
        process.exit(0);
    });

/* ----------- */
const coredump = program.command('coredump').description('view coredumps and backtraces on this device')
coredump.command('list')
    .description('list coredumps')
    .action(async (str, options) => {
        // get all files matching core.* in /tmp
        let files = await fs.readdir("/tmp");
        let cores = files.filter((f) => f.startsWith("core."));
        console.log("-------------------------------------------------");
        console.log("Coredumps:");
        for(const c of cores.reverse()) {
            let stats = await fs.stat("/tmp/" + c);
            console.log(`[${new Date(stats.mtime).toISOString()}] ` + c + " (" + stats.size + " bytes)");
        }
    });
coredump.command('backtrace')
    .description('get a backtrace for a coredump')
    .argument('<coredump>', 'coredump file name')
    .action(async (str, options) => {
        let dumpInfo = str.split(".");
        let bin = await spawnChild("which " + dumpInfo[1]);
        let gdb = spawn("gdb", [bin.data.trim(), "-q", "-ex", "bt", "-c", "/tmp/" + str], { stdio: "inherit" });
        gdb.on("exit", (code: any) => {
            process.exit(code);
        });

    });
coredump.command('clear')
    .description('clear all coredumps')
    .action(async (str, options) => {
        // get all files matching core.* in /tmp
        let files = await fs.readdir("/tmp");
        let cores = files.filter((f) => f.startsWith("core."));
        for(const c of cores) {
            await fs.unlink("/tmp/" + c);
        }
        console.log("-------------------------------------------------");
        console.log("Coredumps cleared");
    });
/* ----------- */
const nightlyBuild = program.command('nightly-build').description('(plasma-mobile-nightly) create and manage local custom builds and packages ')
nightlyBuild
    .command('prepare')
    .description('setup the alpine abuild environment (run this first, once)')
    .action(async (str, options) => {
        if(!isRoot()) {
            console.error("You must be root to run this command.");
            process.exit(1);
        }
        console.log("-------------------------------------------------");
        console.log("Installing alpine-sdk and ccache...");
        console.log((await spawnChild("apk add alpine-sdk ccache")).data);
        console.log("Generating abuild key...")
        console.log((await spawnChild("abuild-keygen -a -i -n")).data);
    });
nightlyBuild
    .command('package')
    .description('locally rebuild a package, including with a custom git repo/branch')
    .argument('<package>', 'package name (must be in the plasma-mobile-nightly repo)')
    .argument('[repo]', 'alternative git repo to use', null)
    .argument('[branch]', 'alternative git branch to use', null)
    .action((pkg, repo, branch) => {
        console.log("-------------------------------------------------");
        if(!isRoot()) {
            console.error("You must be root to run this command.");
            process.exit(1);
        }
        let env = {
            ...process.env,
            cwd: "/opt/prolinuxd/plasma-mobile-nightly",
            BUILD_SINGLE_PACKAGE: pkg,
            DONT_DEPLOY: "true",
            BUILD_SINGLE_PACKAGE_REPO: undefined,
            BUILD_SINGLE_PACKAGE_BRANCH: undefined
        }
        if(repo)
            env.BUILD_SINGLE_PACKAGE_REPO = repo;
        if(branch)
            env.BUILD_SINGLE_PACKAGE_BRANCH = branch;
        let script = spawn("/usr/bin/node", ["/opt/prolinuxd/plasma-mobile-nightly/index.js"], { 
            stdio: "inherit",
            env
        });
        script.on("exit", (code: any) => {
            console.log("Build script exited with code " + code);
            console.log(`Now you can run 'sudo apk add ${pkg}' to install the built package!`)
            process.exit(code);
        });
    });
nightlyBuild
    .command('clean')
    .description('clean the build directory')
    .action(async (str, options) => {
        if(!isRoot()) {
            console.error("You must be root to run this command.");
            process.exit(1);
        }
        let data = await spawnChild("rm -rfv /opt/prolinuxd/plasma-mobile-nightly/workdir/prolinux-nightly");
        console.log(data.data);
        console.log("Cleaned build directory.");
    });

program.command('restart')
    .description('Restart ProLinuxD')
    .action(async (str, options) => {
        let data = await spawnChild("rc-service prolinuxd restart");
        console.log(data.data);
    });

process.on('uncaughtException', (err) => {
    console.error(err);
    process.exit(1);
});
program.parse();