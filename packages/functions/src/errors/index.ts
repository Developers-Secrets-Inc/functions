import {
  Exception,
  ExceptionConfig,
  ExceptionSpaceConfig,
  ExceptionGroup,
} from "./types";

export const exception = (config: ExceptionConfig): Exception => {
  const base: Exception = {
    ...config,
    stack: config.stack ?? [],
    cause: config.cause,
    notes: config.notes ?? [],

    from(cause: Exception): Exception {
      return exception({
        ...config,
        cause,
        stack: [...base.stack, cause],
      });
    },

    is(other: Exception): boolean {
      return (
        other.name === config.name &&
        (config.namespace ? other.namespace === config.namespace : true)
      );
    },

    addNote(note: string): Exception {
      return exception({
        ...config,
        notes: [...base.notes, note],
      });
    },
  };

  return base;
};

export const exceptionSpace = (space: ExceptionSpaceConfig) => {
  return {
    define: (config: Omit<ExceptionConfig, "namespace">): Exception => {
      return exception({
        ...config,
        namespace: space.name,
      });
    },
    severity: space.severity,
    name: space.name,
  };
};

export const raise = (exception: Exception): Exception => {
  return exception;
};

export const group = (
  name: string,
  exceptions: [Exception, ...Exception[]],
): ExceptionGroup => ({
  name,
  exceptions,
});
