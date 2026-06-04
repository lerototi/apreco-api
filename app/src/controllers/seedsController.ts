/**
 * seedsController — Banco de Sementes (moeda social da plataforma Apreço).
 *
 * Rotas (prefixo /seeds, montado em server.ts):
 *   GET  /seeds/balance       → saldo atual do usuário autenticado
 *   GET  /seeds/transactions  → extrato (últimas 50 transações)
 */

import { Request, Response } from 'express';
import { getWallet, listTransactions } from '../models/seeds';

/**
 * GET /seeds/balance
 * Retorna o saldo atual de sementes do usuário autenticado.
 */
export async function getBalance(req: Request, res: Response): Promise<void> {
    try {
        const wallet = await getWallet(req.user.uid);
        res.json({ wallet });
    } catch (e) {
        console.error('[seeds.getBalance] error:', e);
        res.status(500).json({ error: 'Erro ao buscar saldo.' });
    }
}

/**
 * GET /seeds/transactions
 * Retorna o extrato de transações do usuário autenticado.
 * Query param: ?limit=50 (padrão: 50, máx: 100)
 */
export async function getTransactions(req: Request, res: Response): Promise<void> {
    try {
        const rawLimit = Number(req.query['limit']);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
        const transactions = await listTransactions(req.user.uid, limit);
        res.json({ transactions });
    } catch (e) {
        console.error('[seeds.getTransactions] error:', e);
        res.status(500).json({ error: 'Erro ao buscar extrato.' });
    }
}
