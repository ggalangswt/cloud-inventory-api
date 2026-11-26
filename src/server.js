import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createDatabasePool } from './config/database.js';

dotenv.config({ quiet: true });

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const app = createApp(createDatabasePool());

app.listen(port, host, () => {
  console.log(`Inventory API listening on ${host}:${port}`);
});
