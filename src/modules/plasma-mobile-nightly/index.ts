import { runCmd } from "../../helpers/runCmd";
import { log } from "../../logging";
export async function loadPlasmaMobileNightlyModule() {
    try {
        // Ensure the TinyDM default-session is set
        await runCmd("cp", ["/opt/prolinuxd/session-wrapper.desktop", "/usr/share/wayland-sessions/prolinux-session-wrapper.desktop"])
        await runCmd("/usr/bin/tinydm-set-session", ["-f", "-s", "/usr/share/wayland-sessions/prolinux-session-wrapper.desktop"])
    } catch(e) {
        log.error("Failed to load Plasma Mobile Nightly module: " + e);
    }
}

