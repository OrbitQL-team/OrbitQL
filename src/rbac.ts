import { WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure, SafeOperator, SimpleCondition } from "./types.ts";

export function alias_selected_fields(fields: Record<string, any>): Record<string, any> {
  const aliased: Record<string, any> = {};
  for (const [key, col] of Object.entries(fields)) {
    // key is already `tablename.field`
    aliased[key] = col;
  }
  return aliased;
}

export function resolve_fields(
    structure: Structure,
    fields: any,
    type: string,
    role: string,
    default_table: string,
    tableMap: Record<string, Record<string, any>>
) {
    const allowed_fields: Record<string, any> = {};
    console.log(fields)
    if (!fields || (typeof fields !== "string" && !Array.isArray(fields))) return allowed_fields;

    const keys = Array.isArray(fields) ? fields : fields;

    console.log('keys: ',keys)

    // Handle ["*"] wildcard
    if ((keys == "*" && typeof keys == 'string') || (keys.length === 1 && keys[0] === "*")) {
        // expand to all allowed fields of the default_table
        const tableStruct = structure[default_table];
        if (!tableStruct) throw new Error(`Unknown table '${default_table}'`);

        const endpoint = tableStruct.endpoints.find(e => e.type === type);
        if (!endpoint) throw new Error(`${type} not allowed on ${default_table}`);

        const rolePermissions = endpoint[role];
        if (typeof rolePermissions !== "object" || !rolePermissions || Array.isArray(rolePermissions)) {
            return allowed_fields;
        }

        const allowed =
            'allowed' in rolePermissions
                ? rolePermissions.allowed
                : 'allow' in rolePermissions
                ? rolePermissions.allow
                : [];

        const disallowed =
            'disallowed' in rolePermissions
                ? rolePermissions.disallowed ?? []
                : 'deny' in rolePermissions
                ? rolePermissions.deny ?? []
                : [];

        for (const field of Object.keys(tableMap[default_table])) {
            if (!resolve_allowed_fields(field, allowed, disallowed)) {
                console.log("TABLE: ", default_table)
                console.log("REMOVED: ",field)
                continue
            };
            allowed_fields[`${default_table}.${field}`] = tableMap[default_table][field];
        }

        return allowed_fields;
    }

    function resolve_field(entry:string) {
        let table: string;
        let field: string;

        if (entry.includes(".")) [table, field] = entry.split(".");
        else {
            table = default_table;
            field = entry;
        }

        const tableStruct = structure[table];
        if (!tableStruct) throw new Error(`Unknown table '${table}'`);

        const endpoint = tableStruct.endpoints.find(e => e.type === type);
        if (!endpoint) throw new Error(`${type} not allowed on ${table}`);

        const rolePermissions = endpoint[role];
        if (typeof rolePermissions !== "object" || !rolePermissions || Array.isArray(rolePermissions)) {
            return;
        }

        const allowed =
            'allowed' in rolePermissions
                ? rolePermissions.allowed
                : 'allow' in rolePermissions
                ? rolePermissions.allow
                : [];

        const disallowed =
            'disallowed' in rolePermissions
                ? rolePermissions.disallowed ?? []
                : 'deny' in rolePermissions
                ? rolePermissions.deny ?? []
                : [];
        if(field == "*") {
            for (const current_field of Object.keys(tableMap[table])) {
                if (!resolve_allowed_fields(current_field, allowed, disallowed)) {
                    console.log("TABLE: ", table)
                    console.log("REMOVED: ",current_field)
                    continue
                };
                allowed_fields[`${table}.${current_field}`] = tableMap[table][current_field];
            }
        }else {
            if (!resolve_allowed_fields(field, allowed, disallowed)) {
                console.log("TABLE: ", table)
                console.log("REMOVED: ",field)
                return
            };
            if (!(field in tableMap[table])) throw new Error(`Field '${field}' does not exist on table '${table}'`);
            allowed_fields[`${table}.${field}`] = tableMap[table][field];
        }
    }

    if(typeof keys == 'string') {
        resolve_field(keys)
    }
    if(Array.isArray(keys)) {
        for (const entry of keys) {
            resolve_field(entry)
        }
    }

    return allowed_fields;
}


export function resolve_data(
    structure: Structure,
    fields: any,
    type: string,
    role: string,
    default_table: string,
    tableMap: Record<string, Record<string, any>>
) {
    const allowed_fields: Record<string, any> = {};

    if (!fields || typeof fields !== "object") {
        return allowed_fields;
    }

    for (const [entry, value] of Object.entries(fields)) {
        let table: string;
        let field: string;

        if (entry.includes(".")) {
            [table, field] = entry.split(".");
        } else {
            table = default_table;
            field = entry;
        }

        const tableStruct = structure[table];
        if (!tableStruct) {
            throw new Error(`Unknown table '${table}'`);
        }

        const endpoint = tableStruct.endpoints.find(e => e.type === type);
        if (!endpoint) {
            throw new Error(`${type} not allowed on ${table}`);
        }

        const rolePermissions = endpoint[role];
        if (typeof rolePermissions !== "object" || !rolePermissions || Array.isArray(rolePermissions)) {
            continue;
        }

        const allowed =
            'allowed' in rolePermissions
                ? rolePermissions.allowed
                : 'allow' in rolePermissions
                ? rolePermissions.allow
                : [];

        const disallowed =
            'disallowed' in rolePermissions
                ? rolePermissions.disallowed ?? []
                : 'deny' in rolePermissions
                ? rolePermissions.deny ?? []
                : [];

        // Authorization check (normalized field)
        if (!resolve_allowed_fields(field, allowed, disallowed)) {
            console.log("TABLE: ", table)
            console.log("REMOVED: ",field)
            continue
        };

        // Schema existence check
        if (!tableMap[table] || !(field in tableMap[table])) {
            throw new Error(`Field '${field}' does not exist on table '${table}'`);
        }

        // IMPORTANT PART:
        // Preserve original key for UPDATE
        allowed_fields[entry] = value;
    }

    return allowed_fields;
}

function matchesField(field: string, col: string, rule: string): boolean {
    if (rule === "*") return true;
    return rule === field || rule === col;
}

function matchesPermission(
    field: string,
    col: string,
    permission?: FieldPermission
): boolean {
    if (!permission) return false;

    if(typeof permission == 'string') {
        return matchesField(field, col, permission);
    }

    if (Array.isArray(permission)) {
        return permission.some(rule => matchesField(field, col, rule));
    }

    if (typeof permission === "object") {
        const rule = permission.field;

        if (Array.isArray(rule)) {
            if (rule.includes("*")) return true;
            return rule.some(r => matchesField(field, col, r));
        }

        return matchesField(field, col, rule);
    }

    return false;
}

export function resolve_allowed_fields(
    field: string,
    allowed?: FieldPermission,
    disallowed?: FieldPermission
): boolean {
    const col = field.includes(".") ? field.split(".")[1] : field;

    const isAllowed = matchesPermission(field, col, allowed);
    if (!isAllowed) return false;

    const isDisallowed = matchesPermission(field, col, disallowed);
    if (isDisallowed) return false;

    return true;
}

export function stripPrefixes(input: any): any {
    // Handle arrays
    if (Array.isArray(input)) {
        return input.map(stripPrefixes);
    }

    // Handle objects (but not null)
    if (input !== null && typeof input === "object") {
        const cleaned: Record<string, any> = {};

        for (const [key, value] of Object.entries(input)) {
            let cleanKey = key.includes(".") ? key.split(".").pop()! : key;
            if (Object.prototype.hasOwnProperty.call(cleaned, cleanKey)) {
                cleanKey = key.includes(".") ? key.replace(".", "_") : `${key}_${value}`;
            }
            cleaned[cleanKey] = stripPrefixes(value);
        }

        return cleaned;
    }

    // Primitives (string, number, boolean, null, undefined)
    return input;
}

export function resolveCustomValue(
  value: any,
  user: any,
  query: StructuredQuery,
  tableMap: Record<string, any>,
  default_table_name: string,
): any {
  if (!value) return value;

  function is_undefined(v: any) {
    if (v === undefined) throw new Error(`Undefined value not supported`);
    return v;
  }

  // ------------------------
  // Handle object: { $col: ... }
  // ------------------------
  if (typeof value === "object" && "$col" in value) {
    const colRef = value.$col;

    if (typeof colRef !== "string") {
      throw new Error(`Invalid $col reference`);
    }

    if (!tableMap) {
      throw new Error(`tableMap is required to resolve $col`);
    }

    let vTbl: string;
    let vCol: string;

    if (colRef.includes(".")) {
      [vTbl, vCol] = colRef.split(".");
    } else {
      if (!default_table_name) {
        throw new Error(
          `Column '${colRef}' missing table and no default_table_name provided`
        );
      }
      vTbl = default_table_name;
      vCol = colRef;
    }

    const vColumn = tableMap[vTbl]?.[vCol];
    if (!vColumn) {
      throw new Error(`Column '${colRef}' not found`);
    }

    return vColumn;
  }

  // ------------------------
  // Non-string → return as-is
  // ------------------------
  if (typeof value !== "string") return value;

  // ------------------------
  // $user.X
  // ------------------------
  let match = value.match(/^\$user\.(\w+)$/);
  if (match && user) {
    return is_undefined(user[match[1]]);
  }

  // ------------------------
  // $data.X
  // ------------------------
  match = value.match(/^\$data\.(.+)$/);
  if (match && query?.data) {
    const key = match[1];

    // direct match
    if (key in query.data) return is_undefined(query.data[key]);

    // nested resolution
    const parts = key.split(".");
    let val: any = query.data;

    for (const part of parts) {
      if (val && part in val) val = val[part];
      else return '';
    }

    return is_undefined(val);
  }

  // ------------------------
  // fallback
  // ------------------------
  return is_undefined(value);
}

export function is_op_type(condition:SimpleCondition, text:string) {
    return ((condition.operator && condition.operator.toUpperCase() == text.toUpperCase()) || (condition.op && condition.op.toUpperCase() == text.toUpperCase()))
}

export function injectDynamicValues(
    cond: WhereCondition | SubqueryCondition,
    user: any,
    query: StructuredQuery,
    tableMap: Record<string, any>,
    default_table_name: string,
    safe?: Record<string, any>
): WhereCondition | SubqueryCondition {
    if ("and" in cond && Array.isArray(cond.and)) {
        const newCond = { ...cond };
        newCond.and = cond.and.map(c =>
            injectDynamicValues(c, user, query, tableMap, default_table_name, safe) as WhereCondition
        );
        return newCond;
    }else if ("or" in cond && Array.isArray(cond.or)) {
        const newCond = { ...cond };
        newCond.or = cond.or.map(c =>
            injectDynamicValues(c, user, query, tableMap, default_table_name, safe) as WhereCondition
        );
        return newCond;
    } else if ("not" in cond && cond.not) {
        const newCond = { ...cond };
        newCond.not = injectDynamicValues(newCond.not, user, query, tableMap, default_table_name, safe) as WhereCondition
        return newCond;
    } else if ("if" in cond && cond.if && cond.if.when) {
        const newCond = { ...cond };
        newCond.if.when = injectDynamicValues(newCond.if.when, user, query, tableMap, default_table_name, safe) as WhereCondition
        return newCond;
    } else if ("field" in cond && cond.field) {
        // resolve placeholder
        const resolvedValue = resolveCustomValue(cond.value, user, query, tableMap, default_table_name)

        // if safe object is provided, also populate it
        if (safe) safe[cond.field] = resolvedValue;

        // handle subqueries
        if (typeof cond.value === "object" && "select" in cond.value && cond.value.where) {
            const newCond = { ...cond, value: { ...cond.value } };
            newCond.value.where = cond.value.where.map((c: WhereCondition) =>
                injectDynamicValues(c, user, query, tableMap, default_table_name, safe) as WhereCondition
            );
            return newCond;
        }

        return { ...cond, value: resolvedValue };
    }

    return cond;
}

export function extractTableMap<T extends { table: any }>(
  structure: Record<string, T>
): Record<string, T["table"]> {
  return Object.fromEntries(
    Object.entries(structure).map(([key, value]) => [key, value.table])
  );
}