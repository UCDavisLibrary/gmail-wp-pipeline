import config from './config.js';
import logger from './logger.js';
import fetch from 'node-fetch';

/**
 * @description Class interacting with the Library IAM API
 */
class UclibIam {

  /**
   * @description Add the basic auth header to the headers
   * @param {Object} headers
   * @returns {Object}
   */
  addAuthHeader(headers={}){
    const auth = Buffer.from(`${config.ucdlibIamApi.username}:${config.ucdlibIamApi.password}`).toString('base64');
    return {
      ...headers,
      'Authorization': `Basic ${auth}`
    };
  }

  /**
   * @description Get an employee by email
   * @param {String} email - The email address of the employee
   * @returns {Object} - The employee object or null if not found
   */
  async getEmployeeByEmail(email){
    const url = `${config.ucdlibIamApi.url}/employees/${email}?id-type=email`;
    logger.info('Searching Library IAM for user by email', {data: {url, email}});

    const res = await fetch(url, {
      headers: this.addAuthHeader({'Content-Type': 'application/json'})
    });

    if (!res.ok && res.status == 404) {
      logger.info('No user found in Library IAM by specified email', {data: {url, email}});
      return null;
    }

    if ( !res.ok ){
      const text = await res.text() || '';
      throw new Error(`${res.status} Error searching for user by email: ${text}`);
    }
    const data = await res.json();
    logger.info('User found in Library IAM by specified email', {data: {url, email, firstName: data.first_name, lastName: data.last_name}});
    return data;
  }
}

export default new UclibIam();
