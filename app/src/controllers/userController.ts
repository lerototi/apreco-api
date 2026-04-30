import { Request, Response } from 'express';
import * as User from '../models/user';
import {
  findConsumidorProfile,
  findRuralProducerProfile,
  findEstabelecimentoProfile,
  updateConsumidorProfile,
  updateRuralProducerProfile,
  updateEstabelecimentoProfile,
  createConsumidorProfile,
  buildConsumidorProfile,
} from '../models/profiles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findProfileByRole(uid: string, role: User.UserRole) {
  switch (role) {
    case 'consumidor':     return findConsumidorProfile(uid);
    case 'ruralProducer':  return findRuralProducerProfile(uid);
    case 'estabelecimento': return findEstabelecimentoProfile(uid);
  }
}

async function upsertProfileByRole(uid: string, role: User.UserRole, data: User.UserProfile) {
  switch (role) {
    case 'consumidor':
      return updateConsumidorProfile(uid, User.sanitizeProfile('consumidor', data as Record<string, unknown>) as ReturnType<typeof buildConsumidorProfile>);
    case 'ruralProducer':
      return updateRuralProducerProfile(uid, User.sanitizeProfile('ruralProducer', data as Record<string, unknown>) as any);
    case 'estabelecimento':
      return updateEstabelecimentoProfile(uid, User.sanitizeProfile('estabelecimento', data as Record<string, unknown>) as any);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    let user = await User.findById(req.user.uid);
    if (!user) {
      // Perfil não existe ainda — cria automaticamente (ocorre em dev local onde o trigger não roda)
      console.log('[getMe] perfil não encontrado, criando para uid:', req.user.uid);
      await User.createUser({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name,
        photoURL: req.user.picture,
      });
      user = await User.findById(req.user.uid);
    }
    res.json(user);
  } catch (e) {
    console.error('[getMe] erro:', e);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const profile = await findProfileByRole(req.user.uid, user.role);
    res.json({ profile: profile ?? null });
  } catch (e) {
    console.error('[getMyProfile] erro:', e);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
}

export async function updateMyRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: string };

  if (!role || !User.isValidRole(role)) {
    res.status(400).json({
      error: `Role inválido. Valores aceitos: ${User.VALID_ROLES.join(', ')}`,
    });
    return;
  }

  try {
    const result = await User.updateRole(req.user.uid, role);
    res.json({ message: 'Perfil atualizado.', ...result });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const { profile } = req.body as { profile: unknown };

  if (!profile || typeof profile !== 'object') {
    res.status(400).json({ error: 'Dados de perfil inválidos.' });
    return;
  }

  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const profileData = await upsertProfileByRole(req.user.uid, user.role, profile as User.UserProfile);
    res.json({ message: 'Perfil atualizado.', profile: profileData });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    res.json(User.toPublicProfile(user));
  } catch {
    res.status(500).json({ error: 'Erro ao buscar usuário.' });
  }
}
