/**
 * seedsRoutes — rotas do Banco de Sementes.
 *
 * Prefixo: /seeds  (montado em server.ts)
 * Auth:    todas as rotas exigem token Firebase válido.
 *
 *   GET  /seeds/balance       → saldo atual
 *   GET  /seeds/transactions  → extrato (últimas N transações)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as seedsController from '../controllers/seedsController';

const router = Router();

router.get('/balance',      authenticate, seedsController.getBalance);
router.get('/transactions', authenticate, seedsController.getTransactions);

export default router;
