/**
 * Testes unitários — src/models/seeds.ts
 *
 * Cobre:
 *  - getWallet: cria carteira nova com saldo 0
 *  - getWallet: retorna carteira existente
 *  - creditSeeds: credita sementes e incrementa saldo
 *  - creditSeeds: idempotência — não credita duas vezes com mesma chave
 *  - listTransactions: retorna transações do usuário
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
    getWallet,
    creditSeeds,
    listTransactions,
    SEED_REWARDS,
} from '../../models/seeds';

beforeEach(() => {
    firestoreStore.clear();
});

// ─── getWallet ────────────────────────────────────────────────────────────────

describe('getWallet', () => {
    it('cria carteira com saldo 0 quando não existe', async () => {
        const wallet = await getWallet('uid-001');
        expect(wallet.uid).toBe('uid-001');
        expect(wallet.balance).toBe(0);
    });

    it('retorna carteira existente', async () => {
        firestoreStore.set('seedWallets/uid-002', { uid: 'uid-002', balance: 150, updatedAt: '2024-01-01T00:00:00.000Z' });
        const wallet = await getWallet('uid-002');
        expect(wallet.balance).toBe(150);
    });
});

// ─── creditSeeds ──────────────────────────────────────────────────────────────

describe('creditSeeds', () => {
    it('credita sementes e incrementa saldo', async () => {
        const tx = await creditSeeds({
            uid: 'uid-producer',
            amount: SEED_REWARDS.PRODUCER_DELIVERY_CREDIT,
            reason: 'producer_delivery',
            description: 'Entrega confirmada — Tomate',
            deliveryId: 'delivery-001',
            offerId: 'offer-001',
        });

        expect(tx).not.toBeNull();
        expect(tx!.amount).toBe(SEED_REWARDS.PRODUCER_DELIVERY_CREDIT);
        expect(tx!.type).toBe('credit');
        expect(tx!.reason).toBe('producer_delivery');
        expect(tx!.deliveryId).toBe('delivery-001');

        const wallet = await getWallet('uid-producer');
        expect(wallet.balance).toBe(SEED_REWARDS.PRODUCER_DELIVERY_CREDIT);
    });

    it('acumula saldo corretamente em múltiplos créditos', async () => {
        await creditSeeds({ uid: 'uid-e', amount: 20, reason: 'establishment_confirm', description: 'A' });
        await creditSeeds({ uid: 'uid-e', amount: 20, reason: 'establishment_confirm', description: 'B' });

        const wallet = await getWallet('uid-e');
        expect(wallet.balance).toBe(40);
    });

    it('respeita idempotência: não duplica crédito com mesma chave', async () => {
        const key = 'delivery-999:producer_delivery';

        const first = await creditSeeds({
            uid: 'uid-idp',
            amount: 30,
            reason: 'producer_delivery',
            description: 'Entrega A',
            idempotencyKey: key,
        });
        const second = await creditSeeds({
            uid: 'uid-idp',
            amount: 30,
            reason: 'producer_delivery',
            description: 'Entrega A',
            idempotencyKey: key,
        });

        expect(first).not.toBeNull();
        expect(second).toBeNull(); // idempotente — ignorado

        const wallet = await getWallet('uid-idp');
        expect(wallet.balance).toBe(30); // só creditado uma vez
    });
});

// ─── listTransactions ─────────────────────────────────────────────────────────

describe('listTransactions', () => {
    it('retorna lista vazia quando não há transações', async () => {
        const txs = await listTransactions('uid-novo');
        expect(txs).toEqual([]);
    });

    it('retorna transações do usuário', async () => {
        // Inserir diretamente no store fake
        firestoreStore.set('seedTransactions/tx-001', {
            uid: 'uid-list',
            type: 'credit',
            amount: 30,
            reason: 'producer_delivery',
            description: 'Entrega A',
            createdAt: '2024-06-01T00:00:00.000Z',
        });
        firestoreStore.set('seedTransactions/tx-002', {
            uid: 'uid-list',
            type: 'credit',
            amount: 20,
            reason: 'establishment_confirm',
            description: 'Confirmação B',
            createdAt: '2024-06-02T00:00:00.000Z',
        });
        // Transação de outro usuário — não deve aparecer
        firestoreStore.set('seedTransactions/tx-003', {
            uid: 'uid-outro',
            type: 'credit',
            amount: 10,
            reason: 'producer_delivery',
            description: 'Outra',
            createdAt: '2024-06-03T00:00:00.000Z',
        });

        const txs = await listTransactions('uid-list');
        expect(txs).toHaveLength(2);
        const uids = txs.map(t => t.uid);
        expect(uids.every(u => u === 'uid-list')).toBe(true);
    });
});

// ─── SEED_REWARDS ──────────────────────────────────────────────────────────────

describe('SEED_REWARDS', () => {
    it('tem valores positivos configurados', () => {
        expect(SEED_REWARDS.PRODUCER_DELIVERY_CREDIT).toBeGreaterThan(0);
        expect(SEED_REWARDS.ESTABLISHMENT_CONFIRM_CREDIT).toBeGreaterThan(0);
    });
});
