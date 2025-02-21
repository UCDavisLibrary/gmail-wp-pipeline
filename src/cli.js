import { Command } from 'commander';
import config from './utils/config.js';
import fetch from 'node-fetch';

const program = new Command();
program
  .name(config.appName)
  .description('CLI for operating gmail to wordpress pipeline')
  .version(config.version);

program.command('start')
  .description('Start the cron task creating wordpress posts from gmail messages')
  .action(async () => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/start`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error starting task: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.command('stop')
  .description('Stop/pause the cron task creating wordpress posts from gmail messages')
  .action(async () => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/stop`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error stopping task: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.command('status')
  .description('Get the status of cron task creating wordpress posts from gmail messages')
  .action(async () => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/status`);
      if ( !response.ok ) {
        throw new Error(`Error getting status: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.command('run')
  .description('Run the task immediately')
  .option('-w, --wait', 'Wait for the task to complete before giving a response')
  .option('-t --timeout <timeout>', 'Timeout in milliseconds for the task to complete. Default is 10 minutes.')
  .action(async (opts) => {
    try {
      const urlParams = new URLSearchParams();
      if ( opts.wait ) {
        urlParams.append('wait', true);
      }
      if ( opts.timeout ) {
        urlParams.append('timeout', opts.timeout);
      }
      const response = await fetch(`http://localhost:${config.serverPort}/run?${urlParams.toString()}`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error running task: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log(data);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.command('authorize-gmail')
  .description('Will kick off the authorization process accessing gmail. Should only be used if refresh token in env file is invalidated.')
  .action(async () => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/gmail/authorize`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error in authorize-gmail command: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if ( data.error ) {
        return console.error(data);
      }
      console.log(`Authorization Link: ${data.authUrl}`);
      console.log('Gmail Account', config.gmail.account);
      console.log('Gmail Password', config.gmail.password);
      console.log('Please visit the authorization link and copy the code in the redirect URL.');
      console.log('Then run the command: get-gmail-refresh-token <code>');
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.command('get-gmail-refresh-token')
  .description('Exchanges oauth code for refresh token, which should then be added to the env file.')
  .argument('<code>', 'The code retrieved from the redirect URL after visiting the authorization link produced by authorize-gmail command.')
  .action(async (code) => {
    try {
      const response = await fetch(`http://localhost:${config.serverPort}/gmail/refresh-token?code=${code}`, { method: 'POST' });
      if ( !response.ok ) {
        throw new Error(`Error in get-gmail-refresh-token command: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if ( data.error ) {
        return console.error(data);
      }
      console.log('Refresh Token:', data.refreshToken);
    }
    catch (err) {
      console.error(err);
    }
  }
);

program.parse();
