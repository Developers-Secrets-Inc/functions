**Rule — Do not use the `function` keyword; always declare functions with `const`**

The agent must never declare functions using the `function` keyword.
All functions must be created using **`const name = (args) => { ... }`** or **`const name = (args) => expression`**, ensuring consistency, immutability, and referential clarity.

---

**Allowed**

Arrow functions with `const`:

```ts
const add = (a: number, b: number): number => {
  return a + b
}

const isEven = (n: number): boolean => n % 2 === 0

const toUpper = (s: string) => s.toUpperCase()
```

Point-free style allowed:

```ts
const double = (x: number) => x * 2
```

---

**Forbidden**

Function keyword (declaration or expression):

```ts
function add(a: number, b: number) {  // ❌
  return a + b
}

const multiply = function (a: number, b: number) {  // ❌
  return a * b
}

async function loadStuff() {  // ❌
  // ...
}
```