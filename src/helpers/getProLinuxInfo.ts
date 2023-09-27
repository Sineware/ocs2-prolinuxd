import fs from 'node:fs';
export async function getProLinuxInfo() {
    const prolinuxInfo = fs.readFileSync('/opt/build-info/prolinux-info.txt', 'utf8');
    // "4,c5e3ff5b-1aba-4796-80dd-8622ec4f9cc6,prolinux,embedded,dev,Thu Sep 21 11:04:27 PM EDT 2023,prolinux-root-embedded-dev.squish,x64"
    const [buildnum, uuid, product, variant, channel, builddate, filename, arch] = prolinuxInfo.split(',');
    return {
        buildnum,
        uuid,
        product,
        variant,
        channel,
        builddate,
        filename,
        arch
    };
    
}