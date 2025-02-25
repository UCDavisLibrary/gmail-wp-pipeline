import config from "./config.js";
import { google } from "googleapis";
import Message from "./message.js";
import logger from "./logger.js";

/**
 * @description Class for interacting with the Gmail API
 */
class Gmail {

  constructor(){

    this.oAuth2Client = new google.auth.OAuth2(
      config.gc.oauthClientId,
      config.gc.oauthClientSecret,
      'http://localhost'
    );
    this.oAuth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });
    this.client = google.gmail({ version: 'v1', auth: this.oAuth2Client });
  }

  /**
   * @description Generate the URL to authorize the app to access the Gmail account.
   * @returns {String}
   */
  generateAuthUrl() {
    return this.oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ['https://www.googleapis.com/auth/gmail.modify']
    });
  }

  /**
   * @description Exchange the authorization code for a refresh token
   * @param {String} code - The authorization code from the redirect URL
   * @returns {String} - The refresh token
   */
  async getRefreshToken(code) {
    const { tokens } = await this.oAuth2Client.getToken(code);
    return tokens.refresh_token;
  }

  /**
   * @description Get an attachment from a message
   * @param {String} messageId
   * @param {String} attachmentId
   * @returns {Object} - The attachment data
   */
  async getAttachment(messageId, attachmentId){
    logger.info('Getting attachment', {data: {messageId, attachmentId}});
    const res = await this.client.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId
    });
    logger.info('Got attachment', {data: {messageId, attachmentId}});
    return res.data;
  }

  /**
   * @description Gets messages that are not already labeled with a sympa list label
   * @returns {Array<Message>}
   */
  async getUnprocessedMessages(){
    logger.info('Getting unprocessed messages');
    return this.list({
      q: `-label:${config.gmail.processedLabel}`
    });
  }

  /**
   * @description List messages in the Gmail account
   * @param {Object} query - The query parameters to pass to the list method
   * @returns {Array<Message>}
   */
  async list(query={}){
    if ( !query.userId ) query.userId = 'me';
    if ( !query.maxResults ) query.maxResults = 500;
    logger.info('listing messages', {data: query});
    const res = await this.client.users.messages.list(query);
    if ( !res.data.messages ){
      logger.info('No messages found', {data: query});
      return [];
    }
    logger.info(`Got ${res.data.messages.length} messages`);
    if ( res.data.messages.length == query.maxResults ){
      logger.warn(`There are more messages than the maxResults of ${query.maxResults}`);
    }
    return res.data.messages.map( m => new Message(m.id, m.threadId) );
  }

  /**
   * @description Ensure the processed label exists in gmail account
   * @param {Boolean} resetCache - If true, will reset the in-memory response cache
   */
  async ensureProcessedLabel(resetCache){
    if ( resetCache ) this.processedLabel = false;
    if ( this.processedLabel ) return;
    logger.info(`Fetching processed label: ${config.gmail.processedLabel}`);
    let res = await this.client.users.labels.list({
      userId: 'me'
    });
    let exists = res.data.labels.find( l => l.name == config.gmail.processedLabel );
    if ( exists ){
      logger.info('Processed label exists');
      this.processedLabel = exists;
      return;
    }
    logger.info('Processed label does not exist. Creating it');
    res = await this.client.users.labels.create({
      userId: 'me',
      requestBody: {
        name: config.gmail.processedLabel,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });
    logger.info('Processed label created');
    this.processedLabel = res.data;
  }

  /**
   * @description Trash messages older than the threshold set in the config
   */
  async trashOldMessages(){
    if ( !config.gmail.trashThreshold ) {
      logger.info('Trash threshold not set. Not trashing old messages');
      return;
    }
    logger.info(`Trashing messages older than: ${config.gmail.trashThreshold}`);
    const messages = await this.list({
      q: `older_than:${config.gmail.trashThreshold}`
    });
    for ( let message of messages ){
      await message.trash();
    }
    logger.info(`Trashed ${messages.length} old messages`, {data: {threshold: config.gmail.trashThreshold}});
  }

}

export default new Gmail();
