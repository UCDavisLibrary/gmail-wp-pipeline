import config from './config.js';
import cron from 'node-cron';
import logger from './logger.js';
import taskWorker from './task-worker.js';

/**
 * @description Class for managing/scheduling the main task of migrating occupancy data
 */
class Task {
  constructor(){
    this.status = 'idle';

    this.manualRunning = false;

    // set up the cron task
    this._task = cron.schedule(
      config.cron.schedule,
      () => { this._run(); },
      {
        timezone: config.cron.timezone,
        scheduled: false
      }
    )
  }

  /**
   * @description Schedule the task to run at the configured interval
   */
  start(){
    if ( this.status === 'running' ){
      return {status: 'currently-running'};
    }
    if ( this.status === 'scheduled' ){
      return {status: 'already-scheduled'};
    }
    this.status = 'scheduled';
    this._task.start();
    logger.info(`Task scheduled: ${config.cron.schedule}`);
    return {status: 'scheduled'};
  }

  /**
   * @description Stop/pause the scheduled task
   */
  stop(){
    if ( this.status === 'idle' ){
      return {status: 'already-idle'};
    }
    this._task.stop();
    this.status = 'idle';
    logger.info('Task stopped');
    return {status: 'idle'};
  }

  /**
   * @description Run the task manually
   * @param {Object} opts - Options for the task. See CLI for more info.
   * @returns
   */
  async run(opts={}){
    if ( this.manualRunning ) {
      return {status: 'already-running'};
    }
    let task = this._run({...opts, manual: true});
    if ( opts.wait ){
      task = await task;
      if ( task?.error ){
        return {status: 'error', error: task.error};
      }
      return {status: 'complete'};
    }
    return {status: 'started'};
  }

  async _run(opts={}){

    // set up a timeout for the task
    // if timeout is reached, container will crash and restart
    // thus stopping all running tasks
    const timeoutTime = opts.timeout || config.taskTimeout;
    const timeout = setTimeout(() => {
      const msg = `Task timed out after ${timeoutTime}ms`;
      logger.error(msg);
      throw new Error(msg);
    }, timeoutTime);


    try {
      if ( opts.manual ){
        if ( this.manualRunning ) return;
        this.manualRunning = true;
      } else {
        this.status = 'running';
      }
      logger.info('Job is running', opts);

      await taskWorker.run(opts);

    } catch (err) {
      logger.error({data: {
        message: err.message,
        stack: err.stack
      }});
      return {error: err.message};
    } finally {
      if ( opts.manual ){
        this.manualRunning = false;
      } else {
        this.status = 'scheduled';
      }
      clearTimeout(timeout);
    }
  }
}

export default new Task();
