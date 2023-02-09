pkgname=prolinuxd
pkgver=1.0.0
pkgrel=0
pkgdesc="Sineware Cloud Daemon for ProLinux"
arch="all !ppc64le !s390x !armhf !riscv64"
url="https://sineware.ca/"
license="GPL-2.0"
depends="
	nodejs
    npm
	"
makedepends="
    nodejs
    npm
	"
source="https://github.com/Sineware/ocs2-prolinuxd/archive/refs/heads/main.zip"
options="net"

build() {
    npm ci
	npm run build
}

package() {
    mkdir -p "$pkgdir/opt/prolinuxd"
    mkdir -p "$pkgdir/etc/init.d"
    cp -r dist/* "$pkgdir/opt/prolinuxd/"

    cp distro-files/prolinuxd "$pkgdir/opt/prolinuxd/"
    cp distro-files/prolinuxd.initd "$pkgdir/etc/init.d/prolinuxd"
    cp distro-files/prolinux.toml "$pkgdir/opt/prolinuxd/"
    cp distro-files/session-wrapper.desktop "$pkgdir/opt/prolinuxd/"
}