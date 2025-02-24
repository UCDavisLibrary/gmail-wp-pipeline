import gmail from './gmail.js';
import logger from './logger.js';
import config from './config.js';
import wp from './wp.js';

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

  async postToWordpress(){
    try {
      const data = await this.transform();
      logger.info('Posting to wordpress', {data: this.loggerInfo});
      this.post = await wp.createNews(data);
      logger.info('Posted to wordpress', {data: {email: this.loggerInfo, postId: this.post.id}});

    } catch (err) {
      // todo: undo any writes to wordpress
      if ( this.mediaUploads ) {}
      if ( this.authorCreated ) {}

      if ( this.post ){}
      logger.info('Error posting to wordpress.', {data: this.loggerInfo});
      throw err;
    }
  }

  /**
   * @description Transform the message data into wordpress post data
   * @returns {Object} - The post data
   */
  async transform(){
    const post = {
      status: 'publish',
      date_gmt: this.sentDate.toISOString(),
      title: this.emailList?.subjectStrip ? this.subject.replace(this.emailList.subjectStrip, '').trim() : this.subject,
      content: this.getPostContent()
    };
    return post;
  }

  /**
   * @description Recursively concatenate all text/plain and text/html from payload parts
   * @returns {String} - The concatenated content
   */
  getPostContent(parts = this.data.payload.parts, content = '') {
    if ( !Array.isArray(parts) ) return content;

    const hasHtml = parts.some( p => p.mimeType === 'text/html' );
    for (const part of parts) {
      if (part.mimeType === 'text/html' || ( !hasHtml && part.mimeType === 'text/plain' )) {
        content += part?.body?.data ? Buffer.from(part.body.data, 'base64').toString('utf-8') : '';
      }
      if (part.parts) {
        content = this.getPostContent(part.parts, content);
      }
    }

    // Strip <head>...</head> tags from the content
    // They just tend to gum up the works in wordpress
    content = content.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    return content;
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

  /**
   * @description The sent date of the email as a JavaScript Date object
   * @returns {Date}
   */
  get sentDate(){
    const dateHeader = this.headers.find(h => h.name === 'Date')?.value;
    return dateHeader ? new Date(dateHeader) : null;
  }
}
