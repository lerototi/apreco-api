/**
 * Model: Banco de Sementes — moeda social da plataforma Apreço.
 *
 * Coleções Firestore:
 *   seedWallets/{uid}           → saldo atual de cada usuário
 *   seedTransactions/{txId}     → histórico de créditos e débitos
 *
 * Regras de crédito automático (produção):
 *   PRODUCER_DELIVERY_CREDIT    → produtor ganha ao entregar (status shipped ou confirm)
 *   ESTABLISHMENT_CONFIRM_CREDIT → estabelecimento ganha ao confirmar recebimento
 *
 * Design:
 *   - Nunca decrementa diretamente — cada débito é uma transação negativa
 *   - O saldo em seedWallets/{uid}.balance é a soma de todas as transações
 *     (desnormalizado para leitura rápida)
 *   - Todos os créditos de negociação são idempotentes por deliveryId + reason
 */

import { db, admin } from '../config/firebase';

const { FieldValue } = admin.firestore;

// ─── Configuração de pontuação ────────────────────────────────────────────────
// Ajuste aqui sem tocar na lógica.

export const SEED_REWARDS = {
    /** Produtor confirma que saiu para entregar */
    PRODUCER_DELIVERY_CREDIT: 30,
    /** Estabelecimento confirma recebimento */
    ESTABLISHMENT_CONFIRM_CREDIT: 20,
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SeedTransactionReason =
    | 'producer_delivery'       // produtor entregou
    | 'establishment_confirm'   // estabelecimento confirmou
    | 'manual_credit'           // crédito manual (admin)
    | 'manual_debit'            // débito manual (admin)
    | 'reward_redemption';      // resgate de recompensa

export type SeedTransactionType = 'credit' | 'debit';

export interface SeedWallet {
    uid: string;
    balance: number;
    updatedAt: string; // ISO
}

export interface SeedTransaction {
    id: string;
    uid: string;
    type: SeedTransactionType;
    amount: number;
    reason: SeedTransactionReason;
    /** Referência opcional à entrega que originou a transação */
    deliveryId?: string;
    /** Referência opcional à oferta que originou a transação */
    offerId?: string;
    /** Descrição legível para exibição no extrato */
    description: string;
    createdAt: string; // ISO
}

// ─── Funções de leitura ───────────────────────────────────────────────────────

/**
 * Retorna o saldo atual do usuário.
 * Cria o documento com saldo 0 se ainda não existir.
 */
export async function getWallet(uid: string): Promise<SeedWallet> {
    const ref = db.collection('seedWallets').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
        const data = snap.data()!;
        return {
            uid,
            balance: typeof data['balance'] === 'number' ? data['balance'] : 0,
            updatedAt: data['updatedAt'] ?? new Date().toISOString(),
        };
    }
    const wallet: SeedWallet = { uid, balance: 0, updatedAt: new Date().toISOString() };
    await ref.set(wallet);
    return wallet;
}

/**
 * Lista as últimas transações do usuário, ordenadas pela mais recente.
 * @param uid  UID do usuário
 * @param limit número máximo de resultados (padrão: 50)
 */
export async function listTransactions(uid: string, limit = 50): Promise<SeedTransaction[]> {
    const snap = await db
        .collection('seedTransactions')
        .where('uid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    return snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            uid: d['uid'] as string,
            type: d['type'] as SeedTransactionType,
            amount: d['amount'] as number,
            reason: d['reason'] as SeedTransactionReason,
            deliveryId: d['deliveryId'] as string | undefined,
            offerId: d['offerId'] as string | undefined,
            description: d['description'] as string,
            createdAt: d['createdAt'] as string,
        };
    });
}

// ─── Funções de escrita ───────────────────────────────────────────────────────

export interface CreditSeedsInput {
    uid: string;
    amount: number;
    reason: SeedTransactionReason;
    description: string;
    deliveryId?: string;
    offerId?: string;
    /**
     * Chave de idempotência: se já existe uma transação com esta chave,
     * o crédito NÃO é duplicado. Use `${deliveryId}:${reason}`.
     */
    idempotencyKey?: string;
}

/**
 * Credita sementes na carteira de um usuário.
 * Operação atômica: incrementa balance e cria transação em uma batch.
 * Retorna null se a transação já foi aplicada (idempotência).
 */
export async function creditSeeds(input: CreditSeedsInput): Promise<SeedTransaction | null> {
    const { uid, amount, reason, description, deliveryId, offerId, idempotencyKey } = input;

    // Verificação de idempotência
    if (idempotencyKey) {
        const existing = await db
            .collection('seedTransactions')
            .where('uid', '==', uid)
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();
        if (!existing.empty) return null; // já creditado
    }

    const now = new Date().toISOString();
    const txRef = db.collection('seedTransactions').doc();
    const walletRef = db.collection('seedWallets').doc(uid);

    const transaction: Omit<SeedTransaction, 'id'> & { idempotencyKey?: string } = {
        uid,
        type: 'credit',
        amount,
        reason,
        description,
        createdAt: now,
        ...(deliveryId ? { deliveryId } : {}),
        ...(offerId ? { offerId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    const batch = db.batch();
    batch.set(txRef, transaction);
    batch.set(
        walletRef,
        { uid, balance: FieldValue.increment(amount), updatedAt: now },
        { merge: true },
    );
    await batch.commit();

    return { id: txRef.id, ...transaction };
}
