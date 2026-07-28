# OrbitQL

## Policy-Driven SQL Handler

**OrbitQL** is a declarative, database-level authorization and query engine built on **Node.js**. It combines:

* Role-based access control
* Field-level permissions
* Row-level filtering
* Payload-aware validation
* Conditional logic (IF / AND / OR)
* Dynamic joins
* Workflow/state transition enforcement

OrbitQL compiles structured request definitions into **safe SQL queries**, enforcing complex business rules directly at the database level.

---

## ✨ Features

### 1. Declarative Authorization DSL

Define permissions using structured JSON instead of imperative code. Supports:

* `AND` / `OR`
* Conditional `IF / ELSE`
* Subqueries
* Session variables (`$user`)
* Payload references (`$data`)

---

### 2. Role-Based Access Control (RBAC)

Per-role configuration:

```ts
{
  type: "PUT",
  user: { allowed: {...}, disallowed: [...] },
  admin: ALL,
  guest: NONE
}
```

Roles can define:

* Allowed fields
* Disallowed fields
* Row-level constraints
* Operation restrictions

---

### 3. Payload-Aware Validation

Unlike traditional RLS systems, OrbitQL can validate **incoming mutation data**:

```ts
{
  type: "IF",
  when: {
    left_value: "$data.attendances.type",
    operator: "IS NOT",
    value: null
  },
  do: put_type,
  else: true
}
```

Enables rules such as:

* Only allow updates if new value matches previous state
* Validate transitions
* Restrict changes conditionally

---

### 4. State Transition Enforcement

OrbitQL compares:

* Existing row values
* Incoming mutation payload
* User/session data

Use cases:

* Workflow progression validation
* Attendance state changes
* Approval chains
* Business rule enforcement

---

### 5. Dynamic Query Builder

Supports structured query definitions:

```ts
{
  table: "guest_code",
  type: "GET",
  select: [
    "guest_code.*",
    "users.email"
  ],
  join: [
    {
      table: "users",
      on: { "guest_code.user_id": "users.id" },
      type: "INNER"
    }
  ]
}
```

Generates SQL:

```sql
SELECT guest_code.*, users.email
FROM guest_code
INNER JOIN users
  ON guest_code.user_id = users.id
```

All joins and filters are validated and secured.

---

### 6. Row-Level Enforcement in SQL

Rules compile directly into SQL `WHERE` clauses and joins:

* No post-filtering
* No in-memory filtering
* Enforcement happens inside the database
* Reduces bypass risk

---

### 7. Field-Level Control

Define which fields can be:

* Selected
* Inserted
* Updated

Per role, per operation:

```ts
allowed: {
  field: ["type", "hours_worked"],
  where: {...}
},
disallowed: ["id", "user_id"]
```

---

## 📥 Request Structure

OrbitQL accepts a `Request` object that describes the query or transaction to execute.

### Request type

A request can be either:

* a single `StructuredQuery`
* a batch of query phases: `{ phases: QueryPhase[] }`

A phase is defined as:

```ts
export type QueryPhase = {
  mode: "QUERY" | "TRANSACTION";
  queries: StructuredQuery[];
};
```

* `QUERY` runs each query independently and returns all results.
* `TRANSACTION` runs the phase inside a database transaction, so all queries succeed or fail together.

### StructuredQuery shape

```ts
export type StructuredQuery = {
  table: keyof Structure;
  type: "GET" | "PUT" | "POST" | "DELETE";
  select?: string[] | string;
  join?: Join[];
  where?: WhereCondition;
  data?: Record<string, any> | Record<string, any>[];
  group_by?: string[] | string;
  order_by?: string[] | string;
  returning?: string[] | string;
  limit?: number;
};
```

Field meanings:

* `table` — the name of the table in the structure schema.
* `type` — the HTTP-like operation type used to select the endpoint definition.
* `select` — columns or expressions to return for `GET` requests.
* `join` — join definitions to include related tables.
* `where` — row-level filtering and permission checks.
* `data` — payload for `PUT`, `POST`, or mutation requests.
* `group_by` / `order_by` — grouping and ordering controls.
* `returning` — columns to return after mutating rows.
* `limit` — maximum number of rows to affect or return.

### Join definition

```ts
export type Join = {
  table: keyof Structure;
  type: "INNER" | "LEFT";
  on: Record<string, string> | WhereCondition;
};
```

The `on` clause can be either a simple column mapping, such as:

```ts
{ "guest_code.user_id": "users.id" }
```

or a more complex `WhereCondition`.

### Where condition types

OrbitQL supports rich condition expressions.

#### Simple conditions

```ts
{
  field: "status",
  operator: "=",
  value: "active"
}
```

Supported operators include:

* `=`, `!=`, `<`, `<=`, `>`, `>=`
* `LIKE`, `NOT LIKE`, `ILIKE`, `NOT ILIKE`
* `IS`, `IS NOT`, `IS NULL`, `IS NOT NULL`
* `IN`, `NOT IN`, `BETWEEN`, `NOT BETWEEN`

#### Nested logic

```ts
{
  and: [
    { field: "role", operator: "=", value: "admin" },
    { or: [
        { field: "status", operator: "=", value: "pending" },
        { field: "status", operator: "=", value: "approved" }
      ]
    }
  ]
}
```

#### Conditional IF

```ts
{
  if: {
    when: { field: "priority", operator: ">", value: 5 },
    do: { field: "approved", operator: "=", value: true },
    else: { field: "approved", operator: "=", value: false }
  }
}
```

#### Exists / Not Exists

```ts
{
  operator: "EXISTS",
  query: {
    select: "id",
    from: "approvals",
    where: { field: "approvals.request_id", operator: "=", value: { left_value: "id" } }
  }
}
```

#### Subquery IN

```ts
{
  field: "user_id",
  operator: "IN",
  value: {
    select: "id",
    from: "users",
    where: { field: "active", operator: "=", value: true }
  }
}
```

### Example: single GET request

```ts
{
  table: "guest_code",
  type: "GET",
  select: ["guest_code.*", "users.email"],
  join: [
    {
      table: "users",
      type: "INNER",
      on: { "guest_code.user_id": "users.id" }
    }
  ],
  where: {
    field: "guest_code.active",
    operator: "=",
    value: true
  },
  order_by: ["guest_code.created_at DESC"],
  limit: 50
}
```

### Example: transaction request

```ts
{
  phases: [
    {
      mode: "TRANSACTION",
      queries: [
        {
          table: "orders",
          type: "POST",
          data: { customer_id: 123, total: 49.99 }
        },
        {
          table: "inventory",
          type: "PUT",
          data: [{ id: 456, stock: 10 }]
        }
      ]
    }
  ]
}
```

---

## 🧠 Architecture

```
API Request
     ↓
Policy Handler (DSL Evaluation)
     ↓
SQL Query Builder
     ↓
Database
```

Handler steps:

1. Parses structured request input
2. Applies role-based policies
3. Injects row-level conditions
4. Validates payload constraints
5. Generates final SQL query
6. Executes safely

---

## 🚀 Why OrbitQL Exists

Traditional solutions:

* Database RLS → Cannot inspect payload
* GraphQL permission engines → Limited conditional logic
* Middleware RBAC → Often evaluated outside SQL

OrbitQL enables:

* Payload-aware authorization
* Business workflow validation
* Join-aware access control
* Declarative rule definition
* Centralized policy enforcement

---

## ⚖️ Comparison to GraphQL Engines (e.g., Hasura)

| Capability              | OrbitQL                  | Typical GraphQL Engine |
| ----------------------- | ------------------------ | ---------------------- |
| Payload-aware rules     | ✅                        | ❌                      |
| State transition checks | ✅                        | ❌                      |
| Conditional IF logic    | ✅                        | ❌                      |
| Dynamic joins           | ✅                        | Limited                |
| SQL-level enforcement   | ✅                        | ✅                      |
| GUI / metadata tooling  | ⚠️ Coming in future SaaS | ✅                      |

---

## 🛡 Security Model

* All queries are compiled through policy rules
* Field access is explicitly controlled
* Row filters are injected at SQL level
* Payload comparisons prevent illegal state transitions

Security relies on **all database access going through the handler** and no raw SQL bypass routes.

---

## 📦 Example Use Cases

* Attendance tracking systems
* Approval workflows
* Multi-role SaaS backends
* Business-rule-heavy APIs
* Systems requiring state transition validation

---

## 👥 Who We Are

We are a small team of three:

* Two software engineers focused on backend architecture, database systems, and API infrastructure
* One commercial specialist focused on product strategy, business development, and market positioning

Our goal is to simplify complex backend problems while remaining secure, scalable, and easy to integrate.

---

## 🎯 What We Built OrbitQL For

OrbitQL addresses recurring problems in API development:

* Scattered authorization logic across application code
* Difficulty enforcing complex business rules at the database level
* Lack of payload-aware authorization in most RBAC/RLS systems
* Fragile APIs with hard-to-maintain rules

OrbitQL centralizes **authorization and validation logic** in a declarative format, making APIs:

* More stable
* Safer
* Easier to modify
* More maintainable

---

## 🔮 Future Plans

OrbitQL will evolve into a **SaaS platform** with:

* Policy management interface
* API integration tooling
* Authorization visualization
* Query and rule debugging tools

**Subscription model:**

* Free tier for experimentation
* Developer plans for startups and indie builders
* Advanced plans for production SaaS applications

**Open-source code:** OrbitQL is fully open source and self-hostable. Users may modify and host the project freely, but it **cannot be used to create a commercial SaaS replicating OrbitQL functionality**.

---

## 💬 Community & Feedback

We value feedback on:

* Architecture decisions
* Policy DSL design
* Real-world use cases
* Missing features

Your input will help shape OrbitQL’s future.

---

## 📄 License

[License](https://github.com/Zucchy00/Cerberus/blob/main/LICENSE)
