import gmail from './gmail.js';
import logger from './logger.js';
import config from './config.js';

/**
 * @description Class representing a single email message
 */
export default class Message {

  constructor(id, threadId) {
    if ( !id ) throw new Error('message id is required');
    this.id = id;
    this.threadId = threadId;
  }

  /**
   * @description Get the message data from the Gmail API
   * @returns {Object} - The message data from the Gmail API
   */
  async get(){
    if ( this.data ) return this.data;
    logger.info(`Getting message: ${this.id}`);
    const res = await gmail.client.users.messages.get({
      userId: 'me',
      id: this.id
    });
    this.data = res.data;
    logger.info('Got message', {data: this.loggerInfo});
    return this.data;
  }

  /**
   * @description Move the message to the trash
   * @returns {Object} - The response from the Gmail API
   */
  async trash(){
    logger.info(`Trashing message`, {data: this.loggerInfo});
    const res = await gmail.client.users.messages.trash({
      userId: 'me',
      id: this.id
    });
    logger.info(`Trashed message`, {data: this.loggerInfo});
    return res.data;
  }

  /**
   * @description Mark the message as processed by assigning a label
   * @param {Boolean} resetLabelCache - If true, will fetch the label from Gmail to ensure it still exists
   * @returns {Object} - The response from the Gmail API
   */
  async markAsProcessed(resetLabelCache){
    await gmail.ensureProcessedLabel(resetLabelCache);
    logger.info(`Marking message as processed`, {data: this.loggerInfo});
    const res = await gmail.client.users.messages.modify({
      userId: 'me',
      id: this.id,
      requestBody: {
        addLabelIds: [gmail.processedLabel.id]
      }
    });
    logger.info(`Message marked as processed`, {data: this.loggerInfo});
    return res.data;
  }

  /**
   * @description Get basic information about the message for logging purposes
   */
  get loggerInfo(){
    const d = {
      id: this.id,
      threadId: this.threadId,
      subject: this.subject,
      from: this.from,
    };
    if ( this.emailList?.sender ) d.emailList = this.emailList.sender;
    return d;
  }

  /**
   * @description The subject of the email
   * @returns {String}
   */
  get subject(){
    return this.headers.find( h => h.name == 'Subject' )?.value || '';
  }

  /**
   * @description The headers of the email
   * @returns {Array}
   */
  get headers(){
    return this.data?.payload?.headers || [];
  }

  /**
   * @description The registered email list the message is from
   * @returns {Object}
   */
  get emailList(){
    const sender = this.headers.find( h => h.name === 'Sender' )?.value || '';
    return config.emailLists.find( l => l.sender === sender );
  }

  /**
   * @description The from field of the email
   * @returns {String} - e.g. "Kaladin Stormblessed <kstormblessed@ucdavis.edu>"
   */
  get from(){
    return this.headers.find( h => h.name === 'From' )?.value || '';
  }
}
