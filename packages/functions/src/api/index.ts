import z, { ZodType } from "zod";
import { AppContext } from "../context/typing";
import { query as queryFunction } from "../functions/query";
import type { AsyncResult } from "../types";
import { Exception } from "../errors/types";

type QueryFn<TArgs, TOutput, TError> = (
  input: TArgs,
) => Promise<AsyncResult<TOutput, TError>>;

export const createAPI = <TContext extends Record<string, unknown>>(config: {
  context: TContext;
}) => {
  const ctx = { ...config.context } as TContext;

  const api = { context: ctx } as {
    context: TContext;
    [key: string]: QueryFn<any, any, any> | TContext;
  };

  const query = <TContext extends AppContext = AppContext>() => {
    return <
      TArgs extends ZodType<any, any, any>,
      TOutput,
      TError extends Exception = Exception,
    >(options: {
      args: TArgs;
      handler: (args: z.infer<TArgs>, ctx: TContext) => AsyncResult<TOutput, TError>;
    }) => {
      return queryFunction<TArgs, TOutput, TError, TContext>(options);
    };
  };

  return {
    ...api,
    query,
  } as const;
};
