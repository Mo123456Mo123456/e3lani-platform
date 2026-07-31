import { BadRequestException, Injectable, PipeTransform, type ArgumentMetadata } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** Validates request input against a shared zod schema.
 *  Runs for @Body()/@Query()/@Param() parameters; custom decorators
 *  (@CurrentUser, @Ip, @Req) pass through untouched. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === "custom") {
      return value;
    }
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: "validation_failed",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
