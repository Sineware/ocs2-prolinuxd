import { Command } from "commander";
import { promises as fs } from 'fs';
import axios from 'axios';
import { callWS } from "../../plctl";
import { exec } from "child_process";

const prolinuxInfo = async () => {
    const prolinuxInfoArr = (await fs.readFile("/opt/build-info/prolinux-info.txt", "utf-8")).split(",");
    return {
        buildnum: prolinuxInfoArr[0].trim(),
        uuid: prolinuxInfoArr[1].trim(),
        product: prolinuxInfoArr[2].trim(),
        variant: prolinuxInfoArr[3].trim(),
        channel: prolinuxInfoArr[4].trim(),
        filename: prolinuxInfoArr[6].trim(),
        arch: prolinuxInfoArr[7].trim(),
    };
}

export async function registerPL2Commands(program: Command) {

    const update = program.command('update').description('prolinux update tools')
    update.command('status').description('get available updates and current system info').action(async () => {
        console.log("----------------------------------------");
        console.log("- Product: " + (await prolinuxInfo()).product + ", Variant " + (await prolinuxInfo()).variant + ", Channel " + (await prolinuxInfo()).channel);  
        console.log("- Installed: Build " + (await prolinuxInfo()).buildnum + ", " + (await prolinuxInfo()).uuid);
        console.log("----------------------------------------");
        console.log("- Available (remote): ");

        const res = await axios.get(`https://update.sineware.ca/updates/prolinux/${(await prolinuxInfo()).variant}/${(await prolinuxInfo()).channel}`);
        console.log("  - Build " + res.data.buildnum + ", " + res.data.uuid);
        if(res.data.buildnum > (await prolinuxInfo()).buildnum) {
            console.log("  - Update available!");
        } else {
            console.log("  - No update available.");
        }
        console.log("----------------------------------------");
    });
    update.command('install').description('install the latest update').action(async () => {
        let info = await prolinuxInfo();
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
            exec(`cd /sineware && sudo zsync https://espi.sineware.ca/${info.product}/${info.variant}/${info.channel}/${res.data.arch}/${info.filename}.zsync -o /sineware/prolinux_${newRoot}.squish`);
            console.log("  - Downloaded!");
            // todo verify jwt
            console.log("  - Updating system configuration...");
            await callWS("set-selected-root", { selectedRoot: newRoot }, true);
            console.log("Done! Reboot your device to apply the update.");
        } else {
            console.log("  - No update available.");
        }
    });
}
// sudo zsync http://espi.sineware.ca/repo/prolinux/mobile/dev/arm64/prolinux-root-mobile-dev.squish.zsync -o ~/prolinux_b.squish