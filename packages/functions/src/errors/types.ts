import { Unit, NonEmptyArray } from "../types";

export type ExceptionSpaceConfig = {
  name: string;
  severity: "info" | "warning" | "error" | "critical";
};

export type ExceptionConfig = {
  name: string;
  namespace?: string;
  code?: string;
  message?: string;
  cause?: Exception;
  stack?: Exception[];
  notes?: string[];
};

export type Exception = ExceptionConfig & {
  stack: Exception[];
  cause?: Exception;
  notes: string[];

  from: (cause: Exception) => Exception;
  is: (exception: Exception) => boolean;
  addNote: (note: string) => Exception;
};

export type ExceptionGroup = {
  name: string;
  exceptions: NonEmptyArray<Exception>;
};
