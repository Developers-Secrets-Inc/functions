# Result Type

## Overview

The `Result<T, E>` type is a functional programming construct that represents the outcome of an operation that can either succeed with a value or fail with an error. It provides a robust and type-safe way to handle potential failures in your application.

## Purpose

The Result type is designed to eliminate the ambiguity and potential pitfalls of traditional error handling patterns. Instead of relying on exceptions, null values, or undefined, Result forces developers to explicitly handle both success and error scenarios at the type level.

## Basic Interface

```typescript
interface Result<T, E> {
    // Type checking methods
    isSuccess(): boolean;
    isError(): boolean;

    // Pattern matching
    match<U>(handlers: {
        onSuccess: (data: T) => Promise<U>;
        onError: (error: E) => Promise<U>;
    }): Promise<U>;
}

// Subtypes
interface Success<T> {
    readonly _tag: 'Success';
    readonly value: T;
}

interface Failure<E> {
    readonly _tag: 'Failure';
    readonly error: E;
}

// Factory functions
const success = <T>(data: T): Success<T> => ({ _tag: 'Success', value: data });
const failure = <E>(error: E): Failure<E> => ({ _tag: 'Failure', error });
```

## Core Methods

### `isSuccess()`
Returns `true` if the Result contains a success value.

```typescript
const result: Result<User, AuthError> = await createUser({...});
if (result.isSuccess()) {
    // Result contains a User value
}
```

### `isError()`
Returns `true` if the Result contains an error value.

```typescript
const result: Result<User, AuthError> = await createUser({...});
if (result.isError()) {
    // Result contains an AuthError
}
```

### `match()`
Provides exhaustive pattern matching for both success and error cases.

```typescript
const result: Result<User, AuthError> = await createUser({...});

await result.match({
    onSuccess: async ({ user }) => {
        // Handle successful operation
        // 'user' is typed as User (not Result<User, AuthError>)
        console.log(`User created: ${user.name}`);
    },
    onError: async ({ error }) => {
        // Handle error case
        // 'error' is typed as AuthError (not generic Error)
        console.log(`Authentication failed: ${error.message}`);
    }
});
```

## Usage Patterns

### 1. Basic Error Handling

```typescript
const createUserResult = await createUser({ email: 'user@example.com' });

await createUserResult.match({
    onSuccess: async ({ user }) => {
        // Proceed with user object
        return await sendWelcomeEmail(user);
    },
    onError: async ({ error }) => {
        // Handle specific error type
        if (error.code === 'EMAIL_EXISTS') {
            return { status: 'email_exists' };
        }
        return { status: 'error' };
    }
});

// Using factory functions
const successResult = success<User>(new User('john@example.com'));
const errorResult = failure<AuthError>(new EmailExistsError());
```

### 2. Chaining Operations

```typescript
const result = await authenticateUser({ email, password });

await result.match({
    onSuccess: async ({ user }) => {
        // Chain success operations
        const updateUserResult = await updateUser(user.id, { lastLogin: new Date() });
        await updateUserResult.match({
            onSuccess: ({ updatedUser }) => {
                console.log('User updated successfully');
            },
            onError: ({ error }) => {
                console.error('Failed to update user:', error.message);
            }
        });
    },
    onError: async ({ error }) => {
        console.error('Authentication failed:', error.message);
    }
});
```

### 3. Integration with API Builders

```typescript
const createUser = mutation({
    args: z.object({ email: z.email() }),
    handler: async (ctx, args): Promise<Result<User, AuthError>> => {
        try {
            const user = await db.user.create({ data: args });
            return success(user);
        } catch (error) {
            if (error.code === 'P2002') {
                return failure(new EmailExistsError());
            }
            return failure(new AuthError('Failed to create user'));
        }
    },
    revalidate: ['user:list']
});
```

## Benefits

### 1. Type Safety
- Success values are typed specifically as `T`
- Error values are typed specifically as `E`
- No risk of accessing wrong properties or methods

### 2. Forced Error Handling
- Developers must handle both success and error cases
- No undefined behavior or silent failures
- Compile-time guarantees that all cases are handled

### 3. Clear Error Propagation
- Errors are explicitly handled and cannot be accidentally ignored
- Easy to trace error paths through the application
- No more uncaught exceptions or null pointer issues

### 4. Excellent Developer Experience
- Intuitive method names (`isSuccess`, `isError`, `match`)
- Consistent pattern across all Result instances
- Easy to debug and reason about

## Error Types

The Result type works well with custom error types:

```typescript
class AuthError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'AuthError';
    }
}

class EmailExistsError extends AuthError {
    constructor() {
        super('Email already exists', 'EMAIL_EXISTS');
    }
}

class InvalidCredentialsError extends AuthError {
    constructor() {
        super('Invalid credentials', 'INVALID_CREDENTIALS');
    }
}

// Usage
const result: Result<User, AuthError> = await login({...});
```

## Comparison with Traditional Patterns

### vs Try/Catch

```typescript
// Traditional try/catch
try {
    const user = await createUser({...});
    return handleUser(user);
} catch (error) {
    return handleError(error);
}

// With Result
const result = await createUser({...});
return await result.match({
    onSuccess: ({ user }) => handleUser(user),
    onError: ({ error }) => handleError(error)
});
```

### vs Null/Undefined

```typescript
// Traditional null/undefined
const user = await getUser(id);
if (user) {
    return user.name;
} else {
    return 'Unknown';
}

// With Maybe
const result: Maybe<User> = await getUser(id);
return await result.match({
    onSome: ({ user }) => user.name,
    onNone: () => 'Unknown'
});
```

## Best Practices

### 1. Use Specific Error Types
```typescript
// Good
interface Result<User, AuthError>

// Avoid
interface Result<User, Error>
```

### 2. Keep Error Handlers Simple
```typescript
// Good
await result.match({
    onSuccess: ({ user }) => processUser(user),
    onError: ({ error }) => logError(error)
});

// Avoid
await result.match({
    onSuccess: ({ user }) => {
        // Complex logic
        if (user.isActive) {
            // More logic
        }
    },
    onError: ({ error }) => {
        // Mixed concerns
        if (error.code === 'NETWORK') {
            retry();
        } else {
            notify();
        }
    }
});
```

### 3. Handle Errors Appropriately
```typescript
// Good error handling
await result.match({
    onSuccess: ({ user }) => proceedWithUser(user),
    onError: ({ error }) => {
        // Categorize and handle appropriately
        switch (error.constructor) {
            case NetworkError:
                return retryOperation();
            case ValidationError:
                return showValidationError(error);
            default:
                return logUnexpectedError(error);
        }
    }
});
```

## Performance Considerations

### Async Overhead
The `match` method uses async handlers, which adds some overhead. For simple operations, consider:

1. Using sync methods when possible
2. Keeping async handlers concise
3. Avoiding unnecessary async operations in handlers

### Memory Usage
Result objects are lightweight and don't add significant memory overhead. The type information is handled at compile time.

## Debugging

### Developer Tools
The Result type provides excellent debugging capabilities:

1. Clear type information in TypeScript
2. Explicit error messages
3. Easy to inspect values in development tools

### Error Tracking
```typescript
const result = await operation();
await result.match({
    onSuccess: (data) => logSuccess(data),
    onError: (error) => logErrorWithDetails(error)
});
```

## Integration Patterns

### With API Events
```typescript
const createUser = mutation({
    args: z.object({ email: z.email() }),
    handler: async (ctx, args): Promise<Result<User, AuthError>> => {
        const result = await db.user.create({ data: args });
        if (result.isSuccess()) {
            ctx.emit('user:created', result.value);
        }
        return result;
    }
});
```

### With Caching
```typescript
const getUser = query({
    args: z.object({ id: z.string() }),
    handler: async (ctx, args): Promise<Result<User, Error>> => {
        const cached = await cache.get(`user:${args.id}`);
        if (cached) {
            return success(cached);
        }
        const user = await db.user.findUnique({ where: { id: args.id } });
        if (user) {
            await cache.set(`user:${args.id}`, user);
            return success(user);
        }
        return failure(new Error('User not found'));
    }
});
```

The Result type provides a robust foundation for error handling in the Deesse API framework, ensuring type safety, explicit error handling, and excellent developer experience.