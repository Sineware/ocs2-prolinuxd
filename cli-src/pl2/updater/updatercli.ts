import { Command } from "commander";
import { callWS, streamWS } from "../../plctl";
import { LocalActions, ProLinuxInfo, RemoteUpdate } from "../../../src/constants";

export async function registerPL2Commands(program: Command) {

    const update = program.command('update').description('prolinux update tools')
    update.command('status').description('get available updates and current system info').action(async () => {
        const prolinuxInfo = (await callWS(LocalActions.STATUS, {}, true)).buildInfo as ProLinuxInfo;
        const updateInfo = (await callWS(LocalActions.GET_UPDATE_INFO, {}, true));

        console.log("----------------------------------------");
        console.log("- Product: " + prolinuxInfo.product + ", Variant " + prolinuxInfo.variant + ", Channel " + prolinuxInfo.channel);  
        console.log("- Installed: Build " + prolinuxInfo.buildnum + ", " + prolinuxInfo.uuid);
        console.log("----------------------------------------");
        console.log("- Available (remote): ");

        const update: RemoteUpdate = updateInfo.update;
        const updateAvailable = updateInfo.updateAvailable;

        if(updateAvailable) {
            console.log("  - Build " + update.buildnum + ", " + update.uuid);
            console.log("  - Update available!");
        } else {
            console.log("  - No update available.");
        }
        console.log("----------------------------------------");
    });
    update.command('install').description('install the latest update').action(async () => {
        /*let info = await prolinuxInfo();
        const res = await axios.get(`https://update.sineware.ca/updates/prolinux/${(await prolinuxInfo()).variant}/${(await prolinuxInfo()).channel}`);
        console.log("  - Build " + res.data.buildnum + ", " + res.data.uuid);
        if(res.data.buildnum > (await prolinuxInfo()).buildnum) {
            console.log("  - Loading system configuration...");
            const selectedRoot = (await callWS("status", {}, true)).selectedRoot;
            let newRoot = "";
            if(selectedRoot === "a") {
                newRoot = "b";
            } else {
                newRoot = "a";
            }
            console.log("  - Installing to slot: " + newRoot);
            console.log("  - Downloading...");
            exec(`cd /sineware && sudo zsync http://cdn.sineware.ca/repo/${info.product}/${info.variant}/${info.channel}/${res.data.arch}/${info.filename}.zsync -o /sineware/prolinux_${newRoot}.squish -i /sineware/prolinux_${selectedRoot}.squish`);
            console.log("  - Downloaded!");
            // todo verify jwt
            console.log("  - Updating system configuration...");
            await callWS("set-selected-root", { selectedRoot: newRoot }, true);
            console.log("Done! Reboot your device to apply the update.");
        } else {
            console.log("  - No update available.");
        }*/
        console.log("----------------------------------------");
        console.log("Dispatching update...");
        await callWS(LocalActions.START_UPDATE, {}, true);
        await streamWS(LocalActions.UPDATE_PROGRESS, (data, ws) => {
            const progress = data.progress;
            const total = data.total;
            const newRoot = data.newRoot;
            const buildnum = data.buildnum;

            const percent = Math.round((progress / total) * 100);
            
            console.clear();
            console.log("----------------------------------------");
            console.log("Installing ProLinux Update, Build " + buildnum);
            console.log("Progress: " + percent + "% (" + progress + "/" + total + ") to root " + newRoot + "...");

            if(percent == 100) {
                console.log("Done! Reboot your device to apply the update.");
                ws.close();
            }
        });
    });

    // Root Lock
    program.command('root-lock')
        .argument('<state>', 'on/off')
        .description('Set the root lock on/off (immutable overlay)')
        .action(async (str, options) => {
            if(str == "on") {
                await callWS(LocalActions.SET_LOCKED_ROOT, { lockedRoot: true }, true);
            } else if(str == "off") {
                await callWS(LocalActions.SET_LOCKED_ROOT, { lockedRoot: false }, true);
            } else {
                console.log("Invalid state. Must be on or off.");
                return;
            }
            console.log("Done! Reboot your device to apply the changes.")
        });
    program.command('reset-writable')
        .description('Reset the writable overlay')
        .action(async (str, options) => {
            console.log("Not implemented yet.");
        });
    program.command('disable-kexec')
        .description('Disables Kexec boot - use the firmware kernel from /boot.')
        .action(async (str, options) => {
            await callWS(LocalActions.SET_DISABLE_KEXEC, { disableKexec: true }, true);
            console.log("Done! Reboot your device to apply the changes.")
        });
}
// sudo zsync http://espi.sineware.ca/repo/prolinux/mobile/dev/arm64/prolinux-root-mobile-dev.squish.zsync -o ~/prolinux_b.squish