#!/usr/bin/env bash
set -e
USER=user
HOST=172.16.42.1
DIR=/opt/prolinuxd/

#swift build -c release --static-swift-stdlib
rsync -avz --delete dist/ ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinuxd.initd ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/session-wrapper.desktop ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinux.toml ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinuxd ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/aarch64-alpine-pty.node ${USER}@${HOST}:${DIR}/session-wrapper/build/Release/pty.node
rsync -avz --delete distro-files/prolinux-config.desktop ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/app-icon.png ${USER}@${HOST}:${DIR}


exit 0