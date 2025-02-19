import express from 'express';
import config from './utils/config.js';
import logger from './utils/logger.js';

const app = express();

app.post('/gmail/authorize', (req, res) => {
  return res.json({ message: 'Not implemented' });
});

app.listen(config.serverPort, () => {
  logger.info(`Server listening on port ${config.serverPort}`);
});
