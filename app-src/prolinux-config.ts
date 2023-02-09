import { spawn } from 'child_process';
import { WebSocket } from 'ws';

function textBoxDialog(title: string, text: string): Promise<{data: string, exitCode: number | null}> {
    return new Promise((resolve, reject) => {
        const child = spawn('kdialog', ['--title', title, '--inputbox', text]);
        let data = '';
        child.stdout.on('data', (chunk) => {
            data += chunk;
        });
        child.on('close', (code) => {
            resolve({data, exitCode: code});
        });
    });
}
function alertDialog(title: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('kdialog', ['--title', title, '--msgbox', text]);
        child.on('close', () => {
            resolve();
        });
    });
}
function startProgressDialog(title: string, text: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('kdialog', ['--title', title, '--progressbar', text, "100"]);
        // return qdbus object path
        child.stdout.on('data', (chunk) => {
            resolve(chunk.toString().trim());
        });
    });
}
function updateProgressDialog(path: string, value: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('qdbus', [...path.split(" "), 'Set', '', 'value', value.toString()]);
        child.on('close', () => {
            resolve();
        });
    });
}
function closeProgressDialog(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('qdbus', [...path.split(" "), 'close']);
        child.on('close', () => {
            resolve();
        });
    });
}

async function main() {
    const path = await startProgressDialog('ProLinuxD', 'Connecting to ProLinuxD...');

    let ws = new WebSocket("ws+unix:///tmp/prolinuxd.sock");
    
    await updateProgressDialog(path, 50);

    ws.on('open', async () => {
        await closeProgressDialog(path);
        let token = await textBoxDialog('ProLinuxD Device Access Token', 'Enter the organization device access token:');
        ws.send(JSON.stringify({
            action: "set-token",
            payload: {
                token
            }
        }));
    });

    ws.on("error", async (err) => {
        await closeProgressDialog(path);
        await alertDialog('ProLinuxD', 'Failed to connect to ProLinuxD');
        process.exit(1);
    });
}
main();