# GET METHODS

## 1. Basic GET

```ts
const query: StructuredQuery = {
  table: "users",
  select: "*",
  type: "GET",
};
```

## 2. GET With Field Selection

```ts
const query: StructuredQuery = {
  table: "users",
  type: "GET",
  select: ["id", "email", "created_at"],
};
```



## 3. Simple WHERE

```ts
const query: StructuredQuery = {
  table: "users",
  type: "GET",
  select: "*",
  where: {
    field: "email",
    operator: "=",
    value: "john@example.com",
  },
};
```



## 4. Multiple AND Conditions

```ts
const query: StructuredQuery = {
  table: "users",
  type: "GET",
  select: "*",
  where: {
    and: [
      {
        field: "verified",
        operator: "=",
        value: true,
      },
      {
        field: "age",
        operator: ">=",
        value: 18,
      },
    ],
  },
};
```



## 5. Nested AND / OR

```ts
const query: StructuredQuery = {
  table: "users",
  select: "*",
  type: "GET",
  where: {
    and: [
      {
        field: "active",
        operator: "=",
        value: true,
      },
      {
        or: [
          {
            field: "role",
            operator: "=",
            value: "admin",
          },
          {
            field: "role",
            operator: "=",
            value: "moderator",
          },
        ],
      },
    ],
  },
};
```



## 6. NOT Condition

```ts
const query: StructuredQuery = {
  table: "users",
  select: "*",
  type: "GET",
  where: {
    not: {
      field: "banned",
      operator: "=",
      value: true,
    },
  },
};
```



## 7. BETWEEN

```ts
const query: StructuredQuery = {
  table: "orders",
  type: "GET",
  select: "*",
  where: {
    field: "total",
    operator: "BETWEEN",
    start: 100,
    end: 500,
  },
};
```



## 8. IN Operator

```ts
const query: StructuredQuery = {
  table: "users",
  type: "GET",
  select: "*",
  where: {
    field: "role",
    operator: "IN",
    value: ["admin", "editor", "staff"],
  },
};
```



## 9. Subquery IN

```ts
const query: StructuredQuery = {
  table: "users",
  select: "*",
  type: "GET",
  where: {
    field: "id",
    operator: "IN",
    value: {
      select: "user_id",
      from: "orders",
      where: {
        field: "status",
        operator: "=",
        value: "completed",
      },
    },
  },
};
```



## 10. EXISTS Query

```ts
const query: StructuredQuery = {
  table: "users",
  select: "*",
  type: "GET",
  where: {
    operator: "EXISTS",
    query: {
      select: "id",
      from: "orders",
      where: {
        field: "orders.user_id",
        operator: "=",
        value: "$col:id",
      },
    },
  },
};
```



## 11. NOT EXISTS

```ts
const query: StructuredQuery = {
  table: "users",
  type: "GET",
  select: "*",
  where: {
    operator: "NOT EXISTS",
    query: {
      select: "id",
      from: "sessions",
      where: {
        field: "sessions.user_id",
        operator: "=",
        value: "$col.id",
      },
    },
  },
};
```



## 12. LEFT JOIN

```ts
const query: StructuredQuery = {
  table: "orders",
  type: "GET",
  select: "*",
  join: [
    {
      table: "users",
      type: "LEFT",
      on: {
        "orders.user_id": "users.id",
      },
    },
  ],
};
```



## 13. Complex JOIN Condition

```ts
const query: StructuredQuery = {
  table: "orders",
  type: "GET",
  select: "*",
  join: [
    {
      table: "payments",
      type: "INNER",
      on: {
        and: [
          {
            field: "orders.id",
            operator: "=",
            value: "$col.payments.order_id",
          },
          {
            field: "payments.status",
            operator: "=",
            value: "paid",
          },
        ],
      },
    },
  ],
};
```



## 14. GROUP BY + ORDER BY

```ts
const query: StructuredQuery = {
  table: "orders",
  type: "GET",
  select: "*",
  select: [
    "user_id",
    "$count.total_orders"
  ],
  group_by: ["user_id"],
  order_by: ["$desc.revenue"],
};
```



## 15. Pagination Style Query

```ts
const query: StructuredQuery = {
  table: "posts",
  type: "GET",
  select: "*",
  where: {
    field: "id",
    operator: ">",
    value: 100,
  },
  order_by: ["$asc.id"],
  limit: 25,
};
```
