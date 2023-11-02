import { config } from "../../index";
import { runCmd } from "../../helpers/runCmd";
import {log} from "../../logging";
import { getProLinuxInfo } from "../../helpers/getProLinuxInfo";

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
export async function startDeviceSpecificServices() {
    const prolinuxInfo = await getProLinuxInfo();
    const SDM845Devices = [
        "oneplus-enchilada",
        "xiaomi-beryllium",
    ]
    // SDM845 Modem Support
    if(SDM845Devices.includes(prolinuxInfo.deviceinfoCodename)) {
        log.info("Starting SDM845 Support Services...");
        await runCmd("systemctl", ["start", "qrtr-ns"]);
        await runCmd("systemctl", ["start", "rmtfs"]);
        await runCmd("systemctl", ["start", "pd-mapper"]);
        await runCmd("systemctl", ["start", "tqftpserv"]);
    }

    if(prolinuxInfo.deviceinfoCodename === "pine64-pinephone" || prolinuxInfo.deviceinfoCodename === "pine64-pinephonepro") {
        log.info("Starting Pinephone(Pro) Support Services...");
        await runCmd("systemctl", ["start", "eg25-manager"]);
    }

}

/* Boot-time setup */
export async function loadPL2Module() {
    await setHostname();
    await startDeviceSpecificServices();
}