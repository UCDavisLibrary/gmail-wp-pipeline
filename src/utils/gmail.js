import config from "./config.js";
import { google } from "googleapis";

class Gmail {

  generateAuthUrl() {
    const oAuth2Client = new google.auth.OAuth2(
      config.gc.oauthClientId,
      config.gc.oauthClientSecret,
      'http://localhost'
    );
    return oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ['https://www.googleapis.com/auth/gmail.modify']
    });
  }

}

export default new Gmail();
