import gmail from './gmail.js';
import logger from './logger.js';
import config from './config.js';
import wp from './wp.js';
import ucdlibIam from './ucdlib-iam.js';
import crypto from 'crypto';
import ical from 'node-ical';
import pkg from 'rrule';
const { RRule } = pkg;

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
   * @description Post the message to Wordpress along with any attachments
   */
  async postToWordpress(){
    try {
      logger.info('Posting to wordpress', {data: this.loggerInfo});

      // get and upload attachments
      logger.info('Getting message attachments', {data: this.loggerInfo});
      this.attachments = await this.getAttachments();
      logger.info('Got message attachments', {data: this.loggerInfo});
      for ( const attachment of this.attachments ) {
        attachment.wpMedia = await wp.uploadMedia(attachment.data, attachment.filename, attachment.mimeType);
      }

      const data = await this.transform();

      // substitute cid references in the post content with the attachment urls
      for ( const attachment of this.attachments ) {
        if ( attachment.cid ) {
          logger.info('Substituting attachment cid in post content', {data: {email: this.loggerInfo, cid: attachment.cid, url: attachment.wpMedia.source_url}});
          data.content = data.content.replace(`cid:${attachment.cid}`, attachment.wpMedia.source_url);
        }
      }

      // add attachments to the post content if not already embedded
      const nonEmbedAttachments = this.attachments.filter( a => !a.cid );
      if ( nonEmbedAttachments.length){
        data.content += `
        <div>
          <h2>Attachments</h2>
          <ul class='list--arrow'>
            ${this.attachments.map( a => `<li><a href="${a.wpMedia.source_url}">${a.filename}</a></li>` ).join('')}
          </ul>
        </div>
      `;
      }

      logger.info('Creating news post', {data: this.loggerInfo});
      this.post = await wp.createNews(data);
      logger.info('News post created', {data: {email: this.loggerInfo, postId: this.post.id}});

      // update attachments to include post and author ids
      for ( const attachment of this.attachments ) {
        const data = { post: this.post.id };
        if ( this.author ) data.author = this.author.id;
        logger.info('Updating attachment in WP with post and author ids', {data: {email: this.loggerInfo, attachmentId: attachment.wpMedia.id}});
        attachment.wpMedia = await wp.updateMedia(attachment.wpMedia.id, data);
      }

      logger.info('Message successfully posted to wordpress', {data: this.loggerInfo});
    } catch (err) {
      logger.error('Error posting to wordpress. Undoing any write actions...', {data: this.loggerInfo, error: err.message, stack: err.stack});
      const uploads = (this.attachments || []).map( a => a.wpMedia );
      for ( const upload of uploads ){
        if ( upload ) {
          await wp.deleteMedia(upload.id);
        }
      }
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

    // append event details to the content if message has a calendar event
    const eventHtml = await this.getCalendarEventSummary('html');
    if ( eventHtml ) {
      post.content += eventHtml;
    }

    // get or create the wordpress author based on the email sender
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
   * @description Get the summary of the calendar event from the message
   * @param {String} fmt - The format to return the summary in.  'json' or 'html'
   * @returns {Object|String} - The summary of the calendar event. Null if no event found
   */
  async getCalendarEventSummary(fmt='json'){
    const ics = await this.getCalendarIcs();
    if ( !ics ) return null;
    const event = Object.values(ics).find( e => e.type === 'VEVENT' );
    if ( !event ) return null;

    const summary = {
      title: event?.summary?.val || event?.summary || '',
      location: event?.location?.val || event?.location || '',
      recurrence: event.rrule ? RRule.fromString(event.rrule.toString()).toText() : null
    };

    const dateFormatter = new Intl.DateTimeFormat('en-US',
      {
        timeZone: event?.start?.tz || 'America/Los_Angeles',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }
    );

    if ( event?.start ) {
      summary.start = dateFormatter.format(new Date(event.start));
    }
    if ( event?.end ) {
      summary.end = dateFormatter.format(new Date(event.end));
    }

    if ( fmt === 'json' ) return summary;

    if ( fmt === 'html' ) {
      return `
        <div>
          <h2>Event Details</h2>
          <p><strong>Title:</strong> ${summary.title}</p>
          <p><strong>Location:</strong> ${summary.location}</p>
          <p><strong>Start:</strong> ${summary.start}</p>
          <p><strong>End:</strong> ${summary.end}</p>
          ${summary.recurrence ? `<p><strong>Recurrence:</strong> ${summary.recurrence}</p>` : ''}
        </div>
      `;
    }
  }

  /**
   * @description Get the ical data from the message
   * @returns {Object} - The parsed ical data
   */
  async getCalendarIcs(){
    if ( this.calendarIcs ) return this.calendarIcs;
    const raw = await this.getCalendarPart();
    if ( !raw ) return null;
    this.calendarIcs = ical.sync.parseICS(raw);
    return this.calendarIcs;
  }

  /**
   * @description Get the first text/calendar part from the message
   * @param {Array} parts
   * @returns {String} - The ical data or null if not found
   */
  async getCalendarPart(parts = this.data.payload.parts){
    if ( !Array.isArray(parts) ) return null;
    const calendar = parts.find( p => p.mimeType === 'text/calendar' );
    if ( calendar?.body?.data ) {
      return Buffer.from(calendar.body.data, 'base64').toString('utf-8');
    }
    if ( calendar?.body?.attachmentId ) {
      logger.info('Getting ical attachment', {data: {email: this.loggerInfo, attachmentId: calendar.body.attachmentId}});
      const attachment = await gmail.getAttachment(this.id, calendar.body.attachmentId);
      return Buffer.from(attachment.data, 'base64').toString('utf-8');
    }
    for (const part of parts) {
      if (part.parts) {
        const event = await this.getCalendarPart(part.parts);
        if ( event ) return event;
      }
    }
    return null;
  }

  async getAttachments(parts = this.data.payload.parts){
    const mimeTypeExclude = ['text/plain', 'text/html', 'text/calendar'];
    if ( !Array.isArray(parts) ) return [];
    const attachments = [];
    for (const part of parts) {
      if ( part.filename && !mimeTypeExclude.includes(part.mimeType) ) {
        const attachment = {
          filename: part.filename,
          mimeType: part.mimeType,
          part
        };
        let cid = part.headers.find( h => h.name === 'Content-ID' )?.value;
        if ( cid ) {
          attachment.cid = cid.replace(/^<|>$/g, '');
        }
        if ( part.body.data ) {
          attachment.data = Buffer.from(part.body.data, 'base64');
        } else if ( part.body.attachmentId ) {
          attachment.data = Buffer.from((await gmail.getAttachment(this.id, part.body.attachmentId)).data, 'base64');
        }
        attachments.push(attachment);
      }
      if (part.parts) {
        attachments.push(...await this.getAttachments(part.parts));
      }
    }
    return attachments;
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
