import { ForbiddenException } from '@nestjs/common';
import { SignJWT } from 'jose';
import { LocalStorage } from '../../infrastructure/storage/local.storage.js';
import { assertOwnUpload } from '../media/media.service.js';
import { UsersService } from '../users/users.service.js';
import { DevTokenVerifier } from './dev-token.verifier.js';
import { SupabaseTokenVerifier } from './supabase-token.verifier.js';

describe('SupabaseTokenVerifier (secreto HS256)', () => {
  const url = 'https://proyecto.supabase.co';
  const secret = 'un-secreto-de-prueba-bien-largo-para-hs256';
  const verifier = new SupabaseTokenVerifier(url, secret);

  const sign = (claims: Record<string, unknown>, key = secret, issuer = `${url}/auth/v1`) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(key));

  it('acepta un token bien firmado y saca email y nombre', async () => {
    const token = await sign({ email: 'Facu@Example.com', user_metadata: { full_name: 'Facu A.' } });
    await expect(verifier.verify(token)).resolves.toEqual({
      id: 'user-123',
      email: 'facu@example.com',
      name: 'Facu A.',
    });
  });

  it('rechaza un token firmado con otra clave', async () => {
    const token = await sign({ email: 'x@example.com' }, 'otra-clave-distinta-que-no-es-la-del-proyecto');
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rechaza un token de otro proyecto', async () => {
    const token = await sign({ email: 'x@example.com' }, secret, 'https://otro.supabase.co/auth/v1');
    await expect(verifier.verify(token)).rejects.toThrow();
  });
});

describe('DevTokenVerifier', () => {
  it('da siempre el mismo id para el mismo email', async () => {
    const verifier = new DevTokenVerifier();
    const token = (email: string) => `dev.${Buffer.from(JSON.stringify({ email })).toString('base64url')}`;
    const a = await verifier.verify(token('Ana@Test.com'));
    const b = await verifier.verify(token('ana@test.com'));
    expect(a.id).toBe(b.id);
    await expect(verifier.verify('cualquier-cosa')).rejects.toThrow();
  });
});

describe('roles', () => {
  it('es dueño solo quien figura en OWNER_EMAILS', () => {
    const service = new UsersService({} as never, { env: { OWNER_EMAILS: ['papa@cva.com'] } } as never);
    expect(service.roleFor('Papa@CVA.com')).toBe('owner');
    expect(service.roleFor('cliente@gmail.com')).toBe('customer');
  });
});

describe('subidas', () => {
  const user = { id: 'u-1', email: 'a@b.c', displayName: 'A', role: 'customer' as const };

  it('nadie registra un archivo que subió otra persona', () => {
    expect(() => assertOwnUpload(user, 'uploads/u-1/foto.jpg')).not.toThrow();
    expect(() => assertOwnUpload(user, 'uploads/u-2/foto.jpg')).toThrow(ForbiddenException);
    expect(() => assertOwnUpload(user, 'uploads/u-1/../u-2/foto.jpg')).toThrow(ForbiddenException);
    expect(() => assertOwnUpload(user, 'products/x/foto.webp')).toThrow(ForbiddenException);
  });

  it('la URL firmada del modo local vence y no se puede alterar', () => {
    const storage = new LocalStorage({ dir: '/tmp/x', publicApiUrl: 'http://api', signingSecret: 's3cret' });
    const expires = Date.now() + 60_000;
    const signature = storage.sign('uploads/u-1/a.jpg', 'image/jpeg', expires);
    expect(storage.verify('uploads/u-1/a.jpg', 'image/jpeg', expires, signature)).toBe(true);
    expect(storage.verify('uploads/u-2/a.jpg', 'image/jpeg', expires, signature)).toBe(false);
    expect(storage.verify('uploads/u-1/a.jpg', 'image/jpeg', expires + 1, signature)).toBe(false);
    const old = Date.now() - 1;
    expect(storage.verify('uploads/u-1/a.jpg', 'image/jpeg', old, storage.sign('uploads/u-1/a.jpg', 'image/jpeg', old))).toBe(false);
  });
});
