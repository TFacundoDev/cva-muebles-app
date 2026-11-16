import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { CacheTag } from '@cva/shared';
import { AppConfig } from '../../config/app-config.js';

/**
 * Le avisa a la web (Next.js) que regenere las páginas que usan ciertos datos.
 * Así la tienda queda cacheada y rápida, pero un cambio del dueño se ve enseguida.
 */
@Injectable()
export class WebCacheService {
  private readonly logger = new Logger(WebCacheService.name);

  constructor(private readonly config: AppConfig) {}

  /** No bloquea ni falla: si la web no responde, el dato se actualiza solo cuando vence la caché. */
  revalidate(...tags: CacheTag[]): void {
    const { WEB_URLS, REVALIDATE_SECRET } = this.config.env;
    if (!REVALIDATE_SECRET) return;
    for (const base of WEB_URLS) {
      fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': REVALIDATE_SECRET },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5000),
      })
        .then((res) => {
          if (!res.ok) this.logger.warn(`La web ${base} respondió ${res.status} al regenerar`);
        })
        .catch((error: Error) => {
          this.logger.warn(`No se pudo avisar a ${base}: ${error.message}`);
        });
    }
  }
}

@Global()
@Module({ providers: [WebCacheService], exports: [WebCacheService] })
export class WebCacheModule {}
