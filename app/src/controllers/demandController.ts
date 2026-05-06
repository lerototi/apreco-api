/**
 * demandController — gerencia demandas de insumos do estabelecimento autenticado.
 *
 * Rotas de escrita (requer perfil establishment):
 *   POST   /establishment/demands                → cria demanda
 *   PUT    /establishment/demands/:demandId      → edita demanda (só status 'open')
 *   DELETE /establishment/demands/:demandId      → cancela demanda
 *
 * Rotas de leitura do estabelecimento:
 *   GET    /establishment/demands                → lista demandas do estabelecimento logado
 *   GET    /establishment/demands/:demandId      → detalhe de uma demanda
 *
 * Rotas públicas (marketplace — sem auth):
 *   GET    /marketplace/demands                  → lista demandas abertas
 *   GET    /marketplace/demands/:demandId        → detalhe público de uma demanda
 */

import { Request, Response } from 'express';
import {
    buildDemandInput,
    createDemand,
    cancelDemand,
    findDemand,
    listDemandsByEstablishment,
    listOpenDemands,
    updateDemand,
    VALID_CATEGORIES,
    VALID_UNITS,
} from '../models/establishmentDemand';
import { findEstablishmentProfile } from '../models/profiles/establishment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveEstablishmentName(uid: string): Promise<string> {
    const profile = await findEstablishmentProfile(uid);
    return profile?.businessName?.trim() || 'Estabelecimento';
}

// ─── Rotas privadas (establishment) ──────────────────────────────────────────

/** GET /establishment/demands */
export async function getMyDemands(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demands = await listDemandsByEstablishment(uid);
        res.json({ demands });
    } catch (e) {
        console.error('[demand.getMyDemands] error:', e);
        res.status(500).json({ error: 'Erro ao buscar solicitações.' });
    }
}

/** GET /establishment/demands/:demandId */
export async function getMyDemand(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const demand = await findDemand(demandId);

        if (!demand) {
            res.status(404).json({ error: 'Solicitação não encontrada.' });
            return;
        }
        if (demand.establishmentUid !== uid) {
            res.status(403).json({ error: 'Acesso negado.' });
            return;
        }

        res.json({ demand });
    } catch (e) {
        console.error('[demand.getMyDemand] error:', e);
        res.status(500).json({ error: 'Erro ao buscar solicitação.' });
    }
}

/** POST /establishment/demands */
export async function createMyDemand(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const raw = req.body as Record<string, unknown>;

        // Verifica se o perfil de establishment existe
        const profile = await findEstablishmentProfile(uid);
        if (!profile) {
            res.status(403).json({ error: 'Perfil de establishment não encontrado.' });
            return;
        }

        // Valida category e unit antes do buildDemandInput (que faz fallback silencioso)
        if (raw.category !== undefined && !VALID_CATEGORIES.includes(raw.category as never)) {
            res.status(400).json({ error: `Categoria inválida: ${raw.category}` });
            return;
        }
        if (raw.unit !== undefined && !VALID_UNITS.includes(raw.unit as never)) {
            res.status(400).json({ error: `Unidade inválida: ${raw.unit}` });
            return;
        }

        const input = buildDemandInput(raw);

        if (!input.productName) {
            res.status(400).json({ error: 'productName é obrigatório.' });
            return;
        }
        if (input.quantityNeeded <= 0) {
            res.status(400).json({ error: 'quantityNeeded deve ser maior que zero.' });
            return;
        }
        if (!input.isRecurring && !input.deadline) {
            res.status(400).json({ error: 'deadline é obrigatório para solicitações pontuais.' });
            return;
        }
        if (!input.deliveryLocation.city || !input.deliveryLocation.state) {
            res.status(400).json({ error: 'deliveryLocation.city e deliveryLocation.state são obrigatórios.' });
            return;
        }

        const establishmentName = profile.businessName?.trim() || 'Estabelecimento';
        const demand = await createDemand(uid, establishmentName, input);
        res.status(201).json({ demand });
    } catch (e) {
        console.error('[demand.createMyDemand] error:', e);
        res.status(500).json({ error: 'Erro ao criar solicitação.' });
    }
}

/** PUT /establishment/demands/:demandId */
export async function updateMyDemand(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const partial = buildDemandInput(req.body as Record<string, unknown>);

        const demand = await updateDemand(uid, demandId, partial);
        res.json({ demand });
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'Demand not found.') {
            res.status(404).json({ error: 'Solicitação não encontrada.' });
        } else if (msg === 'Forbidden.') {
            res.status(403).json({ error: 'Acesso negado.' });
        } else if (msg === 'Only open demands can be edited.') {
            res.status(409).json({ error: 'Apenas solicitações abertas podem ser editadas.' });
        } else {
            console.error('[demand.updateMyDemand] error:', e);
            res.status(500).json({ error: 'Erro ao atualizar solicitação.' });
        }
    }
}

/** DELETE /establishment/demands/:demandId */
export async function cancelMyDemand(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        await cancelDemand(uid, demandId);
        const demand = await findDemand(demandId);
        res.json({ demand });
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'Demand not found.') {
            res.status(404).json({ error: 'Solicitação não encontrada.' });
        } else if (msg === 'Forbidden.') {
            res.status(403).json({ error: 'Acesso negado.' });
        } else if (msg === 'Cannot cancel a closed demand.') {
            res.status(409).json({ error: 'Não é possível cancelar uma solicitação já encerrada.' });
        } else {
            console.error('[demand.cancelMyDemand] error:', e);
            res.status(500).json({ error: 'Erro ao cancelar solicitação.' });
        }
    }
}

// ─── Rotas públicas (marketplace) ─────────────────────────────────────────────

/** GET /marketplace/demands */
export async function getOpenDemands(req: Request, res: Response): Promise<void> {
    try {
        const demands = await listOpenDemands();
        res.json({ demands });
    } catch (e) {
        console.error('[demand.getOpenDemands] error:', e);
        res.status(500).json({ error: 'Erro ao buscar solicitações.' });
    }
}

/** GET /marketplace/demands/:demandId */
export async function getOpenDemand(req: Request, res: Response): Promise<void> {
    try {
        const demandId = req.params['demandId'] as string;
        const demand = await findDemand(demandId);

        if (!demand || demand.status !== 'open') {
            res.status(404).json({ error: 'Solicitação não encontrada.' });
            return;
        }

        res.json({ demand });
    } catch (e) {
        console.error('[demand.getOpenDemand] error:', e);
        res.status(500).json({ error: 'Erro ao buscar solicitação.' });
    }
}
