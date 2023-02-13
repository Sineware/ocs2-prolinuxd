import { runCmd } from "../../helpers/runCmd";
import { log } from "../../logging";
import * as fs from "node:fs";
export async function loadPlasmaMobileNightlyModule() {
    try {
        // Ensure the TinyDM default-session is set
        await runCmd("cp", ["/opt/prolinuxd/session-wrapper.desktop", "/usr/share/wayland-sessions/prolinux-session-wrapper.desktop"])
        await runCmd("/usr/bin/tinydm-set-session", ["-f", "-s", "/usr/share/wayland-sessions/prolinux-session-wrapper.desktop"])

        // Allow NetworkManager to autoconnect to networks
        let connections = fs.readdirSync("/etc/NetworkManager/system-connections");
        for (const c of connections) {
            let file = fs.readFileSync("/etc/NetworkManager/system-connections/" + c, "utf8");
            fs.writeFileSync("/etc/NetworkManager/system-connections/" + c, 
                file.split('\n').filter((line: string) => { 
                    return !line.startsWith( "permissions=" );
                }).join('\n')
            );
        }
    } catch(e) {
        log.error("Failed to load Plasma Mobile Nightly module: " + e);
    }
}

