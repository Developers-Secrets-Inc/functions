# Advanced Error System

## Overview

The Deesse API framework features a sophisticated error handling system that provides unparalleled type safety, hierarchical organization, and rich context preservation. This system goes beyond traditional error handling by implementing a functional approach with error spaces, composition, and flexible matching patterns.

## Core Concepts

### Error Spaces

Error Spaces create hierarchical error domains with shared properties and severity levels.

```typescript
interface ErrorSpaceConfig<T extends string, Severity extends string> {
    name: T;
    severity: Severity;
    // Optional additional properties for all errors in this space
    metadata?: Record<string, unknown>;
}

const SystemError = errorSpace({
    name: 'systemError',
    severity: 'critical',
    metadata: { category: 'infrastructure' }
});

const Warning = errorSpace({
    name: 'warning',
    severity: 'warning',
    metadata: { category: 'user-feedback' }
});
```

### Error Definition

Errors are defined within their spaces with optional schemas and properties.

```typescript
const InvalidInput = SystemError({
    name: 'InvalidInput',
    schema: z.object({
        input: z.string(),
        details: z.string().optional()
    }),
    defaultMessage: 'Invalid input provided'
});

const BadPassword = Warning({
    name: 'BadPassword',
    defaultMessage: 'Password does not meet security requirements'
});
```

### Factory Functions

Errors are created using factory functions that validate against their schemas.

```typescript
// Valid usage
const invalidInputError = InvalidInput({
    input: 'invalid-email',
    details: 'Email format is incorrect'
});

// Invalid usage - will throw during development
const invalidError = InvalidInput({
    input: 123, // Type mismatch
    invalidProp: 'should not be here' // Unknown prop
});
```

## Error Creation and Raising

### raise() Function

The `raise()` function creates errors with additional context and composition capabilities.

```typescript
// Basic error creation
const userNotFound = raise(UserNotFound);
```

### Error Composition

Errors can be composed and chained to preserve context and provide rich information.

```typescript
const group = errorGroup({
    message: 'User authentication failed',
    errors: [InvalidEmail, InvalidPassword]
});

const finalError = raise(UserNotFound)
    .from(errorGroup)
    .addNote("The user could not be found because the email and password are incorrect")
    .addContext({ userId: '123', attemptCount: 3 });
```

## Error Handling with Result

### Multi-Type Results

The Result type supports multiple error types for explicit error handling.

```typescript
const user: Result<User, InvalidInput, BadPassword> = createUser({...});

// Type-safe error handling
user.match({
    onSuccess: (data) => {
        // User object is guaranteed to be User
        console.log('User created:', data.name);
    },
    onError: (error) => {
        // Error is typed as InvalidInput | BadPassword
        console.log('Error occurred:', error.message);
    }
});
```

### Nested Error Matching

Errors can be matched at different levels of specificity using nested match patterns.

```typescript
user.match({
    onSuccess: () => { /* ... */ },
    onError: ({ error }) => {
        error.match({
            // Handle by type
            isInvalidInput: (err) => {
                // err is typed as InvalidInput
                console.log('Invalid input:', err.input);
            },
            isBadPassword: (err) => {
                // err is typed as BadPassword
                console.log('Bad password issue');
            },
            // Handle by space
            isSystemError: (err) => {
                // Handle all system errors
                console.log('System error:', err.name);
            },
            isWarning: (err) => {
                // Handle all warnings
                console.log('Warning issued');
            },
            // Fallback for all other errors
            _: (err) => {
                // Handle any other error type
                console.log('Unknown error:', err.name);
            }
        });
    }
});
```

## Advanced Error Features

### Error Groups

Group multiple related errors together for complex validation scenarios.

```typescript
const formValidationErrors = errorGroup({
    message: 'Form validation failed',
    errors: [
        InvalidEmail({ email: 'invalid-email' }),
        InvalidPassword({ password: 'short' }),
        InvalidUsername({ username: 'user' })
    ],
    context: {
        formId: 'registration',
        timestamp: new Date()
    }
});
```

### Error Linking and Chaining

Create error chains that preserve the root cause while adding context.

```typescript
const databaseError = raise(DatabaseError)
    .from(validationErrors)
    .addNote('Database transaction failed due to validation errors')
    .addContext({ transactionId: 'tx123', retryCount: 2 });

const apiError = raise(APIError)
    .from(databaseError)
    .addNote('API request failed after database retry')
    .addContext({ endpoint: '/users', method: 'POST' });
```

### Severity-Based Handling

Errors can be handled based on their severity levels.

```typescript
apiError.match({
    onSuccess: () => { /* ... */ },
    onError: ({ error }) => {
        if (error.hasSeverity('critical')) {
            // Critical error handling
            alertAdmins(error);
        } else if (error.hasSeverity('warning')) {
            // Warning handling
            logWarning(error);
        } else {
            // Low severity handling
            logError(error);
        }
    }
});
```

## Integration with API Builders

### Mutation Error Handling

```typescript
const createUser = mutation({
    args: z.object({
        email: z.email(),
        password: z.string().min(8)
    }),
    handler: async (ctx, args): Promise<Result<User, InvalidEmail, InvalidPassword>> => {
        if (!isValidEmail(args.email)) {
            return failure(InvalidEmail({ email: args.email }));
        }

        if (!isValidPassword(args.password)) {
            return failure(InvalidPassword({
                password: args.password,
                requirements: 'Minimum 8 characters required'
            }));
        }

        const user = await db.user.create({ data: args });
        return success(user);
    }
});
```

### Event Listener Error Handling

```typescript
const onUserUpdate = eventListener({
    on: 'user:update',
    args: z.object({ user: z.infer(User) }),
    handler: async (ctx, event, args): Promise<Unit> => {
        try {
            await sendNotification(user, 'Profile updated');
            await auditLog.record(user.id, 'profile_update');
            return unit();
        } catch (error) {
            // Convert to structured error
            return raise(NotificationError)
                .addContext({ userId: user.id, eventType: 'update' })
                .addNote('Failed to send notification after user update');
        }
    }
});
```

### Query Error Handling

```typescript
const getUser = query({
    args: z.object({ id: z.string() }),
    handler: async (ctx, args): Promise<Maybe<User, UserNotFound>> => {
        const user = await db.user.findUnique({ where: { id: args.id } });

        if (!user) {
            return failure(UserNotFound({
                userId: args.id,
                suggestion: 'Check if the user ID is correct'
            }));
        }

        return some(user);
    }
});
```

## Error System Configuration

### Custom Error Spaces

```typescript
// Define your own error spaces
const ValidationError = errorSpace({
    name: 'validation',
    severity: 'medium',
    metadata: {
        category: 'business-logic',
        autoRetry: false
    }
});

const AuthenticationError = errorSpace({
    name: 'authentication',
    severity: 'high',
    metadata: {
        category: 'security',
        alertOnFirst: true
    }
});
```

### Global Error Handlers

```typescript
// Configure global error handling
const errorHandler = {
    onSystemError: (error: SystemError) => {
        // Critical system errors
        logCritical(error);
        alertDevTeam(error);
    },
    onValidationError: (error: ValidationError) => {
        // Business logic validation
        logWarning(error);
        reportToAnalytics(error);
    },
    onWarning: (error: Warning) => {
        // User-facing warnings
        logInfo(error);
        showUserWarning(error);
    }
};
```

## Best Practices

### 1. Error Space Organization

```typescript
// Good - Organized by domain
const Domain = errorSpace({ name: 'domain', severity: 'medium' });

const ValidationError = Domain({ name: 'ValidationError' });
const BusinessLogicError = Domain({ name: 'BusinessLogicError' });

// Avoid - Flat error structure
const Error1 = errorSpace({ name: 'Error1', severity: 'medium' });
const Error2 = errorSpace({ name: 'Error2', severity: 'medium' });
```

### 2. Schema Validation

```typescript
// Good - Detailed schema validation
const APIError = errorSpace({
    name: 'apiError',
    severity: 'high'
});

const InvalidRequest = APIError({
    name: 'InvalidRequest',
    schema: z.object({
        endpoint: z.string(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        timestamp: z.date()
    })
});

// Avoid - Generic errors without schema
const GenericError = APIError({
    name: 'GenericError',
    schema: z.object({}) // Too generic
});
```

### 3. Error Composition

```typescript
// Good - Preserve context in error chains
const dbError = raise(DatabaseError)
    .from(validationError)
    .addNote('Database constraint violation')
    .addContext({ table: 'users', constraint: 'email_unique' });

// Avoid - Losing context
const dbError = raise(DatabaseError('Database failed')); // Lost original error
```

### 4. Type-Specific Handling

```typescript
// Good - Handle specific error types
result.match({
    onSuccess: (data) => { /* ... */ },
    onError: (error) => {
        error.match({
            isNetworkError: (err) => retryOperation(),
            isValidationError: (err) => showFormErrors(err.errors),
            isTimeoutError: (err) => showTimeoutMessage(),
            _: (err) => logUnknownError(err)
        });
    }
});

// Avoid - Generic error handling
result.match({
    onSuccess: (data) => { /* ... */ },
    onError: (error) => {
        // Loses all specific error information
        console.log('An error occurred');
    }
});
```

## Performance Considerations

### Memory Usage

Complex error hierarchies use more memory due to the rich metadata and context preservation.

### Performance Optimization

```typescript
// Use simple errors for high-frequency scenarios
const HighFrequencyError = errorSpace({
    name: 'highFrequency',
    severity: 'low',
    // Minimal metadata for performance
    metadata: { lightweight: true }
});
```

### Development vs Production

The error system provides different levels of validation in development vs production environments.

```typescript
// Development - Full validation with helpful messages
const devError = InvalidInput({ input: 'invalid' }); // Detailed error

// Production - Optimized for performance
const prodError = InvalidInput({ input: 'invalid' }); // Minimal validation
```

## Testing Error Handling

### Error Testing Utilities

```typescript
// Test error creation
const testError = InvalidInput({ input: 'test' });

// Check error handling
const isHandled = testError.isHandledBy((error) => {
    return error.input === 'test';
});

// Test error composition
const testGroup = errorGroup({
    errors: [testError],
    message: 'Test group'
});
```

### Error Scenarios

```typescript
// Test successful path
test('user creation succeeds with valid data', async () => {
    const result = await createUser(validUserData);
    expect(result.isSuccess()).toBe(true);
});

// Test error paths
test('user creation fails with invalid email', async () => {
    const result = await createUser(invalidEmailData);
    expect(result.isError()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidEmail);
});
```

## Migration from Traditional Error Handling

### From Exceptions

```typescript
// Traditional try/catch
try {
    const user = await createUser(data);
    return user;
} catch (error) {
    return error;
}

// With Deesse error system
const result = await createUser(data);
return result.match({
    onSuccess: (user) => user,
    onError: (error) => {
        // Handle specific error types
        return null;
    }
});
```

### From Custom Error Classes

```typescript
// Traditional custom classes
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

// With error spaces
const ValidationError = errorSpace({
    name: 'validation',
    severity: 'medium'
});

const InvalidFormat = ValidationError({
    name: 'InvalidFormat',
    defaultMessage: 'Invalid format provided'
});
```

## Conclusion

The advanced error system provides a robust, type-safe, and flexible approach to error handling that goes beyond traditional patterns. It enables:

- **Hierarchical error organization**
- **Rich context preservation**
- **Type-safe error handling**
- **Flexible error composition**
- **Operational awareness through severity levels**

This system significantly improves developer experience by making error handling explicit, type-safe, and self-documenting while providing the flexibility to handle complex error scenarios that arise in real-world applications.