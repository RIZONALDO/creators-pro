import { OAuth2Client } from 'google-auth-library';
import { env } from './env.js';
import { badRequest, unauthorized } from './errors.js';

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  googleId: string;
}

let client: OAuth2Client | null = null;

/** Verifica um ID token do Google Identity Services (frontend) contra o client id deste servidor.
 * Opcional como VAPID/Stripe — sem GOOGLE_CLIENT_ID, recusa antes de tentar verificar nada. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!env.googleClientId) throw badRequest('GOOGLE_NOT_CONFIGURED', 'Login com Google não está configurado neste servidor.');
  client ??= new OAuth2Client(env.googleClientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('INVALID_GOOGLE_TOKEN', 'Token do Google inválido ou expirado.');
  }
  if (!payload?.email || !payload.sub) throw unauthorized('INVALID_GOOGLE_TOKEN', 'Token do Google inválido ou expirado.');

  return {
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    googleId: payload.sub,
  };
}
