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

    this.appName = this.getEnv('APP_NAME', 'gmail-wp-pipeline');

    // get version from package file
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
    );
    this.version = pkg.version;

    // port express server runs on in the container
    this.serverPort = this.getEnv('APP_SERVER_PORT', 3000);

    this.taskTimeout = this.getEnv('APP_TASK_TIMEOUT', 1000 * 60 * 10);

    this.cron = {
      schedule: this.getEnv('APP_CRON_SCHEDULE', '0 4 * * *'),
      timezone: this.getEnv('APP_CRON_TIMEZONE', 'America/Los_Angeles'),
      idleAtStartup: this.getEnv('APP_CRON_IDLE_AT_STARTUP', false)
    }

    this.gc = {
      projectId: this.getEnv('APP_GC_PROJECT_ID', 'digital-ucdavis-edu'),
      keyFilename: this.getEnv('APP_GC_KEY_FILENAME', '/secrets/gc-service-account-creds.json'),
      oauthClientId: this.getEnv('APP_GC_OAUTH_CLIENT_ID'),
      oauthClientSecret: this.getEnv('APP_GC_OAUTH_CLIENT_SECRET')
    }
    this.gc.serviceAccountExists = fs.existsSync(this.gc.keyFilename);

    this.gmail = {
      account: this.getEnv('APP_GMAIL_ACCOUNT'),
      password: this.getEnv('APP_GMAIL_PASSWORD')
    }

    this.logger = {
      name: this.getEnv('APP_LOGGER_NAME', this.appName),
      streams: this.toArray( this.getEnv('APP_LOGGER_STREAM', 'console,gc') ),
      level: this.getEnv('APP_LOGGER_LEVEL', 'info'),
      alertOnError: this.getEnv('APP_LOGGER_ALERT_ON_ERROR', false)
    }
    this.logger.scriptLabel = this.getEnv('APP_LOGGER_SCRIPT_LABEL', this.logger.name);
  }

  /**
   * @description Get an environment variable.  If the variable is not set, return the default value.
   * @param {String} name - The name of the environment variable.
   * @param {*} defaultValue - The default value to return if the environment variable is not set.
   * @returns
   */
  getEnv(name, defaultValue=false){
    const env = process?.env?.[name]
    if ( env ) {
      if ( env.toLowerCase() == 'true' ) return true;
      if ( env.toLowerCase() == 'false' ) return false;
      return env;
    }
    return defaultValue;
  }
}

export default new Config();
