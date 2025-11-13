import { z, ZodType } from "zod";
import { failure, success, Result } from "../types";
import { Exception } from "../errors/types";
import { exception } from "../errors";

export function parseArgs<TArgs extends ZodType<any, any, any>>(
  schema: TArgs,
  input: unknown
): Result<z.infer<TArgs>, Exception> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return failure(
      exception({
        name: "ValidatedArgsError",
        message: parsed.error.message,
      })
    );
  }

  return success(parsed.data);
}
