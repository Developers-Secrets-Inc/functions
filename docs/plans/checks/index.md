# Check System

## Overview

The Check system provides a sophisticated, type-safe authorization and permission validation framework for the Deesse API. Built with functional programming principles, it enables developers to create reusable, composable authorization checks that integrate seamlessly with API builders.

## Core Concepts

### Check Type Definition

The Check type uses a functional currying pattern to create reusable authorization functions:

```typescript
type Check<
  TArgs extends ZodTypeAny = ZodTypeAny,
  TError extends CheckError = CheckError
> = ({
  args: TArgs
  handler: (ctx: Context, args: z.infer<TArgs>) => CheckResult
}) => (ctx: Context, args: z.infer<TArgs>) => CheckResult
```

### CheckResult

CheckResult uses Unit to represent successful authorization and CheckError for authorization failures:

```typescript
type CheckResult = AsyncResult<Unit, CheckError>

// Result has the same methods as all Result types
const result: CheckResult = await someCheck();

result.match({
    onSuccess: () => {
        // Authorization passed
    },
    onError: ({ error }) => {
        // Authorization failed
        console.log('Access denied:', error.message);
    }
});

// Simple boolean check
if (result.isSuccess()) {
    // User has permission
}
```

### CheckError Space

Authorization errors are defined within the CheckError space:

```typescript
const CheckError = errorSpace({
    name: 'CheckError',
    severity: 'critical'
});

// Define specific authorization errors
const UnauthorizedError = CheckError({
    name: 'UnauthorizedError',
    defaultMessage: 'Access denied: insufficient permissions'
});

const ForbiddenError = CheckError({
    name: 'ForbiddenError',
    defaultMessage: 'Access denied: forbidden by policy'
});
```

## Creating Checks

### Basic Check Creation

Checks are created using the `check` factory function:

```typescript
const isAdmin: Check = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args): CheckResult => {
        const user = await db.user.findUnique({
            where: { id: args.userId }
        });

        return user?.role === 'admin'
            ? success(unit())
            : failure(new UnauthorizedError('Not an admin'));
    }
});
```

### Check with Context

Access the request context for additional information:

```typescript
const isPostAuthor = check({
    args: z.object({ postId: z.string() }),
    handler: async (ctx, args): CheckResult => {
        const post = await db.post.findUnique({
            where: { id: args.postId }
        });

        if (!post) {
            return failure(new PostNotFoundError({ postId: args.postId }));
        }

        ctx contains the authenticated user and request metadata
        return ctx.user?.id === post.authorId
            ? success(unit())
            : failure(new NotAuthorError({
                postId: args.postId,
                authorId: post.authorId,
                userId: ctx.user?.id
            }));
    }
});
```

### Reusable Check Composition

Create complex checks by combining simpler ones:

```typescript
// Base checks
const hasVerifiedEmail = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args) => {
        const user = await db.user.findUnique({ where: { id: args.userId } });
        return user?.emailVerified
            ? success(unit())
            : failure(new EmailNotVerifiedError());
    }
});

// Department-specific check
const isSameDepartment = check({
    args: z.object({ targetUserId: z.uuid() }),
    handler: async (ctx, args) => {
        const currentUser = await db.user.findUnique({
            where: { id: ctx.user!.id }
        });
        const targetUser = await db.user.findUnique({
            where: { id: args.targetUserId }
        });

        return currentUser?.department === targetUser?.department
            ? success(unit())
            : failure(new DifferentDepartmentError());
    }
});
```

## Check Composition

### checkAny - OR Logic

Returns success if ANY check in the array passes:

```typescript
const result: CheckResult = await checkAny([isAdmin, isEditor, isModerator]);

// Equivalent to: isAdmin OR isEditor OR isModerator

const canEdit = checkAny([
    check({
        args: z.object({ userId: z.uuid() }),
        handler: async (ctx, args) => {
            const user = await db.user.findUnique({ where: { id: args.userId } });
            return user?.role === 'editor' ? success(unit()) : failure(new UnauthorizedError());
        }
    }),
    check({
        args: z.object({ userId: z.uuid() }),
        handler: async (ctx, args) => {
            const user = await db.user.findUnique({ where: { id: args.userId } });
            return user?.role === 'moderator' ? success(unit()) : failure(new UnauthorizedError());
        }
    })
]);
```

### checkAll - AND Logic

Returns success only if ALL checks pass:

```typescript
const result: CheckResult = await checkAll([hasVerifiedEmail, hasTermsAccepted]);

// Equivalent to: hasVerifiedEmail AND hasTermsAccepted

const canRegister = checkAll([
    check({
        args: z.object({ userId: z.uuid() }),
        handler: async (ctx, args) => {
            const user = await db.user.findUnique({ where: { id: args.userId } });
            return user?.emailVerified ? success(unit()) : failure(new EmailNotVerifiedError());
        }
    }),
    check({
        args: z.object({ userId: z.uuid() }),
        handler: async (ctx, args) => {
            const user = await db.user.findUnique({ where: { id: args.userId } });
            return user?.termsAccepted ? success(unit()) : failure(new TermsNotAcceptedError());
        }
    })
]);
```

### Complex Composition

Combine checkAny and checkAll for sophisticated authorization:

```typescript
// Admin OR (Manager AND Same Department)
const canManageUser = checkAny([
    isAdmin,
    checkAll([
        isManager,
        isSameDepartment
    ])
]);

// Verified AND (Not Banned OR Is Admin)
const canUseFeature = checkAll([
    hasVerifiedEmail,
    checkAny([
        isNotBanned,
        isAdmin
    ])
]);
```

## API Builder Integration

### Query Authorization

```typescript
const getUser = query({
    args: z.object({ id: z.string() }),
    handler: async (ctx, args) => {
        const user = await db.user.findUnique({ where: { id: args.id } });
        return user ? some(user) : none<User>();
    },
    checks: [
        // User can access their own data OR is admin
        isOwnUser.or(isAdmin)
    ]
});
```

### Mutation Authorization

```typescript
const updateUser = mutation({
    args: z.object({
        id: z.string(),
        data: z.object({
            name: z.string().optional(),
            email: z.email().optional()
        })
    }),
    handler: async (ctx, args) => {
        const user = await db.user.update({
            where: { id: args.id },
            data: args.data
        });
        return success(user);
    },
    checks: checkAll([
        // Must be admin AND user must exist
        isAdmin,
        isUserExists
    ])
});
```

### Event Listener Authorization

```typescript
const onUserUpdate = eventListener({
    on: 'user:update',
    args: z.object({ user: z.infer(User) }),
    handler: async (ctx, event, args) => {
        await sendNotification(user, 'Profile updated');
        await auditLog.record(user.id, 'profile_update');
        return unit();
    },
    checks: [
        // Must be admin or the user themselves
        isAdmin.or(isOwnUser)
    ]
});
```

### Check Chain Methods

API builders provide convenient methods for check composition:

```typescript
// .or() - checkAny equivalent
isPostAuthor.or(isAdmin)

// .and() - checkAll equivalent
isPostAuthor.and(isContentModerator)

// .not() - invert check
isPostAuthor.not(isBanned)

// Complex chains
isAdmin.or(isEditor.and(isSameDepartment))
```

## Advanced Check Patterns

### Dynamic Arguments

```typescript
const canAccessResource = check({
    args: z.object({
        userId: z.uuid(),
        resourceId: z.string(),
        resourceType: z.enum(['post', 'comment', 'user'])
    }),
    handler: async (ctx, args): CheckResult => {
        switch (args.resourceType) {
            case 'post':
                return canAccessPost(ctx, { postId: args.resourceId });
            case 'comment':
                return canAccessComment(ctx, { commentId: args.resourceId });
            case 'user':
                return canAccessUser(ctx, { userId: args.resourceId });
            default:
                return failure(new InvalidResourceTypeError());
        }
    }
});
```

### Caching Expensive Checks

```typescript
const getUserPermissions = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args): CheckResult => {
        // Expensive database lookup
        const permissions = await getUserPermissionsFromDB(args.userId);
        return success(unit());
    },
    // Hypothetical cache configuration
    cache: {
        key: (args) => `permissions:${args.userId}`,
        ttl: 300 // 5 minutes
    }
});
```

### Check with Context Enrichment

```typescript
const rateLimitCheck = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args): CheckResult => {
        const recentRequests = await db.requestLog.count({
            where: {
                userId: args.userId,
                createdAt: { gte: new Date(Date.now() - 60000) }
            }
        });

        if (recentRequests > 100) {
            return failure(new RateLimitExceededError({
                userId: args.userId,
                retryAfter: 60
            }));
        }

        return success(unit());
    }
});
```

## Best Practices

### 1. Check Organization

```typescript
// Organize checks by domain
const authChecks = {
    isAdmin: check({ /* ... */ }),
    isOwner: check({ /* ... */ }),
    isAuthenticated: check({ /* ... */ })
};

const permissionChecks = {
    canEditPost: check({ /* ... */ }),
    canDeleteComment: check({ /* ... */ }),
    canManageUsers: check({ /* ... */ })
};

// Use in API builders
const getPost = query({
    ...,
    checks: [
        authChecks.isAuthenticated,
        permissionChecks.canEditPost
    ]
});
```

### 2. Error Context Enhancement

```typescript
// Provide rich error context
const isPostEditable = check({
    args: z.object({ postId: z.string() }),
    handler: async (ctx, args): CheckResult => {
        const post = await db.post.findUnique({ where: { id: args.postId } });

        if (post?.isArchived) {
            return failure(new PostArchivedError({
                postId: args.postId,
                archivedAt: post.archivedAt,
                suggestion: 'Contact admin to restore archive'
            }));
        }

        if (post?.isLocked) {
            return failure(new PostLockedError({
                postId: args.postId,
                lockedBy: post.lockedBy,
                lockedAt: post.lockedAt
            }));
        }

        return success(unit());
    }
});
```

### 3. Check Reusability

```typescript
// Create reusable base checks
const resourceOwnerCheck = <T extends { id: string; authorId: string }>(
    getModel: (id: string) => Promise<T>
) => check({
    args: z.object({ resourceId: z.string() }),
    handler: async (ctx, args): CheckResult => {
        const resource = await getModel(args.resourceId);

        return ctx.user?.id === resource.authorId
            ? success(unit())
            : failure(new NotOwnerError({
                resourceId: args.resourceId,
                ownerId: resource.authorId,
                userId: ctx.user?.id
            }));
    }
});

// Use with different models
const isPostOwner = resourceOwnerCheck((id) => db.post.findUnique({ where: { id } }));
const isCommentOwner = resourceOwnerCheck((id) => db.comment.findUnique({ where: { id } }));
```

### 4. Performance Optimization

```typescript
// Use checkAll for short-circuiting critical checks
const expensiveCheck = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args): CheckResult => {
        // Expensive operation
        return success(unit());
    }
});

const cheapCheck = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args): CheckResult => {
        // Cheap operation - check first for performance
        return success(unit());
    }
});

// CheckAll will fail fast on cheapCheck failure
const criticalOperation = checkAll([cheapCheck, expensiveCheck]);
```

## Testing Check System

### Unit Testing Individual Checks

```typescript
test('isAdmin check passes for admin users', async () => {
    const check = createAdminCheck();
    const result = await check(mockCtx({ role: 'admin' }), { userId: '123' });

    expect(result.isSuccess()).toBe(true);
});

test('isAdmin check fails for regular users', async () => {
    const check = createAdminCheck();
    const result = await check(mockCtx({ role: 'user' }), { userId: '123' });

    expect(result.isError()).toBe(true);
    expect(result.value.error.name).toBe('UnauthorizedError');
});
```

### Testing API Builder Integration

```typescript
test('query runs checks before execution', async () => {
    const getUser = query({
        args: z.object({ id: z.string() }),
        handler: async (ctx, args) => some({ id: args.id }),
        checks: [mockCheck]
    });

    // Check passes
    let result = await getUser({ id: '123' }, mockCtxWithPermission);
    expect(result.isSuccess()).toBe(true);

    // Check fails
    result = await getUser({ id: '123' }, mockCtxWithoutPermission);
    expect(result.isError()).toBe(true);
});
```

### Testing Check Composition

```typescript
test('checkAny passes when any check succeeds', async () => {
    const check1 = createCheck(() => failure(new UnauthorizedError()));
    const check2 = createCheck(() => success(unit()));
    const check3 = createCheck(() => failure(new UnauthorizedError()));

    const result = await checkAny([check1, check2, check3]);
    expect(result.isSuccess()).toBe(true);
});

test('checkAll fails when any check fails', async () => {
    const check1 = createCheck(() => success(unit()));
    const check2 = createCheck(() => failure(new UnauthorizedError()));
    const check3 = createCheck(() => success(unit()));

    const result = await checkAll([check1, check2, check3]);
    expect(result.isError()).toBe(true);
});
```

## Migration from Traditional Authorization

### From Middleware Functions

```typescript
// Traditional middleware
function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
}

// With Check system
const requireAdmin = check({
    args: z.object({ userId: z.uuid() }),
    handler: async (ctx, args) => {
        return ctx.user?.isAdmin ? success(unit()) : failure(new UnauthorizedError());
    }
});
```

### From Service Methods

```typescript
// Traditional service method
async function canEditPost(userId, postId) {
    const user = await db.user.findUnique({ where: { id: userId } });
    const post = await db.post.findUnique({ where: { id: postId } });

    return user?.role === 'admin' || user?.id === post?.authorId;
}

// With Check system
const canEditPost = check({
    args: z.object({ postId: z.string() }),
    handler: async (ctx, args) => {
        const user = ctx.user;
        const post = await db.post.findUnique({ where: { id: args.postId } });

        if (!user || !post) return failure(new UnauthorizedError());

        return user.role === 'admin' || user.id === post.authorId
            ? success(unit())
            : failure(new UnauthorizedError());
    }
});
```

## Conclusion

The Check system provides a sophisticated, type-safe authorization framework that makes permission validation explicit, reusable, and composable. Key benefits include:

- **Type Safety**: All authorization logic is strongly typed at compile time
- **Reusability**: Checks can be defined once and used across multiple API endpoints
- **Composability**: Complex authorization scenarios can be built from simple checks
- **Integration**: Seamless integration with API builders through declarative syntax
- **Error Handling**: Rich error context and consistent error handling patterns
- **Performance**: Optimized for performance with short-circuiting and caching support

This system represents a significant improvement over traditional authorization approaches, providing developers with a powerful yet intuitive way to implement complex permission logic in their applications.