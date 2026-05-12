/**
 * Modelo de Mensagem de Chat (ChatMessage).
 *
 * Coleção raiz no Firestore:
 *   chatMessages/{messageId}
 *
 * Estrutura normalizada — todas as mensagens em uma única coleção raiz,
 * vinculadas por chaves de referência:
 *   - offerId   → chat entre estabelecimento e produtor (sobre uma oferta)
 *   - productId → futuro: chat entre consumidor e produtor (sobre um produto)
 *
 * Acesso:
 *   - Carregar chat por oferta: where('offerId', '==', offerId)
 *   - Não lidas: where('offerId', '==', oid).where('senderUid', '!=', meuUid).where('read', '==', false)
 *   - Lista de threads: where('offerId', 'in', [lista de offerIds])
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type MessageAuthorRole = 'establishment' | 'ruralProducer' | 'consumer' | 'system';

export interface ChatMessage {
    id: string;

    /** UID de quem enviou a mensagem */
    senderUid: string;
    /** Role de quem enviou — para exibição visual das bolhas */
    authorRole: MessageAuthorRole;
    /** Nome de exibição do remetente (snapshot no momento do envio) */
    senderName: string;

    /** Referência à oferta (chat estabelecimento↔produtor) */
    offerId: string | null;
    /** Desnormalizado da oferta — facilita listagem de threads por demanda */
    demandId: string | null;

    /** Reservado: futuro chat consumidor↔produtor */
    productId: string | null;

    text: string;

    /** false = não lida pelo destinatário; true = já leu */
    read: boolean;

    createdAt: string;
}

export interface ChatThread {
    offerId: string;
    demandId: string | null;
    demandProductName: string;
    otherPartyName: string;
    otherPartyRole: MessageAuthorRole;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    offerStatus: string;
}

// ─── Coleção ──────────────────────────────────────────────────────────────────

function messagesCol() {
    return db.collection('chatMessages');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listMessagesByOffer(offerId: string): Promise<ChatMessage[]> {
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .orderBy('createdAt', 'asc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
}

/**
 * Conta mensagens não lidas para um UID em uma oferta específica.
 * "Não lida" = remetente não é o UID e read == false.
 */
export async function countUnreadForOffer(
    offerId: string,
    uid: string,
): Promise<number> {
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .where('read', '==', false)
        .get();
    // Filtra apenas as mensagens enviadas por outra pessoa
    let count = 0;
    for (const doc of snap.docs) {
        if (doc.data().senderUid !== uid) count++;
    }
    return count;
}

/**
 * Retorna a última mensagem de uma oferta.
 */
export async function getLastMessageForOffer(
    offerId: string,
): Promise<ChatMessage | null> {
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ChatMessage;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Cria uma mensagem de sistema (evento de status) sem remetente humano.
 * authorRole = 'system'; senderUid = 'system'; read = true (não gera notificação).
 */
export async function createSystemMessage(
    offerId: string,
    demandId: string | null,
    text: string,
): Promise<ChatMessage> {
    return createMessage(offerId, demandId, 'system', 'Sistema', 'system', text, true);
}

export async function createMessage(
    offerId: string,
    demandId: string | null,
    senderUid: string,
    senderName: string,
    authorRole: MessageAuthorRole,
    text: string,
    alreadyRead = false,
): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const ref = messagesCol().doc();
    const msg: ChatMessage = {
        id:         ref.id,
        senderUid,
        authorRole,
        senderName,
        offerId,
        demandId,
        productId:  null,
        text:       text.trim(),
        read:       alreadyRead,
        createdAt:  now,
    };
    await ref.set(msg);
    return msg;
}

/**
 * Marca todas as mensagens de uma oferta como lidas para um UID.
 * Só atualiza mensagens enviadas por outra pessoa (não as próprias).
 */
export async function markAllAsRead(
    offerId: string,
    uid: string,
): Promise<void> {
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .where('read', '==', false)
        .get();
    if (snap.empty) return;

    const updates: Promise<void>[] = [];
    for (const doc of snap.docs) {
        if (doc.data().senderUid !== uid) {
            updates.push(
                messagesCol().doc(doc.id).update({ read: true }).then(() => {}),
            );
        }
    }
    await Promise.all(updates);
}
