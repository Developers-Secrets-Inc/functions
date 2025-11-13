import { z, ZodType } from "zod";
import { Exception } from "../errors/types";
import { AsyncResult, Unit } from "../types";

export type Command = {
  beforeInvoke: () => Promise<Unit>;
  afterInvoke: () => Promise<Unit>;
  onSuccess: () => Promise<Unit>;
  onError: (config: { exception: Exception }) => Promise<Unit>;
};

export type CommandGroup = {
  name: string;
  children: (Command | CommandGroup)[];

  add: (child: Command | CommandGroup) => Unit;
  remove: (child: Command | CommandGroup) => Unit;
};

export type Query<
  TArgs extends ZodType = ZodType,
  TError extends Exception = Exception,
  TOutput = Unit,
> = (options: {
  args: TArgs;
  handler: (args: z.infer<TArgs>) => AsyncResult<TOutput, TError>;
}) => (args: z.infer<TArgs>) => AsyncResult<TOutput, TError>;


export type Mutation<
  TArgs extends ZodType = ZodType,
  TError extends Exception = Exception,
  TOutput = Unit,
> = (options: {
  args: TArgs;
  handler: (args: z.infer<TArgs>) => AsyncResult<TOutput, TError>;
}) => (args: z.infer<TArgs>) => AsyncResult<TOutput, TError>;
