/**
 * deliveryController — gerencia o ciclo de vida de entregas.
 *
 * Uma entrega é criada automaticamente quando uma oferta é aceita.
 *
 * Ciclo de vida:
 *   pending   → oferta aceita; produtor agenda a entrega (scheduledDeliveryAt)
 *   shipped   → produtor marcou "saí para entregar" (opcional)
 *   delivered → estabelecimento confirmou o recebimento ✅
 *   disputed  → estabelecimento abriu disputa ⚠️
 *   cancelled → entrega cancelada por qualquer das partes
 *
 * Rotas do produtor (/marketplace):
 *   GET  /marketplace/deliveries                            → lista próprias entregas
 *   GET  /marketplace/deliveries/by-offer/:offerId          → por oferta
 *   GET  /marketplace/deliveries/:deliveryId                → detalhe
 *   POST /marketplace/deliveries/:deliveryId/schedule       → agenda (pending, campos fixos)
 *   POST /marketplace/deliveries/:deliveryId/ship           → "saí para entregar" (pending → shipped)
 *   POST /marketplace/deliveries/:deliveryId/cancel         → cancela (pending → cancelled)
 *
 * Rotas do estabelecimento (/establishment):
 *   GET  /establishment/deliveries                          → lista entregas do estabelecimento
 *   GET  /establishment/deliveries/by-offer/:offerId        → por oferta
 *   GET  /establishment/deliveries/:deliveryId              → detalhe
 *   POST /establishment/deliveries/:deliveryId/confirm      → confirma recebimento (pending|shipped → delivered)
 *   POST /establishment/deliveries/:deliveryId/dispute      → abre disputa (pending|shipped → disputed)
 *   POST /establishment/deliveries/:deliveryId/cancel       → cancela (disputed → cancelled)
 */

import { Request, Response } from 'express';
import {
    findDelivery,
    findDeliveryByOffer,
    listDeliveriesByProducer,
    listDeliveriesByEstablishment,
    scheduleDelivery,
    markDeliveryShipped,
    confirmDelivery,
    disputeDelivery,
    cancelDelivery,
    buildScheduleInput,
    buildShipInput,
    buildConfirmInput,
    buildDisputeInput,
} from '../models/delivery';
import { createSystemMessage } from '../models/offerMessage';

// ─── Rotas do produtor ────────────────────────────────────────────────────────

/**
 * GET /marketplace/deliveries/by-offer/:offerId
 * Produtor obtém a entrega associada a uma oferta específica.
 */
export async function producerGetDeliveryByOffer(req: Request, res: Response): Promise<void> {
    try {
        const offerId = req.params['offerId'] as string;
        const delivery = await findDeliveryByOffer(offerId);

        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.producerUid !== req.user.uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        res.json({ delivery });
    } catch (e) {
        console.error('[delivery.producerGetDeliveryByOffer] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entrega.' });
    }
}

/**
 * GET /marketplace/deliveries
 * Produtor lista todas as suas entregas.
 */
export async function producerGetDeliveries(req: Request, res: Response): Promise<void> {
    try {
        const deliveries = await listDeliveriesByProducer(req.user.uid);
        res.json({ deliveries });
    } catch (e) {
        console.error('[delivery.producerGetDeliveries] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entregas.' });
    }
}

/**
 * GET /marketplace/deliveries/:deliveryId
 * Produtor obtém detalhe de uma entrega sua.
 */
export async function producerGetDelivery(req: Request, res: Response): Promise<void> {
    try {
        const deliveryId = req.params['deliveryId'] as string;
        const delivery = await findDelivery(deliveryId);

        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.producerUid !== req.user.uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        res.json({ delivery });
    } catch (e) {
        console.error('[delivery.producerGetDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entrega.' });
    }
}

/**
 * POST /marketplace/deliveries/:deliveryId/schedule
 * Produtor agenda a entrega: salva data/hora prevista e observações.
 * Status permanece 'pending'. Só pode ser feito uma vez (campos fixos após salvo).
 */
export async function producerScheduleDelivery(req: Request, res: Response): Promise<void> {
    try {
        const producerUid  = req.user.uid;
        const deliveryId   = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'pending') {
            res.status(409).json({ error: 'Agendamento só é permitido em entregas pendentes.' }); return;
        }
        if (delivery.scheduledDeliveryAt) {
            res.status(409).json({ error: 'A data de entrega já foi definida e não pode ser alterada.' }); return;
        }

        const input = buildScheduleInput(req.body as Record<string, unknown>);
        if (!input) {
            res.status(400).json({ error: 'Data/hora prevista da entrega é obrigatória.' }); return;
        }

        const updated = await scheduleDelivery(deliveryId, input);

        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            `📅 ${delivery.producerName} agendou a entrega de ${delivery.quantity} ${delivery.unit} de ${delivery.productName} para ${input.scheduledDeliveryAt}.${input.shippingNote ? `\nObs: ${input.shippingNote}` : ''}`,
            [`${producerUid}:ruralProducer`],
            [producerUid, delivery.establishmentUid],
            [{ uid: delivery.establishmentUid, role: 'establishment' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.producerScheduleDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao agendar entrega.' });
    }
}

/**
 * POST /marketplace/deliveries/:deliveryId/ship
 * Produtor marca "saí para entregar" (pending → shipped). Ação opcional.
 */
export async function producerShipDelivery(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const deliveryId = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'pending') {
            res.status(409).json({ error: 'Apenas entregas pendentes podem ser marcadas como enviadas.' }); return;
        }

        const input = buildShipInput(req.body as Record<string, unknown>);
        const updated = await markDeliveryShipped(deliveryId, input);

        const noteStr = input.shippingNote ? `\nObs: ${input.shippingNote}` : '';
        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            `🚚 ${delivery.producerName} saiu para entregar ${delivery.quantity} ${delivery.unit} de ${delivery.productName}.${noteStr}`,
            [`${producerUid}:ruralProducer`],
            [producerUid, delivery.establishmentUid],
            [{ uid: delivery.establishmentUid, role: 'establishment' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.producerShipDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao registrar envio.' });
    }
}

/**
 * POST /marketplace/deliveries/:deliveryId/cancel
 * Produtor cancela a entrega enquanto ainda está pendente.
 */
export async function producerCancelDelivery(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const deliveryId = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'pending') {
            res.status(409).json({ error: 'Somente entregas pendentes podem ser canceladas pelo produtor.' }); return;
        }

        const updated = await cancelDelivery(deliveryId);

        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            '⚠️ O produtor cancelou a entrega. Por favor, entre em contato para resolver.',
            [`${producerUid}:ruralProducer`],
            [producerUid, delivery.establishmentUid],
            [{ uid: delivery.establishmentUid, role: 'establishment' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.producerCancelDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao cancelar entrega.' });
    }
}

// ─── Rotas do estabelecimento ─────────────────────────────────────────────────

/**
 * GET /establishment/deliveries/by-offer/:offerId
 * Estabelecimento obtém a entrega associada a uma oferta específica.
 */
export async function estGetDeliveryByOffer(req: Request, res: Response): Promise<void> {
    try {
        const offerId = req.params['offerId'] as string;
        const delivery = await findDeliveryByOffer(offerId);

        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.establishmentUid !== req.user.uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        res.json({ delivery });
    } catch (e) {
        console.error('[delivery.estGetDeliveryByOffer] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entrega.' });
    }
}

/**
 * GET /establishment/deliveries
 * Estabelecimento lista todas as suas entregas.
 */
export async function estGetDeliveries(req: Request, res: Response): Promise<void> {
    try {
        const deliveries = await listDeliveriesByEstablishment(req.user.uid);
        res.json({ deliveries });
    } catch (e) {
        console.error('[delivery.estGetDeliveries] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entregas.' });
    }
}

/**
 * GET /establishment/deliveries/:deliveryId
 * Estabelecimento obtém detalhe de uma entrega.
 */
export async function estGetDelivery(req: Request, res: Response): Promise<void> {
    try {
        const deliveryId = req.params['deliveryId'] as string;
        const delivery = await findDelivery(deliveryId);

        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.establishmentUid !== req.user.uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        res.json({ delivery });
    } catch (e) {
        console.error('[delivery.estGetDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao buscar entrega.' });
    }
}

/**
 * POST /establishment/deliveries/:deliveryId/confirm
 * Estabelecimento confirma o recebimento da entrega (pending|shipped → delivered).
 * Body: { receivedQuantity: number, receptionNote?: string }
 */
export async function estConfirmDelivery(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const deliveryId = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'pending' && delivery.status !== 'shipped') {
            res.status(409).json({ error: 'Apenas entregas pendentes ou a caminho podem ser confirmadas.' }); return;
        }

        const input = buildConfirmInput(req.body as Record<string, unknown>);
        if (!input) {
            res.status(400).json({ error: 'receivedQuantity deve ser um número maior ou igual a zero.' }); return;
        }

        const updated = await confirmDelivery(deliveryId, input);

        const noteStr = input.receptionNote ? `\nObs: ${input.receptionNote}` : '';
        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            `✅ Entrega confirmada! Recebido: ${input.receivedQuantity} ${delivery.unit} de ${delivery.productName}.${noteStr}`,
            [`${uid}:establishment`],
            [uid, delivery.producerUid],
            [{ uid: delivery.producerUid, role: 'ruralProducer' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.estConfirmDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao confirmar entrega.' });
    }
}

/**
 * POST /establishment/deliveries/:deliveryId/dispute
 * Estabelecimento abre uma disputa sobre a entrega (pending|shipped → disputed).
 * Body: { receivedQuantity: number, receptionNote: string }
 */
export async function estDisputeDelivery(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const deliveryId = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'pending' && delivery.status !== 'shipped') {
            res.status(409).json({ error: 'Apenas entregas pendentes ou a caminho podem ter disputa aberta.' }); return;
        }

        const input = buildDisputeInput(req.body as Record<string, unknown>);
        if (!input) {
            res.status(400).json({ error: 'receivedQuantity e receptionNote (motivo) são obrigatórios para abertura de disputa.' }); return;
        }

        const updated = await disputeDelivery(deliveryId, input);

        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            `⚠️ O estabelecimento abriu uma disputa.\nRecebido: ${input.receivedQuantity} ${delivery.unit} (esperado: ${delivery.quantity} ${delivery.unit})\nMotivo: ${input.receptionNote}`,
            [`${uid}:establishment`],
            [uid, delivery.producerUid],
            [{ uid: delivery.producerUid, role: 'ruralProducer' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.estDisputeDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao abrir disputa.' });
    }
}

/**
 * POST /establishment/deliveries/:deliveryId/cancel
 * Estabelecimento cancela uma entrega em disputa (disputed → cancelled).
 */
export async function estCancelDelivery(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const deliveryId = req.params['deliveryId'] as string;

        const delivery = await findDelivery(deliveryId);
        if (!delivery) { res.status(404).json({ error: 'Entrega não encontrada.' }); return; }
        if (delivery.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (delivery.status !== 'disputed') {
            res.status(409).json({ error: 'Somente entregas em disputa podem ser canceladas pelo estabelecimento.' }); return;
        }

        const updated = await cancelDelivery(deliveryId);

        await createSystemMessage(
            delivery.offerId,
            delivery.demandId,
            '🚫 Entrega cancelada pelo estabelecimento após disputa. Por favor, entre em contato para resolver.',
            [`${uid}:establishment`],
            [uid, delivery.producerUid],
            [{ uid: delivery.producerUid, role: 'ruralProducer' }],
        ).catch(() => {});

        res.json({ delivery: updated });
    } catch (e) {
        console.error('[delivery.estCancelDelivery] error:', e);
        res.status(500).json({ error: 'Erro ao cancelar entrega.' });
    }
}
