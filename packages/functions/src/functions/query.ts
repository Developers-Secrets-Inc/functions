import { z, ZodType } from "zod";
import { exception } from "../errors";
import { Exception } from "../errors/types";
import { AsyncResult, failure } from "../types";
import { parseArgs } from "./parse";

export function query<
  TArgs extends ZodType<any, any, any>,
  TOutput,
  TError extends Exception = Exception,
>(options: {
  args: TArgs;
  handler: (args: z.infer<TArgs>) => AsyncResult<TOutput, TError>;
}) {
  type Input = z.infer<TArgs>;

  return (input: Input): AsyncResult<TOutput, TError> => {
    const parsed = parseArgs(options.args, input);

    return parsed.match({
      onSuccess: (data: z.infer<TArgs>) => options.handler(data),
      onFailure: (error: Exception) => {
        const ValidationError = exception({
          name: "ValidationError",
          message: error.message,
        }) as TError;

        return Promise.resolve(failure(ValidationError));
      },
    });
  };
}
