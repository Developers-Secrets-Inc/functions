# Context Types Generation System

## Overview

This document outlines the architecture for a runtime type generation system that automatically creates TypeScript declarations for the context object passed to `createAPI`. The goal is to provide strong typing throughout the application without requiring complex schemas or classes.

## Problem Statement

Currently, the context in `createAPI` uses a generic type `TContext` that is erased at runtime. We want to capture the actual structure of the context object and generate proper TypeScript declarations that can be used throughout the codebase.

## Simplified Functional Architecture

### Core Principles

1. **Functional Programming**: No classes, pure functions only
2. **Runtime Generation**: Generate declarations based on actual object structure
3. **Type Inference**: Infer types from object values, not type annotations
4. **Immutability**: No side effects, create new objects for every change
5. **Simplicity**: Single focus on context typing, no complex validation

### Architecture Components

#### 1. Generator Module (`src/context/generator.ts`)

Pure functions that:
- Take an object and a name as input
- Generate TypeScript declaration strings
- Are composable and immutable

```typescript
export const generateContextDeclaration = (name: string, context: Record<string, unknown>): string => {
  const properties = Object.entries(context).map(([key, value]) => {
    const type = inferTypeFromValue(value);
    return `  ${key}: ${type};`;
  }).join('\n');

  return `
declare module "${process.cwd()}/src/context/generated" {
  export interface ${name}Context {
${properties}
  }

  export type ${name}API<T extends ${name}Context = ${name}Context> = T & {
    __contextName: "${name}";
  };
}
`;
};
```

#### 2. createAPI Integration (`src/api/index.ts`)

Modified `createAPI` function that:
- Automatically generates types on first call
- Uses a simple cache to avoid regeneration
- Maintains existing functional interface

```typescript
export const createAPI = <TContext extends Record<string, unknown>>(
  config: APIConfig<TContext>,
  contextName: string = 'App'
): API<TContext> => {
  // Generate types only once per context name
  if (!generatedContexts.has(contextName)) {
    generateContextDeclarationFile(contextName, config.context);
    generatedContexts.add(contextName);
  }

  // Existing functional logic...
};
```

#### 3. Context Core (`src/context/index.ts`)

Simple context management functions:
- `createContext`: Initialize context
- `addContext`: Add context immutably
- `getContext`: Retrieve current context

#### 4. Generated Types (`src/context/generated.ts`)

Single generated file containing:
- `declare module` with context interface
- Type utilities for the API

## Type Inference Logic

The system infers types from actual values:

- `null` � `null`
- `[]` � `unknown[]`
- `["a", "b"]` � `string[]`
- `{}` � `Record<string, unknown>`
- `{ name: "John" }` � `{ name: string }`

This provides reasonable inference without requiring type annotations.

## Usage Pattern

### 1. API Creation

```typescript
const api = createAPI({
  context: {
    user: null,
    permissions: [],
    settings: { theme: "dark", language: "fr" }
  },
  commands: [],
  events: []
}, "App");
```

### 2. Function Implementation with Strong Typing

```typescript
import type { AppContext } from '../context/generated';

export function query<TArgs extends ZodType, TOutput, TError extends Exception>(
  options: {
    args: TArgs;
    handler: (args: z.infer<TArgs>, ctx: AppContext) => AsyncResult<TOutput, TError>;
  }
) {
  return (input: z.infer<TArgs>): AsyncResult<TOutput, TError> => {
    const parsed = parseArgs(options.args, input);

    return parsed.match({
      onSuccess: (data) => {
        const ctx = getContext() as AppContext; // Strongly typed!
        return options.handler(data, ctx);
      },
      onFailure: (error) => {
        // Error handling...
      }
    });
  };
}
```

### 3. Context Extension

```typescript
api.addContext("session", { token: "abc123" });
```

## Generated File Example

After running with the context above, the generated file would be:

```typescript
declare module "src/context/generated" {
  export interface AppContext {
    user: null;
    permissions: string[];
    settings: {
      theme: string;
      language: string;
    };
  }

  export type AppAPI<T extends AppContext = AppContext> = T & {
    __contextName: "App";
  };
}
```

## Benefits

### 1. Purely Functional
- No classes or complex OOP patterns
- Pure functions with no side effects
- Immutable operations throughout

### 2. Simple and Focused
- Single responsibility: context typing
- No schema complexity
- Straightforward type inference

### 3. Runtime Generation
- Captures actual object structure
- Works with dynamic contexts
- Generates declarations immediately

### 4. Strong Integration
- Compatible with existing Zod validation
- Maintains Result/AsyncResult patterns
- Works with current error handling

### 5. Performance
- Single generation per context name
- Simple caching mechanism
- No AST parsing overhead

## Implementation Considerations

### Runtime Only
- Types are generated at runtime, not compile time
- Requires the application to run at least once
- Generated file should be committed to git

### Type Limitations
- Cannot capture complex generic types
- Limited to runtime-inferable types
- No union type inference beyond basic types

### Cache Strategy
- Simple string-based cache (context names)
- Cache stored in memory during runtime
- Avoids file system operations after first generation

## Migration Path

### Current State
```typescript
// Context is generic, types are erased
const api = createAPI<{ user: User | null }>({ ... });
```

### After Migration
```typescript
// Context structure is captured and typed
const api = createAPI({
  context: {
    user: null, // Type inferred as User | null
    permissions: [] // Type inferred as string[]
  },
  commands: [],
  events: []
}, "App");
```

This approach provides the strong typing benefits of Drizzle's schema system while maintaining the functional purity and simplicity of the existing architecture.