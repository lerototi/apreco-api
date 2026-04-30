import { Request, Response } from 'express';
import * as User from '../models/user';
import {
  findConsumerProfile,
  findRuralProducerProfile,
  findEstabelecimentoProfile,
  updateConsumerProfile,
  updateRuralProducerProfile,
  updateEstabelecimentoProfile,
  buildConsumerProfile,
} from '../models/profiles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findProfileByRole(uid: string, role: User.UserRole) {
  switch (role) {
    case 'consumer':       return findConsumerProfile(uid);
    case 'ruralProducer':  return findRuralProducerProfile(uid);
    case 'estabelecimento': return findEstabelecimentoProfile(uid);
  }
}

async function upsertProfileByRole(uid: string, role: User.UserRole, data: User.UserProfile) {
  switch (role) {
    case 'consumer':
      return updateConsumerProfile(uid, User.sanitizeProfile('consumer', data as Record<string, unknown>) as ReturnType<typeof buildConsumerProfile>);
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
      // Profile not found — auto-create (happens in local dev where the trigger doesn't run)
      console.log('[getMe] profile not found, creating for uid:', req.user.uid);
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
    console.error('[getMe] error:', e);
    res.status(500).json({ error: 'Error fetching profile.' });
  }
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const profile = await findProfileByRole(req.user.uid, user.role);
    res.json({ profile: profile ?? null });
  } catch (e) {
    console.error('[getMyProfile] error:', e);
    res.status(500).json({ error: 'Error fetching profile.' });
  }
}

export async function updateMyRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: string };

  if (!role || !User.isValidRole(role)) {
    res.status(400).json({
      error: `Invalid role. Accepted values: ${User.VALID_ROLES.join(', ')}`,
    });
    return;
  }

  try {
    const result = await User.updateRole(req.user.uid, role);
    res.json({ message: 'Role updated.', ...result });
  } catch {
    res.status(500).json({ error: 'Error updating role.' });
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const { profile } = req.body as { profile: unknown };

  if (!profile || typeof profile !== 'object') {
    res.status(400).json({ error: 'Invalid profile data.' });
    return;
  }

  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const profileData = await upsertProfileByRole(req.user.uid, user.role, profile as User.UserProfile);
    res.json({ message: 'Profile updated.', profile: profileData });
  } catch {
    res.status(500).json({ error: 'Error updating profile.' });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json(User.toPublicProfile(user));
  } catch {
    res.status(500).json({ error: 'Error fetching user.' });
  }
}
