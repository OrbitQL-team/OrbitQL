import { count } from "drizzle-orm";
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

        // Schema existence check
        if (!tableMap[table] || !(field in tableMap[table])) {
            throw new Error(`Field '${field}' does not exist on table '${table}'`);
        }

        // Authorization check (normalized field)
        if (!resolve_allowed_fields(field, allowed, disallowed)) {
            console.log("TABLE: ", table)
            console.log("REMOVED: ",field)
            continue
        };

        allowed_fields[entry] = value;
    }

    return allowed_fields;
}

function matchesField(field: string, rule: string): boolean {
    if (rule === "*") return true;
    else if(rule === field) return true
    return false
}

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

export function is_undefined(v: any) {
    if (v === undefined) throw new Error(`Undefined value not supported`);
    return v;
}

export function resolveCustomValue(
  value: any,
  user: any,
  query: StructuredQuery,
  tableMap: Record<string, any>,
  default_table_name: string,
): any {
    if (!value) return value;

    // ------------------------
    // Handle object: { $col: ... }
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
        console.log('RESOLVED: ', resolvedValue, " VALUE: ", cond.value)
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