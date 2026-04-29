import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import type { DecodedIdToken } from 'firebase-admin/auth';

// Extende o tipo Request do Express para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user: DecodedIdToken;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  console.log('[auth] headers recebidos:', JSON.stringify(req.headers, null, 2));
  console.log('[auth] authHeader:', authHeader?.substring(0, 30) + '...');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido.' });
    return;
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    console.log('[auth] verificando token, primeiros 20 chars:', token.substring(0, 20));
    req.user = await auth.verifyIdToken(token);
    console.log('[auth] token válido, uid:', req.user.uid);
    next();
  } catch (e) {
    console.error('[auth] verifyIdToken falhou:', e);
    res.status(401).json({ error: 'Token inválido.' });
  }
}
