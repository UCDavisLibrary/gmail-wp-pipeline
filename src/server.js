import express from 'express';
import config from './utils/config.js';
import logger from './utils/logger.js';
import gmail from './utils/gmail.js';
import task from './utils/task.js';

const app = express();

if ( !config.cron.idleAtStartup ){
  task.start();
}

app.get('/status' , (req, res) => {
  res.json({
    status: task.status
  });
});

app.post('/start', (req, res) => {
  return res.json(task.start());
});

app.post('/stop', (req, res) => {
  return res.json(task.stop());
});

app.post('/run', async (req, res) => {
  let input = Object.assign({}, req.query, req.body);
  let result = await task.run(input);
  return res.json(result);
});

app.post('/gmail/authorize', (req, res) => {
  try {
    const authUrl = gmail.generateAuthUrl();
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.post('/gmail/refresh-token', async (req, res) => {
  try {
    const { code } = Object.assign({}, req.query, req.body);
    const refreshToken = await gmail.getRefreshToken(code);
    res.json({ refreshToken });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});


app.listen(config.serverPort, () => {
  logger.info(`Server listening on port ${config.serverPort}`);
});
