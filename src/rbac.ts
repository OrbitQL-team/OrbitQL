import { count } from "drizzle-orm";
import { WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure, SimpleCondition, ExistsCondition } from "./types.ts";

// * Alias selected fields from the user
export function alias_selected_fields(fields: Record<string, any>): Record<string, any> {
  const aliased: Record<string, any> = {};
  for (const [key, col] of Object.entries(fields)) {
    // * key is already `tablename.field`
    aliased[key] = col;
  }
  return aliased;
}

function resolve_field(entry:string, default_table:string, structure: Structure, type:string, role:string, tableMap: Record<string, Record<string, any>>):boolean {
    let table: string;
    let field: string;

    console.log('ENTRY: ',entry)
    const isCount = entry.startsWith("$count.");
    const plain_entry = isCount ? entry.slice(7) : entry;
    console.log('IS COUNT: ', isCount)

    if (plain_entry.includes(".")) [table, field] = plain_entry.split(".");
    else {
        table = default_table;
        field = plain_entry;
    }

    const tableStruct = structure[table];
    if (!tableStruct) throw new Error(`Unknown table '${table}'`);

    const endpoint = tableStruct.endpoints.find(e => e.type === type);
    if (!endpoint) throw new Error(`${type} not allowed on ${table}`);

    const rolePermissions = endpoint[role];
    if (typeof rolePermissions !== "object" || !rolePermissions || Array.isArray(rolePermissions)) {
        return false;
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

    if (!resolve_allowed_fields(field, allowed, disallowed)) {
        console.log("TABLE: ", table)
        console.log("REMOVED: ",field)
        return false
    };
    if (!(field in tableMap[table])) throw new Error(`Field '${field}' does not exist on table '${table}'`);
    return true
}

// * Resolve allowed fields
export function resolve_fields(
    structure: Structure,
    fields: any,
    type: string,
    role: string,
    default_table: string,
    tableMap: Record<string, Record<string, any>>
) {
    const allowed_fields: Record<string, any> = {};
    if (!fields || (typeof fields !== "string" && !Array.isArray(fields))) return allowed_fields;

    const keys = Array.isArray(fields) ? fields : fields;

    function resolve_field(entry:string) {
        let table: string;
        let field: string;

        console.log('ENTRY: ',entry)
        const isCount = entry.startsWith("$count.");
        const plain_entry = isCount ? entry.slice(7) : entry;
        console.log('IS COUNT: ', isCount)

        if (plain_entry.includes(".")) [table, field] = plain_entry.split(".");
        else {
            table = default_table;
            field = plain_entry;
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
                const field_reference = tableMap[table][current_field]
                console.log('current field: ', current_field)
                if(isCount) {
                    allowed_fields[`${table}.${current_field}`] = count(field_reference)
                }else allowed_fields[`${table}.${current_field}`] = field_reference;
            }
        }else {
            if (!resolve_allowed_fields(field, allowed, disallowed)) {
                console.log("TABLE: ", table)
                console.log("REMOVED: ",field)
                return
            };
            if (!(field in tableMap[table])) throw new Error(`Field '${field}' does not exist on table '${table}'`);
            const field_reference = tableMap[table][field]
            if(isCount) {
                allowed_fields[`${table}.${field}`] = count(field_reference)
            }else allowed_fields[`${table}.${field}`] = field_reference;
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

// * Resolve allowed passed data
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

        // * Schema existence check
        if (!tableMap[table] || !(field in tableMap[table])) {
            throw new Error(`Field '${field}' does not exist on table '${table}'`);
        }

        // * Authorization check (normalized field)
        if (!resolve_allowed_fields(field, allowed, disallowed)) {
            console.log("TABLE: ", table)
            console.log("REMOVED: ",field)
            continue
        };

        allowed_fields[entry] = value;
    }

    return allowed_fields;
}

// * Checkes if the field is accepted inside of structure
function matchesField(field: string, rule: string): boolean {
    if (rule === "*") return true;
    else if(rule === field) return true
    return false
}

// * Combines allowed and not allowed permission to check if allowed
function matchesPermission(
    field: string,
    permission?: FieldPermission
): {result: boolean, matched_field: any} {
    if (!permission) return { result: false, matched_field: null };

    if(typeof permission == 'string') {
        return { result: matchesField(field, permission), matched_field: field };
    }

    if (Array.isArray(permission)) {
        for(let rule of permission) {
            const result = matchesField(field, rule)
            console.log('RESULT:', result)
            if(result) return { result, matched_field: field }
        }
        return { result: false, matched_field: field };
    }

    if (typeof permission === "object") {
        const rule = permission.field;

        if (Array.isArray(rule)) {
            if (rule.includes("*")) return { result: true, matched_field: "*" };
            for(let r of rule) {
                const result = matchesField(field, r)
                console.log(result)
                if(result) return { result, matched_field: field }
            }
            return { result: false, matched_field: field };
        }

        return { result: matchesField(field, rule), matched_field: field }
    }

    return { result: false, matched_field: field };
}

// * Resolve if field is allowed
export function resolve_allowed_fields(
    field: string,
    allowed?: FieldPermission,
    disallowed?: FieldPermission
): boolean {

    const { result: isAllowed } = matchesPermission(field, allowed);
    console.log(field, allowed)
    if (!isAllowed) return false;

    const { result: isDisallowed, matched_field: disallowed_matched_field } = matchesPermission(field, disallowed);
    console.log(isAllowed, isDisallowed)
    if (isDisallowed) {
        if(isAllowed && disallowed_matched_field == "*") return true
        else return false
    }

    return true;
}

// * Remove prefixes
export function stripPrefixes(input: any): any {
    // * Handle arrays
    if (Array.isArray(input)) {
        return input.map(stripPrefixes);
    }

    // * Handle objects (but not null)
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

    // * Primitives (string, number, boolean, null, undefined)
    return input;
}

// * Simply checks if value passed is undefined
export function is_undefined(v: any) {
    if (v === undefined) throw new Error(`Undefined value not supported`);
    return v;
}

// * Resolves custom values ex. $data - $user $col
export function resolveCustomValue(
  value: any,
  user: any,
  query: StructuredQuery,
  tableMap: Record<string, any>,
  default_table_name: string,
): any {
    if (!value) return value;

    // ------------------------
    // Handle object: $col.X
    // ------------------------
    let match = typeof value === "string" && value.match(/^\$col\.(.+)$/);

    if (match) {
        const colRef = match[1];

        if (!tableMap) {
            throw new Error(`tableMap is required to resolve $col`);
        }

        const parts = colRef.split(".");

        let vTbl: string;
        let vCol: string;

        if (parts.length === 2) {
            [vTbl, vCol] = parts;
        } else if (parts.length === 1) {
            if (!default_table_name) {
                throw new Error(
                    `Column '${colRef}' missing table and no default_table_name provided`
                );
            }
            vTbl = default_table_name;
            vCol = parts[0];
        } else {
            throw new Error(`Invalid $col format: '${value}'`);
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
    match = value.match(/^\$user\.(\w+)$/);
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

// * checks operator type
export function is_op_type(condition:SimpleCondition | ExistsCondition, text:string) {
    return ((condition.operator && condition.operator.toUpperCase() == text.toUpperCase()) || (condition.op && condition.op.toUpperCase() == text.toUpperCase()))
}

// * inject dynamic values inside of where condition
// ! probably not necessary?
export function validate_where_fields(
  cond: WhereCondition | SubqueryCondition,
  tableMap: Record<string, any>,
  default_table: string,
  structure: Structure,
  role: string,
  type: string
): WhereCondition | SubqueryCondition {

  if (!cond || typeof cond !== "object") return cond;

  let newCond= { ...cond };

  // ---- AND ----
  if ("and" in newCond && Array.isArray(newCond.and)) {
    newCond.and = newCond.and.map(c =>
      validate_where_fields(c, tableMap, default_table, structure, role, type)
    );
  }

  // ---- OR ----
  if ("or" in newCond && Array.isArray(newCond.or)) {
    newCond.or = newCond.or.map(c =>
      validate_where_fields(c, tableMap, default_table, structure, role, type)
    );
  }

  // ---- NOT ----
  if ("not" in newCond && newCond.not) {
    newCond.not = validate_where_fields(
      newCond.not,
      tableMap,
      default_table,
      structure,
      role,
      type
    );
  }

  // ---- IF ----
  if ("if" in newCond && newCond.if && typeof newCond.if === "object") {
    const newIf = { ...newCond.if };

    if (newIf.when) {
      newIf.when = validate_where_fields(
        newIf.when,
        tableMap,
        default_table,
        structure,
        role,
        type
      );
    }

    if (newIf.do && typeof newIf.do === "object" && !("type" in newIf.do)) {
      newIf.do = validate_where_fields(
        newIf.do,
        tableMap,
        default_table,
        structure,
        role,
        type
      );
    }

    if (newIf.else && typeof newIf.else === "object" && !("type" in newIf.else)) {
      newIf.else = validate_where_fields(
        newIf.else,
        tableMap,
        default_table,
        structure,
        role,
        type
      );
    }

    newCond.if = newIf;
  }

  // ---- EXISTS / SUBQUERY ----
  if ("query" in newCond && newCond.query) {
    const newQuery = { ...newCond.query };

    if (newQuery.where) {
      newQuery.where = validate_where_fields(
        newQuery.where,
        tableMap,
        default_table,
        structure,
        role,
        type
      );
    }

    newCond.query = newQuery;
  }

  // ---- helper to validate $col ----
  const validateColRef = (val: any) => {
    if (typeof val === "string") {
      const match = val.match(/^\$col\.(.+)$/);
      if (match) {
        const field = match[1];

        const allowed = resolve_field(
          field,
          default_table,
          structure,
          type,
          role,
          tableMap
        );

        if (!allowed) {
          throw Error("Field not allowed in where condition");
        }
      }
    }
  };

  // ---- helper for subqueries ----
  const handleSubquery = (val: any) => {
    if (val && typeof val === "object" && "select" in val) {
      const sub = { ...val };

      if (sub.where) {
        sub.where = validate_where_fields(
          sub.where,
          tableMap,
          default_table,
          structure,
          role,
          type
        );
      }

      return sub;
    }
    return val;
  };

  // ---- VALUE ----
  if ("value" in newCond) {
    newCond.value = handleSubquery(newCond.value);
    validateColRef(newCond.value);
  }

  // ---- LEFT VALUE ----
  if ("left_value" in newCond) {
    newCond.left_value = handleSubquery(newCond.left_value);
    validateColRef(newCond.left_value);
  }

  // ---- FIELD ----
  if ("field" in newCond && newCond.field) {
    const allowed = resolve_field(
      newCond.field,
      default_table,
      structure,
      type,
      role,
      tableMap
    );

    if (!allowed) {
      throw Error("Field not allowed in where condition");
    }
  }

  return newCond;
}

// extract the map of the table
export function extractTableMap<T extends { table: any }>(
  structure: Record<string, T>
): Record<string, T["table"]> {
  return Object.fromEntries(
    Object.entries(structure).map(([key, value]) => [key, value.table])
  );
}