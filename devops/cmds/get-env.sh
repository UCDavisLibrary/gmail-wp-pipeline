#! /bin/bash

###
# Downloads env from google cloud secret manager
# Usage: ./cmds/get-env.sh [-f] [-l]
# -f: force overwrite of existing .env file
# -l: download to local dev directory
###

set -e
CMDS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $CMDS_DIR/..

FORCE=false
LOCAL=false
ENV_PATH="compose/gmail-wp-pipeline-prod/.env"

while getopts "fl" opt; do
  case ${opt} in
    f )
      FORCE=true
      ;;
    l )
      LOCAL=true
      ;;
    \? )
      echo "Invalid option: -$OPTARG" 1>&2
      exit 1
      ;;
  esac
done

if [ "$LOCAL" = true ]; then
  ENV_PATH="compose/gmail-wp-pipeline-local-dev/.env"
fi

if [ -f "$ENV_PATH" ] && [ "$FORCE" != true ]; then
  echo ".env file already exists. Use -f flag to overwrite."
  exit 1
fi

gcloud --project=digital-ucdavis-edu secrets versions access latest --secret=itis-gmail-wp-pipeline-env > $ENV_PATH

echo "Env downloaded to deploy/$ENV_PATH"
