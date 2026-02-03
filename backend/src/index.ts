import dotenv from 'dotenv';
import { createApp } from './app';
import { config } from './services/config';

dotenv.config();

const app = createApp();

app.listen(config.port, () => {
  console.log(`⚡️ Server is running at http://localhost:${config.port}`);
});
