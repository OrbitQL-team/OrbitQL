import { avg, avgDistinct, count, countDistinct, max, min, sql, sum, sumDistinct } from "drizzle-orm";
import { asc, desc } from "drizzle-orm";
import { WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure, SimpleCondition, ExistsCondition, NotExistsCondition, BetweenCondition, NotBetweenCondition, AllowedAliasesReturning, DisallowedAliasesReturning } from "./types.ts";


/* -------------------------------------------------------------------------- */
/*                               RESOLVE FIELDS                               */
/* -------------------------------------------------------------------------- */
// * Alias selected fields from the user
export function alias_selected_fields(fields: Record<string, any>): Record<string, any> {
  const aliased: Record<string, any> = {};
  for (const [key, col] of Object.entries(fields)) {
    // * key is already `tablename.field`
    aliased[key] = col;
  }
  return aliased;
}

function is_allowed_field(entry:string, default_table:string, structure: Structure, type:string, role:string, tableMap: Record<string, Record<string, any>>):boolean {
    let table: string;
    let field: string;

    if (entry.includes(".")) [table, field] = entry.split(".");
    else {
        table = default_table;
        field = entry;
    }

    const tableStruct = structure[table];
    if (!tableStruct) throw new Error(`Unknown table '${table}'`);

    const endpoint = tableStruct.endpoints.find(e => e.type.toUpperCase() === type.toUpperCase());
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

type AggregateOp =
    | "COUNT"
    | "COUNTDISTINCT"
    | "SUM"
    | "SUMDISTINCT"
    | "AVG"
    | "AVGDISTINCT"
    | "MIN"
    | "MAX";

interface ParsedField {
    aggregate: AggregateOp | null;
    field: string;
}

const AGGREGATES = new Set<AggregateOp>([
    "COUNT",
    "COUNTDISTINCT",
    "SUM",
    "SUMDISTINCT",
    "AVG",
    "AVGDISTINCT",
    "MIN",
    "MAX",
]);

function applyAggregate(
    parameter: any,
    aggregate: AggregateOp | null
): any {
    if (!aggregate) return parameter;

    switch (aggregate) {
        case "COUNT":
            return count(parameter);

        case "COUNTDISTINCT":
            return countDistinct(parameter);

        case "SUM":
            return sum(parameter);

        case "SUMDISTINCT":
            return sumDistinct(parameter);

        case "AVG":
            return avg(parameter);

        case "AVGDISTINCT":
            return avgDistinct(parameter);

        case "MIN":
            return min(parameter);

        case "MAX":
            return max(parameter);

        default:
            return parameter;
    }
}

function normalizeOp(op: string): string {
    return op
        .trim()
        .replace(/_/g, "")
        .toUpperCase();
}

function get_custom_field(rawEntry: string): ParsedField {
    if (!rawEntry.startsWith("$")) {
        return { aggregate: null, field: rawEntry };
    }

    const dotIndex = rawEntry.indexOf(".");

    if (dotIndex === -1) {
        return { aggregate: null, field: rawEntry };
    }

    const opRaw = normalizeOp(rawEntry.slice(1, dotIndex));
    const field = rawEntry.slice(dotIndex + 1);

    if (!field) {
        return { aggregate: null, field: rawEntry };
    }

    const op = opRaw as AggregateOp;

    if (AGGREGATES.has(op)) {
        return {
            aggregate: op,
            field,
        };
    }

    return {
        aggregate: null,
        field: rawEntry,
    };
}

// * Resolve allowed fields
export function resolve_fields(
    structure: Structure,
    fields: string | string[],
    type: string,
    role: string,
    defaultTable: string,
    tableMap: Record<string, Record<string, any>>
) {
    const allowedFields: Record<string, any> = {};

    if (!fields) return allowedFields;

    const entries = Array.isArray(fields) ? fields : [fields];

    for (const rawEntry of entries) {
        let { field: entry, aggregate } = get_custom_field(rawEntry)

        const [table, field] = entry.includes(".")
            ? entry.split(".")
            : [defaultTable, entry];

        const tableStruct = structure[table];
        if (!tableStruct) {
            throw new Error(`Unknown table '${table}'`);
        }

        const endpoint = tableStruct.endpoints.find(e => e.type.toUpperCase() === type.toUpperCase());
        if (!endpoint) {
            throw new Error(`${type} not allowed on ${table}`);
        }

        const permissions = endpoint[role];

        if (
            !permissions ||
            typeof permissions !== "object" ||
            Array.isArray(permissions)
        ) {
            continue;
        }

        const allowed = permissions.allowed ?? permissions.allow ?? [];
        const disallowed = permissions.disallowed ?? permissions.deny ?? [];

        const tableFields = tableMap[table];

        const addField = (fieldName: string) => {
            if (!resolve_allowed_fields(fieldName, allowed, disallowed)) {
                return;
            }

            const fieldRef = tableFields[fieldName];

            if (fieldRef === undefined) {
                throw new Error(
                    `Field '${fieldName}' does not exist on table '${table}'`
                );
            }

            const key = aggregate
                ? `${aggregate}.${table}.${fieldName}`
                : `${table}.${fieldName}`;

                allowedFields[key] = applyAggregate(fieldRef, aggregate);
        };

        if (field === "*") {
            for (const fieldName in tableFields) {
                addField(fieldName);
            }
        } else {
            addField(field);
        }
    }

    return allowedFields;
}

export function resolve_returning_fields(
    structure: Structure,
    fields: string | string[],
    type: string,
    role: string,
    defaultTable: string,
    tableMap: Record<string, Record<string, any>>
) {
    const allowedFields: Record<string, any> = {};

    if (!fields) return allowedFields;

    const entries = Array.isArray(fields) ? fields : [fields];

    for (const rawEntry of entries) {
        // hard disable count
        const parsed = get_custom_field(rawEntry);

        if (parsed.aggregate) {
            throw new Error(
                `$${parsed.aggregate} fields are disabled in returning`
            );
        }

        const entry = rawEntry;

        const [table, field] = entry.includes(".")
            ? entry.split(".")
            : [defaultTable, entry];

        const tableStruct = structure[table];
        if (!tableStruct) {
            throw new Error(`Unknown table '${table}'`);
        }

        const endpoint = tableStruct.endpoints.find(e => e.type.toUpperCase() === type.toUpperCase());
        if (!endpoint) {
            throw new Error(`${type} not allowed on ${table}`);
        }

        const permissions = endpoint[role];

        if (
            !permissions ||
            typeof permissions !== "object" ||
            Array.isArray(permissions)
        ) {
            continue;
        }

        const returning = permissions.returning;

        const tableFields = tableMap[table];

        if (!tableFields) {
            throw new Error(`Unknown table '${table}' in tableMap`);
        }

        // ----------------------------
        // BOOLEAN MODE
        // ----------------------------
        if (typeof returning === "boolean") {
            if (!returning) continue;

            const addField = (fieldName: string) => {
                const fieldRef = tableFields[fieldName];

                if (fieldRef === undefined) {
                    throw new Error(
                        `Field '${fieldName}' does not exist on table '${table}'`
                    );
                }

                allowedFields[fieldName] = fieldRef;
            };

            if (field === "*") {
                for (const fieldName in tableFields) {
                    addField(fieldName);
                }
            } else {
                addField(field);
            }

            continue;
        }

        // ----------------------------
        // OBJECT MODE
        // ----------------------------
        const allowed = returning?.allowed ?? returning?.allow ?? [];
        const disallowed = returning?.disallowed ?? returning?.deny ?? [];

        const addField = (fieldName: string) => {
            if (
                !resolve_allowed_fields(fieldName, allowed, disallowed)
            ) {
                return;
            }

            const fieldRef = tableFields[fieldName];

            if (fieldRef === undefined) {
                throw new Error(
                    `Field '${fieldName}' does not exist on table '${table}'`
                );
            }

            allowedFields[fieldName] = fieldRef;
        };

        if (field === "*") {
            for (const fieldName in tableFields) {
                addField(fieldName);
            }
        } else {
            addField(field);
        }
    }

    return allowedFields;
}

export function resolve_group_by_fields(
  structure: Structure,
  fields: any,
  type: string,
  role: string,
  default_table: string,
  tableMap: Record<string, Record<string, any>>
) {
  const result: any[] = [];

  if (!fields) return result;

  const list = Array.isArray(fields)
    ? fields
    : typeof fields === "string"
      ? [fields]
      : [];

  function resolve(entry: string) {
    if (typeof entry !== "string") return;

    let raw = entry.trim();

    if (raw === "*") {
      throw new Error("'*' not allowed in group_by");
    }

    const parsed = get_custom_field(raw);

    if (parsed.aggregate) {
        throw new Error(
            `$${parsed.aggregate} fields are disabled in returning`
        );
    }

    // -----------------------------
    // resolve table/field
    // -----------------------------
    let table: string;
    let field: string;

    if (raw.includes(".")) {
      [table, field] = raw.split(".");
    } else {
      table = default_table;
      field = raw;
    }

    const tableStruct = structure[table];
    if (!tableStruct) throw new Error(`Unknown table '${table}'`);

    const endpoint = tableStruct.endpoints.find(e => e.type.toUpperCase() === type.toUpperCase());
    if (!endpoint) throw new Error(`${type} not allowed on ${table}`);

    const rolePermissions = endpoint[role];
    if (!rolePermissions || typeof rolePermissions !== "object") return;

    const allowed =
      "allowed" in rolePermissions
        ? rolePermissions.allowed
        : rolePermissions.allow ?? [];

    const disallowed =
      "disallowed" in rolePermissions
        ? rolePermissions.disallowed ?? []
        : rolePermissions.deny ?? [];

    // -----------------------------
    // permission check
    // -----------------------------
    if (!resolve_allowed_fields(field, allowed, disallowed)) {
      return;
    }

    // -----------------------------
    // existence check
    // -----------------------------
    const column = tableMap[table]?.[field];
    if (!column) {
      throw new Error(`Invalid group_by column: ${table}.${field}`);
    }

    result.push(column);
  }

  for (const f of list) resolve(f);

  return result;
}

export function resolve_order_by_fields(
    structure: Structure,
    fields: any,
    type: string,
    role: string,
    default_table: string,
    tableMap: Record<string, Record<string, any>>
) {
    const resolved_fields: any[] = [];

    if (!fields || (typeof fields !== "string" && !Array.isArray(fields))) {
        return resolved_fields;
    }

    const keys = Array.isArray(fields) ? fields : [fields];

    function resolve_field(entry: string) {
        if (typeof entry !== "string") return;

        let direction: "ASC" | "DESC" = "ASC";
        let raw = entry.trim();

        // -----------------------------------
        // Parse direction prefix
        // -----------------------------------

        if (raw.startsWith("$desc.")) {
            direction = "DESC";
            raw = raw.slice(6);
        } else if (raw.startsWith("$asc.")) {
            direction = "ASC";
            raw = raw.slice(5);
        }

        // -----------------------------------
        // Remove unsupported syntax
        // -----------------------------------

        if (raw === "*") {
            throw new Error(`'*' is not allowed in order_by`);
        }

        const parsed = get_custom_field(raw);

        if (parsed.aggregate) {
            throw new Error(
                `$${parsed.aggregate} fields are disabled in returning`
            );
        }

        // -----------------------------------
        // Resolve table + field
        // -----------------------------------

        let table: string;
        let field: string;

        if (raw.includes(".")) {
            [table, field] = raw.split(".");
        } else {
            table = default_table;
            field = raw;
        }

        // -----------------------------------
        // Validate table
        // -----------------------------------

        const tableStruct = structure[table];

        if (!tableStruct) {
            throw new Error(`Unknown table '${table}'`);
        }

        // -----------------------------------
        // Validate endpoint
        // -----------------------------------

        const endpoint = tableStruct.endpoints.find(
            (e) => e.type.toUpperCase() === type.toUpperCase()
        );

        if (!endpoint) {
            throw new Error(`${type} not allowed on ${table}`);
        }

        // -----------------------------------
        // Validate role permissions
        // -----------------------------------

        const rolePermissions = endpoint[role];

        if (
            typeof rolePermissions !== "object" ||
            !rolePermissions ||
            Array.isArray(rolePermissions)
        ) {
            return;
        }

        const allowed =
            "allowed" in rolePermissions
                ? rolePermissions.allowed
                : "allow" in rolePermissions
                ? rolePermissions.allow
                : [];

        const disallowed =
            "disallowed" in rolePermissions
                ? rolePermissions.disallowed ?? []
                : "deny" in rolePermissions
                ? rolePermissions.deny ?? []
                : [];

        // -----------------------------------
        // Validate field permissions
        // -----------------------------------

        if (
            !resolve_allowed_fields(
                field,
                allowed,
                disallowed
            )
        ) {
            return;
        }

        // -----------------------------------
        // Validate field existence
        // -----------------------------------

        if (!(field in tableMap[table])) {
            throw new Error(
                `Field '${field}' does not exist on table '${table}'`
            );
        }

        const field_reference = tableMap[table][field];

        // -----------------------------------
        // Build drizzle order expression
        // -----------------------------------

        resolved_fields.push(
            direction === "DESC"
                ? desc(field_reference)
                : asc(field_reference)
        );
    }

    for (const entry of keys) {
        resolve_field(entry);
    }

    return resolved_fields;
}

export function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
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
    if (!isAllowed) return false;

    const { result: isDisallowed, matched_field: disallowed_matched_field } = matchesPermission(field, disallowed);
    if (isDisallowed) {
        if(isAllowed && disallowed_matched_field == "*") return true
        else return false
    }

    return true;
}

/* -------------------------------------------------------------------------- */
/*                   REMOVE PREFIXES FROM RETURNED STRUCTURE                  */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*                                DATA RESOLVE                                */
/* -------------------------------------------------------------------------- */
// * Simply checks if value passed is undefined
export function is_undefined(v: any) {
    if (v === undefined) throw new Error(`Undefined value not supported`);
    return sql`${v}`;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDataRef(value: unknown, kind: string): boolean {
  const safeKind = escapeRegex(kind);
  const DATA_REF_REGEX = new RegExp(`^\\$(${safeKind})\\.(.+)$`);

  return typeof value === "string" && DATA_REF_REGEX.test(value);
}

function checkObject(obj: Record<string, any>, kind: string): boolean {
  return Object.values(obj).some((value) =>
    isDataRef(value, kind)
  );
}

function getEndpoint(structure: Structure, table: string, type: string) {
  const tableStruct = structure[table];
  if (!tableStruct) throw new Error(`Unknown table '${table}'`);

  const endpoint = tableStruct.endpoints.find(
    (e) => e.type.toUpperCase() === type.toUpperCase()
  );

  if (!endpoint) throw new Error(`${type} not allowed on ${table}`);

  return endpoint;
}

function getPermissions(endpoint: any, role: string) {
  const rolePermissions = endpoint[role];

  if (
    !rolePermissions ||
    typeof rolePermissions !== "object" ||
    Array.isArray(rolePermissions)
  ) {
    return null;
  }

  return {
    allowed:
      "allowed" in rolePermissions
        ? rolePermissions.allowed
        : "allow" in rolePermissions
        ? rolePermissions.allow
        : [],

    disallowed:
      "disallowed" in rolePermissions
        ? rolePermissions.disallowed ?? []
        : "deny" in rolePermissions
        ? rolePermissions.deny ?? []
        : [],
  };
}

function resolveColRef(
  colRef: string,
  default_table: string,
  tableMap: Record<string, Record<string, any>>
) {
  const parts = colRef.split(".");

  let table: string;
  let field: string;

  if (parts.length === 2) {
    [table, field] = parts;
  } else if (parts.length === 1) {
    if (!default_table) {
      throw new Error(
        `Column '${colRef}' missing table and no default_table provided`
      );
    }
    table = default_table;
    field = parts[0];
  } else {
    throw new Error(`Invalid $col format: '${colRef}'`);
  }

  if (!tableMap[table] || !(field in tableMap[table])) {
    throw new Error(`Field '${field}' does not exist on table '${table}'`);
  }

  return { table, field };
}

export function resolve_data(
  structure: Structure,
  fields: any,
  type: string,
  role: string,
  default_table: string,
  tableMap: Record<string, Record<string, any>>
): Record<string, any> | Array<Record<string, any>> {
  if (Array.isArray(fields)) {
    return fields.map((item) =>
      resolve_data(
        structure,
        item,
        type,
        role,
        default_table,
        tableMap
      )
    );
  }

  if (!fields || typeof fields !== "object") {
    return {};
  }

  const allowed_fields: Record<string, any> = {};

  for (const [entry, value] of Object.entries(fields)) {
    const [rawTable, rawField] = entry.includes(".")
      ? entry.split(".")
      : [default_table, entry];

    const table = rawTable;
    const field = rawField;

    // schema validation
    if (!tableMap[table] || !(field in tableMap[table])) {
      throw new Error(`Field '${field}' does not exist on table '${table}'`);
    }

    // endpoint + permissions
    const endpoint = getEndpoint(structure, table, type);
    const permissions = getPermissions(endpoint, role);

    if (!permissions) continue;

    const { allowed, disallowed } = permissions;

    if (!resolve_allowed_fields(field, allowed, disallowed)) {
      continue;
    }

    // $col resolution (if needed)
    if (typeof value === "string" && value.startsWith("$col.")) {
      const colRef = value.slice(5);
      const { table: vTbl, field: vCol } = resolveColRef(
        colRef,
        default_table,
        tableMap
      );

      const vEndpoint = getEndpoint(structure, vTbl, type);
      const vPermissions = getPermissions(vEndpoint, role);

      if (!vPermissions) continue;

      const ok = resolve_allowed_fields(
        vCol,
        vPermissions.allowed,
        vPermissions.disallowed
      );

      if (!ok) continue;
    }

    allowed_fields[entry] = value;
  }

  return allowed_fields;
}

export function requests_data(
    cond: SimpleCondition | ExistsCondition | NotExistsCondition | BetweenCondition | NotBetweenCondition,
    kind: string
): boolean {
    return Object.entries(cond).some(([_, value]) => {
        if (typeof value === "string") {
            return isDataRef(value, kind);
        }

        if (value && typeof value === "object") {
            return checkObject(value, kind);
        }

        return false;
    });
}

// * Resolves custom values ex. $data - $user $col
export function resolveCustomValue(
  value: any,
  user: any,
  query: StructuredQuery,
  tableMap: Record<string, any>,
  default_table_name: string,
  custom_value?: Record<string, any>,
  before_value?: Record<string, any>,
  after_value?: Record<string, any>,
  result_value?: Record<string, any>,
): any {
    if (!value) return sql`${value}`;

    const resolvePath = (
        source: Record<string, any> | undefined,
        key: string
    ) => {
        if (!source) return undefined;

        // direct match
        if (key in source) {
            return is_undefined(source[key]);
        }

        // nested match
        let val: any = source;

        for (const part of key.split(".")) {
            if (
                val &&
                typeof val === "object" &&
                part in val
            ) {
                val = val[part];
            } else {
                return undefined;
            }
        }

        return is_undefined(val);
    };

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
    if (typeof value !== "string") return sql`${value}`;

    // ------------------------
    // $user.X
    // ------------------------
    match = value.match(/^\$user\.(\w+)$/);
    if (match && user) {
        return is_undefined(user[match[1]]);
    }

    // ------------------------
    // $data.X / $before.X / $after.X
    // ------------------------
    match = value.match(/^\$(data|before|after|result)\.(.+)$/);

    if (match) {
        const [, scope, key] = match;

        const source =
            scope === "data"
                ? (
                    custom_value && !Array.isArray(custom_value)
                        ? custom_value
                        : query?.data && !Array.isArray(query.data)
                            ? query.data
                            : undefined
                )
                : scope === "before"
                    ? (
                        before_value && !Array.isArray(before_value)
                            ? before_value
                            : undefined
                    )
                    : scope === "after" 
                    ? (
                        after_value && !Array.isArray(after_value)
                            ? after_value
                            : undefined
                    )
                    : (
                        result_value && !Array.isArray(result_value)
                            ? result_value
                            : undefined
                    );

        const resolved = resolvePath(source, key);

        if (resolved !== undefined) {
            return resolved;
        }

        return sql`${""}`;
    }

    // ------------------------
    // fallback
    // ------------------------
    return is_undefined(value);
}

// * checks operator type
type ConditionWithOperator<T extends string> =
  | { operator: T; op?: never }
  | { op: T; operator?: never }

export function is_op_type<T extends string>(
  condition:
    | SimpleCondition
    | ExistsCondition
    | NotExistsCondition
    | BetweenCondition
    | NotBetweenCondition,
  text: T
): condition is Extract<
  SimpleCondition | ExistsCondition | NotExistsCondition | BetweenCondition | NotBetweenCondition,
  ConditionWithOperator<T>
> {
  return (
    condition.operator?.toUpperCase() === text.toUpperCase() ||
    condition.op?.toUpperCase() === text.toUpperCase()
  )
}

/* -------------------------------------------------------------------------- */
/*                              WHERE VALIDATION                              */
/* -------------------------------------------------------------------------- */
// * validate fields of where condition before accessing it to check if the user has access to that field 
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

        const allowed = is_allowed_field(
          field,
          default_table,
          structure,
          type,
          role,
          tableMap
        );

        if (!allowed) {
          throw Error(`Field ${field} not allowed in where condition`);
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
    const allowed = is_allowed_field(
      newCond.field,
      default_table,
      structure,
      type,
      role,
      tableMap
    );

    if (!allowed) {
      throw Error(`Field ${newCond.field} not allowed in where condition`);
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