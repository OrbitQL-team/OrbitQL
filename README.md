# Cerberus

# Policy-Driven SQL Handler

A declarative, database-level authorization and query engine that combines:

* Role-based access control
* Field-level permissions
* Row-level filtering
* Payload-aware validation
* Conditional logic (IF / AND / OR)
* Dynamic joins
* Workflow/state transition enforcement

This project compiles structured request definitions into **safe SQL queries**, enforcing complex business rules directly at the database level.

---

## ✨ Features

### 1. Declarative Authorization DSL

Define permissions using structured JSON instead of imperative code.

Supports:

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

Unlike traditional RLS systems, this engine can validate **incoming mutation data**.

Example:

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

Compare:

* Existing row values
* Incoming mutation payload
* User/session data

Example use cases:

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

Generates SQL similar to:

```sql
SELECT guest_code.*, users.email
FROM guest_code
INNER JOIN users
  ON guest_code.user_id = users.id
```

All joins and filters are validated and secured.

---

### 6. Row-Level Enforcement in SQL

Rules compile into SQL `WHERE` clauses and joins:

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

Per role, per operation.

Example:

```ts
allowed: {
  field: ["type", "hours_worked"],
  where: {...}
},
disallowed: ["id", "user_id"]
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

The handler:

1. Parses structured request input
2. Applies role-based policies
3. Injects row-level conditions
4. Validates payload constraints
5. Generates final SQL query
6. Executes safely

---

## 🚀 Why This Exists

Traditional solutions:

* Database RLS → Cannot inspect payload
* GraphQL permission engines → Limited conditional logic
* Middleware RBAC → Often evaluated outside SQL

This engine enables:

* Payload-aware authorization
* Business workflow validation
* Join-aware access control
* Declarative rule definition
* Centralized policy enforcement

---

## ⚖️ Comparison to GraphQL Engines (e.g., Hasura)

| Capability              | This Project | Typical GraphQL Engine |
| ----------------------- | ------------ | ---------------------- |
| Payload-aware rules     | ✅            | ❌                      |
| State transition checks | ✅            | ❌                      |
| Conditional IF logic    | ✅            | ❌                      |
| Dynamic joins           | ✅            | Limited                |
| SQL-level enforcement   | ✅            | ✅                      |
| GUI / metadata tooling  | ⚠️ Coming in the future as SaaS          | ✅                      |

---

## 🛡 Security Model

* All queries are compiled through policy rules.
* Field access is explicitly controlled.
* Row filters are injected at SQL level.
* Payload comparisons prevent illegal state transitions.

Security depends on:

* All database access going through the handler.
* No raw SQL bypass routes.

---

## 📦 Example Use Cases

* Attendance tracking systems
* Approval workflows
* Multi-role SaaS backends
* Business-rule-heavy APIs
* Systems requiring state transition validation

---

## 📄 License

Specify your license here.
