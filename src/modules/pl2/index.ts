import { config } from "../../index";
import { runCmd } from "../../helpers/runCmd";
import {log} from "../../logging";

export async function setHostname() {
    // Set system hostname
    if(config.pl2.hostname) {
        log.info("Setting system hostname to " + config.pl2.hostname);
        await runCmd("hostnamectl", ["--transient", "set-hostname", config.pl2.hostname]);
        await runCmd("sh", ["-c", `echo ${config.pl2.hostname} > /etc/hostname`]);
    } else {
        log.error("No hostname configured, skipping hostname setup");
    }
}
export async function setSSHHostKeys() {
    // Generate SSH host keys
    log.info("Generating SSH host keys");
    await runCmd("ssh-keygen", ["-A"]);
}

export async function loadPL2Module() {
    await setHostname();
}