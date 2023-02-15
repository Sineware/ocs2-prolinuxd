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

        // Enable core dumps
        await runCmd("/bin/sh", ["-c", "echo '/tmp/core.%e.%p' | tee /proc/sys/kernel/core_pattern"]);
        let profile = fs.readFileSync("/home/user/.profile", "utf8");
        if (!profile.includes("ulimit -c unlimited")) {
            fs.appendFileSync("/home/user/.profile", "ulimit -c unlimited");
        }
        let limits = fs.readFileSync("/etc/security/limits.conf", "utf8");
        if (!limits.includes("core unlimited")) {
            fs.appendFileSync("/etc/security/limits.conf", "* soft core unlimited\n* hard core unlimited");
        }

    } catch(e) {
        log.error("Failed to load Plasma Mobile Nightly module: " + e);
    }
}

