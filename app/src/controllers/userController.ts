import { Request, Response } from 'express';
import * as User from '../models/user';

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      // Perfil não existe ainda — cria automaticamente (ocorre em dev local onde o trigger não roda)
      console.log('[getMe] perfil não encontrado, criando para uid:', req.user.uid);
      await User.createUser({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name,
        photoURL: req.user.picture,
      });
      const created = await User.findById(req.user.uid);
      res.json(created);
      return;
    }
    res.json(user);
  } catch (e) {
    console.error('[getMe] erro:', e);
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

    const profileData = User.sanitizeProfile(user.role, profile as Record<string, unknown>);
    const result = await User.updateProfile(req.user.uid, profileData);
    res.json({ message: 'Perfil atualizado.', ...result });
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
