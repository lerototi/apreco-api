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
 * Leitura por destinatário:
 *   - `readBy: string[]` — chaves compostas `uid:role` de quem já leu esta mensagem.
 *     Ex: `["uid123:establishment", "uid456:ruralProducer"]`
 *   - Chaves compostas permitem que o mesmo Firebase UID atue como estabelecimento
 *     e produtor simultaneamente (útil em testes e contas multi-perfil).
 *   - Uma mensagem é não lida para `uid+role` se `"uid:role"` NÃO está em `readBy`.
 *   - Ao enviar, o remetente é incluído em `readBy` com sua role.
 *   - `markAllAsRead(offerId, uid, role)` faz arrayUnion(`uid:role`) nas não lidas.
 */

import { db, admin } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Contador desnormalizado de mensagens não lidas por uid:role.
 * Coleção raiz: unreadCounters/{uid}:{role}
 * Ex: documento "uid123:establishment" → { total: 3, updatedAt: "..." }
 *
 * Mantido sincronizado pelo backend (Admin SDK) — nunca escrito pelo cliente.
 * O cliente abre onSnapshot neste documento para receber o badge em real-time
 * sem precisar de polling.
 */
export interface UnreadCounter {
    uid: string;
    role: 'establishment' | 'ruralProducer';
    total: number;
    updatedAt: string;
}

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

    /**
     * Chaves compostas `uid:role` de quem já leu esta mensagem.
     * Ex: `["uid123:establishment", "uid456:ruralProducer"]`
     * Uma mensagem é não lida para `uid+role` se `"uid:role"` NÃO está neste array.
     */
    readBy: string[];

    /**
     * UIDs dos dois participantes da conversa: [producerUid, establishmentUid].
     * Desnormalizado para permitir Security Rules no cliente Firestore sem joins.
     * Necessário para o onSnapshot do chat funcionar com as rules corretas.
     */
    participantUids: string[];

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

function unreadCountersCol() {
    return db.collection('unreadCounters');
}

// ─── unreadCounters helpers ───────────────────────────────────────────────────

/**
 * Incrementa o contador global de não lidas para uid+role em +delta.
 * Usado ao criar mensagem — cada destinatário recebe +1.
 */
export async function incrementUnreadCounter(
    uid: string,
    role: 'establishment' | 'ruralProducer',
    delta = 1,
): Promise<void> {
    const docId = `${uid}:${role}`;
    await unreadCountersCol().doc(docId).set({
        uid,
        role,
        total: admin.firestore.FieldValue.increment(delta),
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}

/**
 * Recalcula e persiste o total de não lidas para uid+role somando todas as offers.
 * Chamado após markAllAsRead para garantir consistência.
 * Recebe a lista de offerId do usuário para evitar query extra.
 */
export async function recalcTotalUnreadCounter(
    uid: string,
    role: 'establishment' | 'ruralProducer',
    offerIds: string[],
): Promise<void> {
    let total = 0;
    await Promise.all(
        offerIds.map(async (offerId) => {
            const count = await countUnreadForOffer(offerId, uid, role);
            total += count;
        }),
    );
    const docId = `${uid}:${role}`;
    await unreadCountersCol().doc(docId).set({
        uid,
        role,
        total,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
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
 * Conta mensagens não lidas para um uid+role em uma oferta específica.
 * "Não lida" = `uid:role` NÃO está no array readBy da mensagem.
 * Mensagens enviadas pelo próprio uid com a mesma role nunca contam.
 */
export async function countUnreadForOffer(
    offerId: string,
    uid: string,
    role: 'establishment' | 'ruralProducer',
): Promise<number> {
    const key = `${uid}:${role}`;
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .get();
    let count = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        // Não conta mensagens enviadas pelo próprio uid com a mesma role
        if (data.senderUid === uid && data.authorRole === role) continue;
        const readBy: string[] = data.readBy ?? [];
        if (!readBy.includes(key)) count++;
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

/**
 * Cria uma mensagem de sistema (evento de status).
 * authorRole = 'system'; senderUid = 'system'.
 * `initialReadBy` deve conter as chaves uid:role de quem disparou a ação.
 * `participantUids` deve ter [producerUid, establishmentUid] — necessário para Security Rules.
 * `unreadRecipients` lista os uid+role que devem ter o contador incrementado.
 */
export async function createSystemMessage(
    offerId: string,
    demandId: string | null,
    text: string,
    initialReadBy: string[] = [],
    participantUids: string[] = [],
    unreadRecipients: Array<{ uid: string; role: 'establishment' | 'ruralProducer' }> = [],
): Promise<ChatMessage> {
    return createMessage(offerId, demandId, 'system', 'Sistema', 'system', text, initialReadBy, participantUids, unreadRecipients);
}

export async function createMessage(
    offerId: string,
    demandId: string | null,
    senderUid: string,
    senderName: string,
    authorRole: MessageAuthorRole,
    text: string,
    initialReadBy: string[] = [],
    participantUids: string[] = [],
    unreadRecipients: Array<{ uid: string; role: 'establishment' | 'ruralProducer' }> = [],
): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const ref = messagesCol().doc();
    // O remetente sempre está em readBy com sua role (ele não precisa de notificação própria).
    // Para 'system', nenhuma chave automática — o chamador controla via initialReadBy.
    const readBySet = new Set<string>(initialReadBy);
    if (senderUid !== 'system') readBySet.add(`${senderUid}:${authorRole}`);

    const msg: ChatMessage = {
        id:             ref.id,
        senderUid,
        authorRole,
        senderName,
        offerId,
        demandId,
        productId:      null,
        text:           text.trim(),
        readBy:         Array.from(readBySet),
        participantUids,
        createdAt:      now,
    };
    await ref.set(msg);

    // Incrementa o contador de não lidas para cada destinatário explícito.
    if (unreadRecipients.length > 0) {
        await Promise.all(
            unreadRecipients.map(({ uid, role }) => incrementUnreadCounter(uid, role)),
        );
    }

    return msg;
}

/**
 * Marca todas as mensagens de uma oferta como lidas para uid+role.
 * Usa arrayUnion para adicionar `uid:role` a readBy sem sobrescrever leituras de outros.
 * Só atualiza mensagens onde `uid:role` ainda não está em readBy.
 * Se `allOfferIds` for fornecido, recalcula o contador global de não lidas após marcar.
 */
export async function markAllAsRead(
    offerId: string,
    uid: string,
    role: 'establishment' | 'ruralProducer',
    allOfferIds?: string[],
): Promise<void> {
    const key = `${uid}:${role}`;
    const snap = await messagesCol()
        .where('offerId', '==', offerId)
        .get();
    if (snap.empty) {
        if (allOfferIds) await recalcTotalUnreadCounter(uid, role, allOfferIds);
        return;
    }

    const updates: Promise<void>[] = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        // Pula mensagens enviadas pelo próprio uid com a mesma role
        if (data.senderUid === uid && data.authorRole === role) continue;
        const readBy: string[] = data.readBy ?? [];
        if (!readBy.includes(key)) {
            updates.push(
                messagesCol().doc(doc.id).update({
                    readBy: admin.firestore.FieldValue.arrayUnion(key),
                }).then(() => {}),
            );
        }
    }
    await Promise.all(updates);

    // Recalcula o contador global após marcar (garante consistência)
    if (allOfferIds) {
        await recalcTotalUnreadCounter(uid, role, allOfferIds);
    }
}
