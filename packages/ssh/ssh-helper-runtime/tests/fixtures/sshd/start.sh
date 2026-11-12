#!/bin/sh
set -eu
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
install -d -m 700 -o ah -g ah /home/ah/.ssh
install -m 600 -o ah -g ah /fixture-key.pub /home/ah/.ssh/authorized_keys
install -d -m 700 -o ah -g ah /home/ah/workspace
exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config
