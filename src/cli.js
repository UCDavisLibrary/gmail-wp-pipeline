import { Command } from 'commander';
import config from './utils/config.js';
import fetch from 'node-fetch';

const program = new Command();
program
  .name(config.appName)
  .description('CLI for operating gmail to wordpress pipeline')
  .version(config.version);

program.command('authorize-gmail')
  .description('Will kick off the authorization process accessing gmail. Should only be used if refresh token in env file is invalidated.')
  .action(async () => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/gmail/authorize`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error in authorize-gmail command: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.parse();
