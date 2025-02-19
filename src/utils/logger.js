import bunyan from 'bunyan';
import {LoggingBunyan} from '@google-cloud/logging-bunyan';
import config from './config.js';

class Logger {
  constructor(){
    let streams = [];

    if ( config.logger.streams.includes('stdout') || config.logger.streams.includes('console') ){
      // log to console
      streams.push({ stream: process.stdout });
    }
    if ( config.logger.streams.includes('gc') && config.gc.serviceAccountExists ){
      let loggingBunyan = new LoggingBunyan({
        projectId: config.gc.projectId,
        keyFilename: config.gc.keyFilename,
        defaultCallback: err => {
          if (err) console.error('logging-bunyan error:', err);}
      });
      streams.push(loggingBunyan.stream(config.logger.level));
    }
    if ( config.logger.streams.includes('none') ){
      streams = [];
    }

    this.bunyan = bunyan.createLogger({
      name: config.logger.name,
      level: config.logger.level,
      streams: streams
    });

    let info = {
      name: config.logger.name,
      level: config.logger.level,
      googleCloudLogging : {
        serviceAccountExists : config.gc.serviceAccountExists,
        enabled : config.logger.streams.includes('gc')
      }
    }

    this.info('logger initialized', {config: info});
  }

  /**
   * @description Log an info message
   * @param  {...any} args
   */
  info(...args){
    this._callLoggerMethod('info', args);
  }

  /**
   * @description Log an error message
   * @param  {...any} args
   */
  error(...args){
    this._callLoggerMethod('error', args);
  }

  /**
   * @description Log a warning message
   * @param  {...any} args
   */
  warn(...args){
    this._callLoggerMethod('warn', args);
  }

  _callLoggerMethod(method, args){
    if ( !args?.length ) return;

    let parsedArgs = [];
    if ( config.logger.streams.includes('gc') ){
      const labels = {
        itisScript: config.logger.scriptLabel,
        itisScriptAlertOnError: `${config.logger.alertOnError}`
      }
      // merge in labels. gc extracts these from the bunyan payload and adds them to the gc log entry
      // if first arg is a string, bunyan will treat it as a message and stringify all subsequent args
      if ( this._objNotArray(args[0]) ){
        parsedArgs.push({...args[0], labels});
        parsedArgs.push(...args.slice(1));
      } else if ( this._objNotArray(args?.[1]) ){
        parsedArgs.push({...args[1], labels});
        parsedArgs.push(args[0]);
        parsedArgs.push(...args.slice(2));
      } else {
        parsedArgs.push({labels});
        parsedArgs.push(...args);
      }
    } else {
      parsedArgs = args;
    }
    this.bunyan[method](...parsedArgs);
  }

  _objNotArray(obj){
    if ( !obj ) return false;
    if ( Array.isArray(obj) ) return false;
    return typeof obj === 'object';
  }
}



export default new Logger();
