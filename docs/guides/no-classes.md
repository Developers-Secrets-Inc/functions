**Rule — No classes; only functions and types (with architectural validation)**

The agent must never use `class` declarations.
All behavior must be expressed using **pure functions**, **data as plain objects**, and **type aliases** for structure.

Before adding a function directly onto a JavaScript object (a method-like property), the agent must first validate that this addition fits the global architecture and does not introduce accidental coupling or implicit state.

---

**Allowed**

Pure functions operating on data:

```ts
type User = {
  id: string
  name: string
}

type RenameUserInput = {
  user: User
  newName: string
}

const renameUser = (input: RenameUserInput): User => ({
  ...input.user,
  name: input.newName
})
```

Using objects as **data only**:

```ts
type Vector2 = {
  x: number
  y: number
}

const add = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x + b.x,
  y: a.y + b.y
})
```

---

**Forbidden**

Using classes:

```ts
class User {
  constructor(public id: string, public name: string) {}
  rename(newName: string) {
    this.name = newName
  }
}
```

Adding methods onto objects without architectural approval:

```ts
// Forbidden unless explicitly validated in architecture.
const user = { id: "1", name: "Alice" }
user.rename = function (newName) {  // ❌ implicit mutation, tight coupling
  this.name = newName
}
```