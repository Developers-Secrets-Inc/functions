**Rule — No interfaces, only type-driven programming**

The agent must never use `interface` declarations.
All structural modelling must use **type aliases** (`type`) and functional type constructs.

**Allowed**

```ts
type User = {
  id: string
  name: string
}

type WithTimestamps<T> = T & {
  createdAt: Date
  updatedAt: Date
}
```

**Forbidden**

```ts
interface User {
  id: string
  name: string
}

interface WithTimestamps<T> {
  createdAt: Date
  updatedAt: Date
}
```

**More advanced allowed patterns**

```ts
type Result<T> = 
  | { ok: true; value: T }
  | { ok: false; error: string }

type Entity<T> = T & { id: string }
```