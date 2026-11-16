import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida el body o la query con un esquema del paquete compartido antes de
 * que llegue al service. Uso: @Body(new ZodPipe(productInputSchema)).
 */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        message: 'Revisá los datos enviados',
        details: result.error.issues.map((issue) => {
          const field = issue.path.join('.');
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      });
    }
    return result.data;
  }
}
