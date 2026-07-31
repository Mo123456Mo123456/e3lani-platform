import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** أنبوب تحقّق موحّد يعتمد على Zod ويعيد رسائل عربية واضحة. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'بيانات غير صالحة',
        code: 'VALIDATION_ERROR',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '_',
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

export const zodPipe = (schema: ZodSchema) => new ZodValidationPipe(schema);
