import logger from "./logger.js";
import gmail from "./gmail.js";

/**
 * @description Worker class for the pipeline
 */
class TaskWorker {

  async run(opts={}){
    const unprocessedMessages = await gmail.getUnprocessedMessages();
    let processCt = 0;
    for ( let message of unprocessedMessages ){

      await message.get();

      if ( !message.emailList ){
        logger.info('Message is not from a recognized email list. Skipping', {data: message.loggerInfo});
        continue;
      }
      logger.info(`Message from recognized email list: ${message.emailList.sender}`, {data: message.loggerInfo});

      await message.postToWordpress();

      processCt++;
      await message.markAsProcessed(processCt === 1);
    }

    await gmail.trashOldMessages();
    logger.info(`Processed ${processCt} messages`);
  }
}

export default new TaskWorker();
