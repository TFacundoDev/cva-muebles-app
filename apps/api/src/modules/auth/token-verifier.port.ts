/** Lo que sabemos de una persona después de validar su token. */
export interface VerifiedIdentity {
  id: string;
  email: string;
  name: string;
}

/**
 * PUERTO: cómo se valida el login.
 * La API no hace el login: solo recibe el token que emitió el proveedor
 * (Supabase Auth) y comprueba que sea auténtico.
 */
export abstract class TokenVerifier {
  /** Devuelve la identidad o lanza un error si el token no es válido. */
  abstract verify(token: string): Promise<VerifiedIdentity>;
}
