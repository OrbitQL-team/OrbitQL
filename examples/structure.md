# Complete Structure Examples (Full DSL Coverage)

This document demonstrates the **full capability surface** of the structure system:

- endpoints
- roles
- allow/disallow semantics
- conditional field access
- triggers
- runtime variables
- limits
- returning
- row-level constraints

---

# 1. Minimal Structure

```ts
export default {
  users: {
    table: "users",

    endpoints: [
      {
        type: "GET",

        user: {
          allow: ["id", "name", "email"],
          disallowed: [],
        },
      },
    ],
  },
};
```

---

# 2. Wildcard Access

```ts
{
  user: {
    allow: "*",
    disallowed: [],
  },
}
```

---

# 3. Simple Role Split (User vs Admin)

```ts
{
  user: {
    allow: ["id", "name", "email"],
    disallowed: ["role"],
  },

  admin: {
    allow: "*",
    disallowed: [],
  },
}
```

---

# 4. Field-Level Deny Override

```ts
{
  user: {
    allow: "*",
    disallowed: ["password", "secret_key"],
  },
}
```

---

# 5. Conditional Allowed Fields

```ts
{
  user: {
    allow: {
      field: ["salary"],

      where: {
        field: "department",
        op: "=",
        value: "finance",
      },
    },

    disallowed: [],
  },
}
```

---

# 6. Conditional Wildcard Allow

```ts
{
  admin: {
    allow: {
      field: "*",

      where: {
        left_value: "$user.have_access",
        op: "=",
        value: 1,
      },
    },

    disallowed: [],
  },
}
```

---

# 7. Complex WHERE (Multi-condition field gating)

```ts
{
  user: {
    allow: {
      field: ["name", "surname"],

      where: {
        and: [
          {
            field: "id",
            op: "=",
            value: "$user.id",
          },

          {
            left_value: "$user.have_access",
            op: "=",
            value: 1,
          },

          {
            if: {
              when: {
                value: "$data.name",
                op: "IS NOT NULL",
              },
              do: true,
              else: false,
            },
          },
        ],
      },
    },

    disallowed: ["*"],
  },
}
```

---

# 8. Role-Based Limits + Ordering

```ts
{
  public: {
    allow: ["id", "name"],

    limit: 10,

    order_by: ["$desc.created_at"],
  },

  premium: {
    allow: "*",
    limit: 100,
    order_by: ["$desc.created_at"],
  },
}
```

---

# 9. Returning Control

```ts
{
  user: {
    allow: ["id", "email"],

    returning: true,
  },

  admin: {
    allow: "*",
    returning: true,
  },
}
```

---

# 10. Endpoint GET Full Example

```ts
{
  type: "GET",

  user: {
    allow: ["id", "name", "email", "surname"],
    disallowed: ["role"],
  },

  admin: {
    allow: {
      field: "*",
      where: {
        left_value: "$user.have_access",
        op: "=",
        value: 1,
      },
    },

    disallowed: "name",
    limit: 10,
  },
}
```

---

# 11. UPDATE with Strict Field Validation

```ts
{
  type: "PUT",

  user: {
    allow: {
      field: ["name", "surname"],

      where: {
        and: [
          {
            field: "id",
            op: "=",
            value: "$user.id",
          },

          {
            left_value: "$user.have_access",
            op: "=",
            value: 1,
          },
        ],
      },
    },

    disallowed: "*",
  },

  admin: {
    allow: "*",
    disallowed: [],
    returning: true,
  },
}
```

---

# 12. INSERT with Role Control

```ts
{
  type: "POST",

  user: {
    allow: [],
    disallowed: [],
  },

  admin: {
    allow: "*",
    returning: true,
  },
}
```

---

# 13. DELETE (Restricted)

```ts
{
  type: "DELETE",

  user: {
    allow: [],
    disallowed: [],
  },

  admin: {
    allow: "*",
    disallowed: "",
  },
}
```

---

# 14. BEFORE Triggers (Row Mutation)

```ts
{
  type: "POST",

  admin: {
    allow: "*",
  },

  triggers: [
    {
      type: "BEFORE",
      level: "ROW",

      query: {
        set: {
          field: "name",

          when: {
            field: "name",
            op: "IS NULL",
          },

          value: "default_name",
        },
      },
    },

    {
      type: "BEFORE",
      level: "ROW",

      query: {
        set: {
          field: "surname",

          when: {
            field: "surname",
            op: "IS NULL",
          },

          value: "default_surname",
        },
      },
    },
  ],
}
```

---

# 15. AFTER Triggers (Audit / Side Effects)

```ts
{
  type: "POST",

  admin: {
    allow: "*",
  },

  triggers: [
    {
      type: "AFTER",
      level: "ROW",

      query: {
        set: {
          field: "event",

          when: {
            field: "event",
            op: "IS NULL",
          },

          value: "created",
        },
      },
    },
  ],
}
```

---

# 16. Full Enterprise Structure

```ts
export default {
  users: {
    table: "users",

    endpoints: [
      {
        type: "GET",

        user: {
          allow: ["id", "name", "email", "surname"],
          disallowed: ["password"],
        },

        admin: {
          allow: {
            field: "*",
            where: {
              left_value: "$user.have_access",
              op: "=",
              value: 1,
            },
          },

          disallowed: [],
          limit: 10,
          order_by: ["$desc.created_at"],
        },
      },

      {
        type: "PUT",

        user: {
          allow: {
            field: ["name", "surname"],

            where: {
              and: [
                {
                  field: "id",
                  op: "=",
                  value: "$user.id",
                },
                {
                  left_value: "$user.have_access",
                  op: "=",
                  value: 1,
                },
              ],
            },
          },

          disallowed: "*",
        },

        admin: {
          allow: "*",
          disallowed: [],
          returning: true,
        },
      },

      {
        type: "POST",

        user: {
          allow: [],
          disallowed: [],
        },

        admin: {
          allow: "*",
          returning: true,
        },

        triggers: [
          {
            type: "BEFORE",
            level: "ROW",
            query: {
              set: {
                field: "name",
                when: {
                  field: "name",
                  op: "IS NULL",
                },
                value: "default",
              },
            },
          },
        ],
      },

      {
        type: "DELETE",

        user: {
          allow: [],
          disallowed: "",
        },

        admin: {
          allow: "*",
        },
      },
    ],
  },
};
```

---

# Summary

This DSL supports:

- RBAC (roles)
- ABAC (conditional rules)
- field-level security
- deny overrides
- runtime interpolation (`$user`, `$data`, `$col`)
- query-side constraints (`limit`, `order_by`)
- mutation hooks (`BEFORE / AFTER`)
- row-level triggers
- full endpoint modeling
