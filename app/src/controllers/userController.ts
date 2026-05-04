import { Request, Response } from 'express';
import * as User from '../models/user';
import {
  findConsumerProfile,
  findRuralProducerProfile,
  findEstablishmentProfile,
  updateConsumerProfile,
  updateRuralProducerProfile,
  updateEstablishmentProfile,
  buildConsumerProfile,
} from '../models/profiles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findProfileByRole(uid: string, role: User.UserRole) {
  switch (role) {
    case 'consumer':      return findConsumerProfile(uid);
    case 'ruralProducer': return findRuralProducerProfile(uid);
    case 'establishment': return findEstablishmentProfile(uid);
  }
}

async function upsertProfileByRole(uid: string, role: User.UserRole, data: User.UserProfile) {
  switch (role) {
    case 'consumer':
      return updateConsumerProfile(uid, User.sanitizeProfile('consumer', data as Record<string, unknown>) as ReturnType<typeof buildConsumerProfile>);
    case 'ruralProducer':
      return updateRuralProducerProfile(uid, User.sanitizeProfile('ruralProducer', data as Record<string, unknown>) as any);
    case 'establishment':
      return updateEstablishmentProfile(uid, User.sanitizeProfile('establishment', data as Record<string, unknown>) as any);
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

/**
 * GET /users/me/profile?role=<role>
 *
 * Returns the sub-profile for the requested role.
 * If no `role` query param is provided, returns all profiles the user has roles for.
 */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const requestedRole = req.query.role as string | undefined;

    if (requestedRole) {
      // Single role requested
      if (!User.isValidRole(requestedRole)) {
        res.status(400).json({ error: `Invalid role. Accepted values: ${User.VALID_ROLES.join(', ')}` });
        return;
      }
      if (!user.roles.includes(requestedRole as User.UserRole)) {
        res.status(404).json({ error: `User does not have role '${requestedRole}'.` });
        return;
      }
      const profile = await findProfileByRole(req.user.uid, requestedRole as User.UserRole);
      res.json({ role: requestedRole, profile: profile ?? null });
      return;
    }

    // No role param — return all profiles
    const profiles: Record<string, unknown> = {};
    await Promise.all(
      user.roles.map(async (role) => {
        profiles[role] = await findProfileByRole(req.user.uid, role) ?? null;
      })
    );
    res.json({ roles: user.roles, profiles });
  } catch (e) {
    console.error('[getMyProfile] error:', e);
    res.status(500).json({ error: 'Error fetching profile.' });
  }
}

/**
 * POST /users/me/roles
 *
 * Adds a role to the user's roles array (idempotent).
 * Body: { role: UserRole }
 */
export async function addMyRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: string };

  if (!role || !User.isValidRole(role)) {
    res.status(400).json({
      error: `Invalid role. Accepted values: ${User.VALID_ROLES.join(', ')}`,
    });
    return;
  }

  try {
    const result = await User.addRole(req.user.uid, role as User.UserRole);
    res.json({ message: 'Role added.', ...result });
  } catch {
    res.status(500).json({ error: 'Error updating roles.' });
  }
}

/**
 * PUT /users/me/profile?role=<role>
 *
 * Updates the sub-profile for the given role.
 * The `role` query param is required so the client is explicit about which
 * profile it is updating when the user has multiple roles.
 */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const { profile } = req.body as { profile: unknown };

  if (!profile || typeof profile !== 'object') {
    res.status(400).json({ error: 'Invalid profile data.' });
    return;
  }

  const requestedRole = req.query.role as string | undefined;

  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Determine which role's profile to update
    let targetRole: User.UserRole;
    if (requestedRole) {
      if (!User.isValidRole(requestedRole)) {
        res.status(400).json({ error: `Invalid role. Accepted values: ${User.VALID_ROLES.join(', ')}` });
        return;
      }
      targetRole = requestedRole as User.UserRole;
    } else {
      // Fall back to primary role for backwards compatibility
      targetRole = user.role;
    }

    const profileData = await upsertProfileByRole(req.user.uid, targetRole, profile as User.UserProfile);
    res.json({ message: 'Profile updated.', role: targetRole, profile: profileData });
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
