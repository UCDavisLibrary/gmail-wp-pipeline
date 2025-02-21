# Gmail -> WP Pipeline

IN ACTIVE DEVELOPMENT!

Creates wordpress posts from Gmail emails. Used for the intranet.

## Local Development

- Build local image with `./devops/cmds/build-local-dev.sh` 
- Get GC service account creds with `./devops/cmds/get-gc-sa-creds.sh`
- Get env file with `./devops/cmds/get-env.sh -l`
- Verify that env in `devops/compose/gmail-wp-pipeline-local-dev` looks good

## Getting a refresh token
There should be an offline refresh token in the env file in GC, which will remain valid so long as:
- It is actively used at least once in six months
- The user does not revoke access in their Google account settings
- A new refresh token is requested, which invalidates the old one

If the token is invalidated, follow these steps to get a new one:
- Run `authorize-gmail` cli command
- Go to authorization link provided, and go through approval process
- Google will redirect you to localhost. Copy the `code` url param.
- Enter the `code` url param into `get-gmail-refresh-token` command.
- Copy this refresh token into env file
- Restart app

## Resources
- [Google Oauth2](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest#obtaining-a-new-refresh-token)
- [Node gmail client](https://googleapis.dev/nodejs/googleapis/latest/gmail/classes/Resource$Users.html)
