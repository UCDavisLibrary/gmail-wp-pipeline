import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

/**
 * @description Configuration class for the application.
 * Reads environment variables and sets default values for configuration options.
 */
class Config {

  constructor(){

    this.appName = this.getEnv('GMAILWP_NAME', 'gmail-wp-pipeline');

    this.ignoreEnvError = this.getEnv('GMAILWP_IGNORE_ENV_ERROR', false);

    // must have unique instance name to ensure that multiple sites can share the same email account
    this.instanceName = this.getEnv('GMAILWP_INSTANCE_NAME', false, true);

    // get version from package file
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
    );
    this.version = pkg.version;

    // port express server runs on in the container
    this.serverPort = this.getEnv('GMAILWP_SERVER_PORT', 3000);

    this.taskTimeout = this.getEnv('GMAILWP_TASK_TIMEOUT', 1000 * 60 * 10);

    this.cron = {
      schedule: this.getEnv('GMAILWP_CRON_SCHEDULE', '0 4 * * *'),
      timezone: this.getEnv('GMAILWP_CRON_TIMEZONE', 'America/Los_Angeles'),
      idleAtStartup: this.getEnv('GMAILWP_CRON_IDLE_AT_STARTUP', false)
    }

    // google cloud credentials, for logging and oauth
    this.gc = {
      projectId: this.getEnv('GMAILWP_GC_PROJECT_ID', 'digital-ucdavis-edu'),
      keyFilename: this.getEnv('GMAILWP_GC_KEY_FILENAME', '/secrets/gc-service-account-creds.json'),
      oauthClientId: this.getEnv('GMAILWP_GC_OAUTH_CLIENT_ID'),
      oauthClientSecret: this.getEnv('GMAILWP_GC_OAUTH_CLIENT_SECRET')
    }
    this.gc.serviceAccountExists = fs.existsSync(this.gc.keyFilename);

    // the gmail account we are reading from
    const processedLabelDefault = 'UCDLIB_' + this.instanceName
      .replace(/-/g, '_')
      .replace(/ /g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toUpperCase() + '_PROCESSED';
      ;
    this.gmail = {
      account: this.getEnv('GMAILWP_GMAIL_ACCOUNT'),
      password: this.getEnv('GMAILWP_GMAIL_ACCOUNT_PASSWORD'),
      refreshToken: this.getEnv('GMAILWP_GMAIL_ACCOUNT_REFRESH_TOKEN'),
      processedLabel: this.getEnv('GMAILWP_GMAIL_PROCESSED_LABEL', processedLabelDefault),
      trashThreshold: this.getEnv('GMAILWP_GMAIL_TRASH_THRESHOLD', '30d')
    }

    // will only process emails sent from these sympa lists
    const emailLists = this.getEnv('GMAILWP_EMAIL_LISTS');
    if ( emailLists ) {
      this.emailLists = JSON.parse(emailLists);
    } else {
      this.emailLists = [
        {
          sender: 'lib-personnel-request@listserv.lib.ucdavis.edu',
          subjectStrip: '[lib-personnel]'
        },
        {
          sender: 'liball-request@listserv.lib.ucdavis.edu',
          subjectStrip: '[liball]'
        }
      ];
    }

    this.wp = {
      url: this.getEnv('GMAILWP_WP_URL', false, true),
      username: this.getEnv('GMAILWP_WP_USERNAME', false, true),
      password: this.getEnv('GMAILWP_WP_PASSWORD', false, true)
    }

    this.logger = {
      name: this.getEnv('GMAILWP_LOGGER_NAME', this.appName),
      streams: this.toArray( this.getEnv('GMAILWP_LOGGER_STREAM', 'console,gc') ),
      level: this.getEnv('GMAILWP_LOGGER_LEVEL', 'info'),
      alertOnError: this.getEnv('GMAILWP_LOGGER_ALERT_ON_ERROR', false)
    }
    this.logger.scriptLabel = this.getEnv('GMAILWP_LOGGER_SCRIPT_LABEL', this.logger.name);
  }

  /**
   * @description Get an environment variable.  If the variable is not set, return the default value.
   * @param {String} name - The name of the environment variable.
   * @param {*} defaultValue - The default value to return if the environment variable is not set.
   * @param {Boolean} errorIfMissing - If true, throw an error if the environment variable is not set.
   * @returns
   */
  getEnv(name, defaultValue=false, errorIfMissing=false){
    const env = process?.env?.[name]
    if ( env ) {
      if ( env.toLowerCase() == 'true' ) return true;
      if ( env.toLowerCase() == 'false' ) return false;
      return env;
    }
    if ( errorIfMissing && !this.ignoreEnvError ) {
      throw new Error(`Environment variable ${name} is required`);
    }
    return defaultValue;
  }

  toArray(str){
    if ( !str ) return [];
    return str.split(',').map( s => s.trim() );
  }
}

export default new Config();
