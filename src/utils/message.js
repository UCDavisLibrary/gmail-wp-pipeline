import gmail from './gmail.js';
import logger from './logger.js';
import config from './config.js';
import wp from './wp.js';
import ucdlibIam from './ucdlib-iam.js';
import crypto from 'crypto';

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
   * @description Post the message to Wordpress
   */
  async postToWordpress(){
    try {
      const data = await this.transform();
      logger.info('Posting to wordpress', {data: this.loggerInfo});
      this.post = await wp.createNews(data);
      logger.info('Posted to wordpress', {data: {email: this.loggerInfo, postId: this.post.id}});
    } catch (err) {
      logger.error('Error posting to wordpress. Undoing any write actions...', {data: this.loggerInfo, error: err.message, stack: err.stack});
      if ( this.mediaUploads ) {}
      if ( this.authorCreated ) {
        await wp.deleteAuthor(this.author.id);
      }
      if ( this.post ){
        await wp.deleteNews(this.post.id);
      }
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

    await this.syncWordpressAuthor();
    if ( this.author ) post.author = this.author.id;

    return post;
  }

  /**
   * @description Look up the author in wordpress, if it doesn't exist, create it
   * @returns {Object} - The author data from wordpress
   */
  async syncWordpressAuthor(){
    const { email } = this.parseSender();
    if ( !email ) {
      logger.warn('No email found for author', {data: this.loggerInfo});
      return;
    }
    logger.info('Searching for author in wordpress', {data: {email: this.loggerInfo, searchTerm: email}});
    const searchRes = await wp.findAuthor(email);
    let author = searchRes.find( a => a.email === email );
    if ( author ){
      logger.info('Author found in wordpress', {data: {email: this.loggerInfo, authorId: author.id}});
      this.author = author;
      return author;
    }
    logger.info('Author not found in wordpress', {data: {email: this.loggerInfo}});

    const iamRecord = await ucdlibIam.getEmployeeByEmail(email);
    if ( !iamRecord?.user_id ) {
      logger.info('No kerberos id found for author. Posting as service account', {data: this.loggerInfo});
      return;
    }
    const payload = {
      username: iamRecord.user_id,
      email,
      name: `${iamRecord.first_name} ${iamRecord.last_name}`,
      first_name: iamRecord.first_name,
      last_name: iamRecord.last_name,
      roles: ['author'],
      password: crypto.randomBytes(24).toString('hex')
    };
    logger.info('Creating author in wordpress', {data: {email: this.loggerInfo, username: payload.username}});
    this.author = await wp.createUser(payload);
    this.authorCreated = true;
    logger.info('Author created in wordpress', {data: {email: this.loggerInfo, authorId: this.author.id}});
    return this.author;
  };

  /**
   * @description Recursively concatenate all text/plain or text/html from payload parts
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
   * @description Parse the sender from the from field
   * @returns {Object} - Object with name, firstName, lastName, email properties
   */
  parseSender(){
    const from = this.from;
    const match = from.match(/(.*)<(.*)>/);
    if ( match ) {
      const name = match[1].trim();
      const nameArr = name.split(' ');
      let firstName, lastName;
      if ( nameArr.length === 2 ) {
        [firstName, lastName] = nameArr;
      }
      return {
        name,
        firstName,
        lastName,
        email: match[2].trim()
      };
    }
    return {
      name: from,
      email: from
    };
  };

  /**
   * @description The sent date of the email as a JavaScript Date object
   * @returns {Date}
   */
  get sentDate(){
    const dateHeader = this.headers.find(h => h.name === 'Date')?.value;
    return dateHeader ? new Date(dateHeader) : null;
  }
}
