/**
 * dev-tunnel.ts
 * Inicia o servidor Express + ngrok e atualiza automaticamente
 * o APRECO_API_LOCAL_URL no .env do frontend (apreco).
 */
// IMPORTANTE: carregar .env antes de qualquer outro import (firebase-admin lê as vars no require)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { exec, ChildProcess } from 'child_process';
import app from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const FRONTEND_ENV = path.resolve(__dirname, '../../../apreco/.env');

// ─── Inicia o servidor Express ───────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`[apreco-api] servidor rodando em http://localhost:${PORT}`);
    console.log(`[apreco-api] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'NÃO DEFINIDO'}`);
    startNgrok();
});

// ─── Inicia o ngrok ───────────────────────────────────────────────────────────
let tunnelUrlUpdated = false;

function startNgrok(): void {
    console.log('[ngrok] iniciando tunnel...');

    const ngrok: ChildProcess = exec(`ngrok http ${PORT} --log=stdout`);

    ngrok.stdout?.on('data', (data: string) => {
        const match = data.match(/url=(https:\/\/[a-z0-9-]+\.ngrok[-\w.]*\.app)/i)
            ?? data.match(/url=(https:\/\/[a-z0-9-]+\.ngrok\.io)/i)
            ?? data.match(/url=(https:\/\/[a-z0-9-]+\.ngrok-free\.dev)/i);

        if (match && !tunnelUrlUpdated) {
            tunnelUrlUpdated = true;
            const tunnelUrl = match[1];
            console.log(`[ngrok] tunnel ativo: ${tunnelUrl}`);
            updateFrontendEnv(tunnelUrl);
        }
    });

    ngrok.stderr?.on('data', (data: string) => {
        if (!data.includes('lvl=info')) {
            console.error('[ngrok] erro:', data.trim());
        }
    });

    ngrok.on('exit', (code) => {
        console.warn(`[ngrok] processo encerrado (code ${code})`);
        server.close();
        process.exit(0);
    });

    // Fallback: busca URL via API local do ngrok
    setTimeout(() => fetchNgrokUrl(), 3000);
}

// ─── Fallback: busca URL via API local do ngrok ───────────────────────────────
function fetchNgrokUrl(retries = 10): void {
    if (tunnelUrlUpdated) return;
    http.get('http://localhost:4040/api/tunnels', (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                const data = JSON.parse(body);
                const tunnel = data.tunnels?.find((t: { proto: string }) => t.proto === 'https');
                if (tunnel) {
                    const tunnelUrl: string = tunnel.public_url;
                    if (!tunnelUrlUpdated) {
                        tunnelUrlUpdated = true;
                        console.log(`[ngrok] tunnel ativo (via API): ${tunnelUrl}`);
                        updateFrontendEnv(tunnelUrl);
                    }
                } else if (retries > 0) {
                    setTimeout(() => fetchNgrokUrl(retries - 1), 1000);
                }
            } catch {
                if (retries > 0) setTimeout(() => fetchNgrokUrl(retries - 1), 1000);
            }
        });
    }).on('error', () => {
        if (retries > 0) setTimeout(() => fetchNgrokUrl(retries - 1), 1000);
    });
}

// ─── Atualiza .env do frontend ────────────────────────────────────────────────
function updateFrontendEnv(url: string): void {
    if (!fs.existsSync(FRONTEND_ENV)) {
        console.warn(`[env] arquivo não encontrado: ${FRONTEND_ENV}`);
        return;
    }

    const content = fs.readFileSync(FRONTEND_ENV, 'utf-8');
    const updated = content.replace(
        /^APRECO_API_LOCAL_URL=.*$/m,
        `APRECO_API_LOCAL_URL=${url}`
    );

    if (updated === content) {
        console.warn('[env] APRECO_API_LOCAL_URL não encontrado no .env — adicione manualmente:', url);
        return;
    }

    fs.writeFileSync(FRONTEND_ENV, updated, 'utf-8');
    console.log(`[env] APRECO_API_LOCAL_URL atualizado para: ${url}`);
    console.log('[env] Reinicie o Metro bundler (pressione "r" no Expo) para aplicar.');
}
