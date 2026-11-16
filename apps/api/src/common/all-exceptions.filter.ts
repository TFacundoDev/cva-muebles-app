import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@cva/shared';
import type { Response } from 'express';

// Errores de Prisma que tienen una traducción clara a HTTP.
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con ese valor' },
  P2003: { status: HttpStatus.CONFLICT, message: 'No se puede completar: hay datos relacionados' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'No se encontró el registro' },
};

/** Todas las respuestas de error salen con la misma forma: { statusCode, message, details? }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
        return { statusCode, message: 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo' };
      }
      const response = exception.getResponse();
      if (typeof response === 'string') return { statusCode, message: response };
      const { message, details } = response as { message?: string | string[]; details?: string[] };
      return {
        statusCode,
        message: Array.isArray(message) ? message.join('. ') : (message ?? exception.message),
        ...(details ? { details } : {}),
      };
    }

    const code = (exception as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && PRISMA_ERRORS[code]) {
      const { status, message } = PRISMA_ERRORS[code];
      return { statusCode: status, message };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Ocurrió un error inesperado' };
  }
}
