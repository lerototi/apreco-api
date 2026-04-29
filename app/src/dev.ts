// IMPORTANTE: carregar .env antes de qualquer outro import (firebase-admin lê as vars no require)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import app from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log(`[apreco-api] servidor rodando em http://localhost:${PORT}`);
  console.log(`[apreco-api] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'NÃO DEFINIDO'}`);
});
