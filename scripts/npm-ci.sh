#!/usr/bin/env bash
# npm records the playpress git dependency as an SSH URL. Rewrite GitHub SSH
# to HTTPS for this process so CI can fetch it without a deploy key.
set -euo pipefail

export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf'
export GIT_CONFIG_VALUE_0='ssh://git@github.com/'
export GIT_CONFIG_KEY_1='url.https://github.com/.insteadOf'
export GIT_CONFIG_VALUE_1='git+ssh://git@github.com/'

npm ci "$@"
