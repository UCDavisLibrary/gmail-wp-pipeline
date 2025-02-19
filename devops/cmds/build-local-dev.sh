#! /bin/bash
# TODO: update to use cork-kube build

set -e
CMDS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $CMDS_DIR/../..

# Build the local dev image
docker build -t localhost/local-dev/gmail-wp-pipeline .
