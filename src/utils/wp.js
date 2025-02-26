import config from './config.js';
import fetch from 'node-fetch';
import logger from './logger.js';

/**
 * @description Class for interacting with the Wordpress API
 */
class Wp {

  constructor(){
    this.apiUrl = `${config.wp.url}/wp-json/wp/v2`;
  }

  /**
   * @description Create a news post in Wordpress
   * @param {Object} data - The data for the news post
   * @returns {Object} - The response from the Wordpress API
   */
  async createNews(data){
    const url = `${this.apiUrl}/posts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.addAuthHeader({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(data)
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error creating wordpress news post: ${text}`);
    }
    return await res.json();
  }

  /**
   * @description Upload media to Wordpress
   * @param {Buffer} fileBuffer - The file buffer to upload
   * @param {String} fileName - The name of the file
   * @param {String} mimeType - The mime type of the file
   * @returns
   */
  async uploadMedia(fileBuffer, fileName, mimeType){
    const url = `${this.apiUrl}/media`;
    logger.info(`Uploading media to wordpress: ${fileName}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.addAuthHeader({
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`
      }),
      body: fileBuffer
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error uploading media to wordpress: ${text}`);
    }
    const data = await res.json();
    logger.info(`Uploaded media to wordpress: ${fileName}`, {data: {id: data.id, url: data.source_url}});
    return data;
  }

  /**
   * @description Update a media item in Wordpress
   * @param {Number} id - The id of the media item to update
   * @param {Object} data - The data to update the media item with
   * @returns
   */
  async updateMedia(id, data){
    const url = `${this.apiUrl}/media/${id}`;
    logger.info(`Updating media in wordpress: ${id}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.addAuthHeader({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(data)
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error updating media in wordpress: ${text}`);
    }
    const updatedData = await res.json();
    logger.info(`Updated media in wordpress: ${id}`, {data: {id: updatedData.id, url: updatedData.source_url}});
    return updatedData;
  }

  /**
   * @description Find an author in Wordpress
   * @param {String} search - The search string to find the author
   * @returns {Array<Object>} - The response from the Wordpress API
   */
  async findAuthor(search){
    const url = `${this.apiUrl}/users?search=${search}&context=edit`;
    const res = await fetch(url, {
      headers: this.addAuthHeader({
        'Content-Type': 'application/json'
      })
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error finding author: ${text}`);
    }
    return await res.json();
  }

  /**
   * @description Create a user in Wordpress
   * @param {Object} payload - The data for the user
   * @returns {Object} - The response from the Wordpress API
   */
  async createUser(payload){
    const url = `${this.apiUrl}/users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.addAuthHeader({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(payload)
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error creating wordpress user: ${text}`);
    }
    return await res.json();
  }

  /**
   * @description Delete an author in Wordpress
   * @param {Number} id - The id of the author to delete
   * @returns
   */
  async deleteAuthor(id){
    const url = `${this.apiUrl}/users/${id}`;
    logger.info(`Deleting author: ${id}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.addAuthHeader()
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error deleting author: ${text}`);
    }
    logger.info(`Deleted author: ${id}`);
    return await res.json();
  }

  /**
   * @description Delete a media item in Wordpress
   * @param {Number} id - The id of the media item to delete
   * @returns
   */
  async deleteMedia(id){
    const url = `${this.apiUrl}/media/${id}`;
    logger.info(`Deleting media: ${id}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.addAuthHeader()
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error deleting media: ${text}`);
    }
    logger.info(`Deleted media: ${id}`);
    return await res.json();
  }

  /**
   * @description Delete a news post in Wordpress
   * @param {Number} id - The id of the news post to delete
   * @returns
   */
  async deleteNews(id){
    const url = `${this.apiUrl}/posts/${id}`;
    logger.info(`Deleting wordpress news post: ${id}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.addAuthHeader()
    });

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${response.status} Error deleting wordpress news post: ${text}`);
    }
    logger.info(`Deleted wordpress news post: ${id}`);
    return await res.json();
  }

  /**
   * @description Add Application Password credentials to the headers
   * @param {Object} headers - The headers to add the credentials to
   * @returns
   */
  addAuthHeader(headers={}){
    return {
      ...headers,
      'Authorization': 'Basic '+ btoa(config.wp.username+':'+config.wp.password)
    };
  }
}

export default new Wp();
