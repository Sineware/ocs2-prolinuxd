#!/usr/bin/env bash
USER=user
HOST=192.168.20.185
DIR=/opt/prolinuxd/

#swift build -c release --static-swift-stdlib
rsync -avz --delete dist/ ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinuxd.initd ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/session-wrapper.desktop ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinux.toml ${USER}@${HOST}:${DIR}
rsync -avz --delete distro-files/prolinuxd ${USER}@${HOST}:${DIR}

exit 0