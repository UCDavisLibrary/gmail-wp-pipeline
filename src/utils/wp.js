import config from './config.js';
import fetch from 'node-fetch';

class Wp {

  constructor(){
    this.apiUrl = `${config.wp.url}/wp-json/wp/v2`;
  }

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

  addAuthHeader(headers={}){
    return {
      ...headers,
      'Authorization': 'Basic '+ btoa(config.wp.username+':'+config.wp.password)
    };
  }
}

export default new Wp();
