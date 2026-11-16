import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import type { TokenVerifier, VerifiedIdentity } from './token-verifier.port.js';

interface SupabaseClaims extends JWTPayload {
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}

/**
 * ADAPTADOR: Supabase Auth.
 * Los proyectos nuevos firman con claves asimétricas y publican las públicas
 * en un JWKS; los viejos firman con un secreto compartido (HS256). Si se
 * configura SUPABASE_JWT_SECRET se usa el secreto; si no, el JWKS.
 */
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly issuer: string;
  private readonly secret: Uint8Array | null;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(supabaseUrl: string, jwtSecret: string) {
    const base = supabaseUrl.replace(/\/$/, '');
    this.issuer = `${base}/auth/v1`;
    this.secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    const options = { issuer: this.issuer, audience: 'authenticated' };
    const { payload } = this.secret
      ? await jwtVerify<SupabaseClaims>(token, this.secret, options)
      : await jwtVerify<SupabaseClaims>(token, this.jwks, options);

    if (!payload.sub || !payload.email) throw new Error('El token no trae usuario');
    const name =
      payload.user_metadata?.full_name ?? payload.user_metadata?.name ?? payload.email.split('@')[0];
    return { id: payload.sub, email: payload.email.toLowerCase(), name };
  }
}
