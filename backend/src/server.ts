import { createApp } from './app.js';
import { db } from './db/client.js';
import { env } from './lib/env.js';

const app = createApp(db);

app.listen(env.port, () => {
  console.log(`CreatorsPro API rodando em http://localhost:${env.port}`);
});
