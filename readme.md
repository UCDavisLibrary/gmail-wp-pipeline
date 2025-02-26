# Gmail -> Wordpress (WP) Pipeline

IN ACTIVE DEVELOPMENT!

Creates wordpress posts from Gmail emails. Built in order to create news items in the UC Davis Library intranet from emails sent to library-wide distribution lists.

The general process works as follows:
- Emails retrieved from a Gmail address using Gmail API
- If email is not from specified distribution list (see `config.js`), it is skipped
- If sender is not a user in WP instance:
  - If in Library IAM system, a WP user account is created
  - Else, message will be posted as Service Account
- Any attachments are uploaded to WP media library
- If message has event invite, details of event are added to message body
- `src` of any embedded images are updated with WP media url
- Any other attachments are listed in message body with WP media url
- Message is created as a WP post
- A label is applied to Gmail message marking that is has been processed, so that it is not picked up in future runs
- Any emails older than specified threshold are deleted from Gmail inbox

## DEV TODO:
- Figure out how departments will be tagged once the intranet project progresses that far
- Handle non-personal email addresses
  - Right now, they will get posted as the service account if not in our IAM system.
  - Won't be that many... Could make a wp account for them ahead of time, but then they also need to get tagged with the appropriate department
- Create service account for intranet. ensure that application password functionality of api works with oidc. might need to get oauth token?
- Determine retention policy for posts in wp. delete all older than policy.

## Local Development
- Build local image with `./devops/cmds/build-local-dev.sh` 
- Get GC service account creds with `./devops/cmds/get-gc-sa-creds.sh`
- Get env file with `./devops/cmds/get-env.sh -l`
- Verify that env in `devops/compose/gmail-wp-pipeline-local-dev` looks good
- Bring container up with `cd devops/compose/gmail-wp-pipeline-local-dev` and `docker compose up -d`
- By default the container is idle in local development, so you will have to manually start the main process with `docker compose exec app bash` and `node ./server.js`
- And then in another terminal manually run the script with `docker compose exec app bash` and `node ./cli.js run -w`

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
