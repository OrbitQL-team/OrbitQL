import { 
  eq, like, and, or, sql, ne, lt, lte, gt, gte, inArray,
  asc, desc, 
  ilike,
  notIlike,
  isNull,
  isNotNull,
  exists,
  between
} from "drizzle-orm";
import { Database, WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure } from "./types.ts";
import { resolve_data, resolve_fields, stripPrefixes, resolveCustomValue, injectDynamicValues, alias_selected_fields } from "./rbac.ts";

/*───────────────────────────────────────────────
  BUILD JOIN
───────────────────────────────────────────────*/
async function buildJoin(q: any, joins: any[], tableMap: Record<string, any>, user: any, query: StructuredQuery, default_table:any) {
  for (const j of joins) {
    const joinStruct = tableMap[j.table];
    if (!joinStruct) throw new Error(`Table '${j.table}' not found in tableMap`);

    let joinCondition: any;

    // Support object with AND/OR inside 'on'
    if (j.on && (j.on.type === "and" || j.on.type === "or")) {
      // Complex condition
      joinCondition = await buildWhere(j.on, tableMap, user, query, default_table);
    } else {
      // Simple key-value mapping
      const conditions: any[] = [];
      for (const leftKey in j.on) {
        const rightKey = j.on[leftKey];
        const [lTbl, lCol] = leftKey.split(".");
        const [rTbl, rCol] = rightKey.split(".");

        const l = tableMap[lTbl]?.[lCol];
        const r = tableMap[rTbl]?.[rCol];

        if (!l || !r) throw new Error(`Invalid join keys: ${leftKey} -> ${rightKey}`);
        conditions.push(eq(l, r));
      }

      // If multiple conditions, combine with AND
      joinCondition = conditions.length > 1 ? and(...conditions) : conditions[0];
    }

    const joinTable = tableMap[j.table];
    if (!joinTable) throw new Error(`Join table '${j.table}' not found in tableMap`);

    // Apply the join type
    if (j.type === "INNER") q.innerJoin(joinTable, joinCondition);
    else if (j.type === "LEFT") q.leftJoin(joinTable, joinCondition);
    else throw new Error(`Unsupported join type: ${j.type}`);
  }
}


/*───────────────────────────────────────────────
  BUILD WHERE (now safe)
───────────────────────────────────────────────*/
async function buildWhere(cond: any, tableMap: Record<string, any>, user: any, query: StructuredQuery, default_table:any): Promise<any> {
  // Nested AND/OR
  if (cond.type && (cond.type.toUpperCase() === "AND" || cond.type.toUpperCase() === "OR")) {
    let parts = await Promise.all(
      cond.conditions.map((c: any) =>
        buildWhere(c, tableMap, user, query, default_table)
      )
    );
    
    const is_one_boolean = parts.some(part => typeof part == "boolean")
    if(is_one_boolean) {
      const has_true = parts.some(part => part === true)
      const has_false = parts.some(part => part === false)
      if(cond.type.toUpperCase() === "OR" && has_true) return true
      else if(cond.type.toUpperCase() === "AND" && has_false) return false
      else if(cond.type.toUpperCase() === "AND" && has_true) {
        parts = parts.filter(part => part != true)
        if(parts.length == 1) return parts
      }
    }
    return cond.type.toUpperCase() === "AND" ? and(...parts) : or(...parts);
  }
  else if(cond.type && cond.type.toUpperCase() == 'IF' && "when" in cond) {
    let condition:any = sql``
    const when_condition = await if_condition(cond.when, tableMap, user, query, default_table)
    if("do" in cond) {
      let do_condition
      if(typeof cond.do == 'object') do_condition = await buildWhere(cond.do, tableMap, user, query, default_table)
      else if(typeof cond.do == 'boolean') return cond.do
      else if(cond.do) do_condition = sql`${cond.do}`

      if(when_condition) {
        if(typeof do_condition == 'boolean') return do_condition
        else condition.append(do_condition)
      }
      else if("else" in cond) {
        let else_condition
        if(typeof cond.else == 'object') else_condition = await buildWhere(cond.else, tableMap, user, query, default_table)
        else if(typeof cond.else == 'boolean') else_condition = cond.else
        else if(cond.else) else_condition = sql`${cond.else}`
          
        if(!when_condition) {
          if(typeof else_condition == 'boolean') return else_condition
          else condition.append(else_condition)
        }
      }
    }
    return condition
  }

  // Determine left side
  let left: any;
  let right: any;

  let start: any
  let end: any

  if ("left_value" in cond) {
    left = resolveCustomValue(cond.left_value, user, query);

    if (left && typeof left === "object" && "$col" in left) {
      const [vTbl, vCol] = left.$col.split(".");
      const vColumn = tableMap[vTbl]?.[vCol];
      if (!vColumn) throw new Error(`Column '${left.$col}' not found`);
      left = vColumn;
    }
  } else if ("field" in cond) {
    const [tbl, col] = cond.field.split(".");
    const column = tableMap[tbl]?.[col];
    if (!column) throw new Error(`Column '${cond.field}' not found`);
    left = column;
  } else {
    throw new Error("Condition must have 'field' or 'left_value'");
  }

  if ("value" in cond) {
    right = resolveCustomValue(cond.value, user, query);

    // Handle $col references
    if (right && typeof right === "object" && "$col" in right) {
      const [vTbl, vCol] = right.$col.split(".");
      const vColumn = tableMap[vTbl]?.[vCol];
      if (!vColumn) throw new Error(`Column '${right.$col}' not found`);
      right = vColumn;
    }
  }
  
  if("start" in cond && "end" in cond && cond.operator && cond.operator.toUpperCase() == "BETWEEN") {
    start = resolveCustomValue(cond.start, user, query);

    if (start && typeof start === "object" && "$col" in start) {
      const [vTbl, vCol] = start.$col.split(".");
      const vColumn = tableMap[vTbl]?.[vCol];
      if (!vColumn) throw new Error(`Column '${start.$col}' not found`);
      start = vColumn;
    }

    end = resolveCustomValue(cond.end, user, query);

    // Handle $col references
    if (end && typeof end === "object" && "$col" in end) {
      const [vTbl, vCol] = end.$col.split(".");
      const vColumn = tableMap[vTbl]?.[vCol];
      if (!vColumn) throw new Error(`Column '${end.$col}' not found`);
      end = vColumn;
    }
  } else if(("start" in cond || "end" in cond)) {
    throw new Error("'start' or 'end' fields must have a compatible operator");
  } else if(cond.operator.toUpperCase() == "BETWEEN" && !("start" in cond && "end" in cond)) {
    throw new Error("Between operator must have 'start' and 'end' fields");
  }

  // Subquery IN
  if(cond.operator && cond.operator.toUpperCase() === "IN" && (left != null && left !=undefined)) {
    if (right && typeof right === "object" && "select" in right) {
      const subTable = tableMap[right.from];
      if (!subTable) throw new Error(`Table '${right.from}' not found`);
      const subColumn = subTable[right.select];
      if (!subColumn) throw new Error(`Column '${right.select}' not in table '${right.from}'`);
      const subWhere = right.where
        ? and(
            ...(await Promise.all(
              right.where.map((w: any) =>
                buildWhere(w, tableMap, user, query, default_table)
              )
            ))
          )
        : undefined;
      return inArray(left, db.select({ val: subColumn }).from(subTable).where(subWhere));
    }

    // Normal IN array
    if (Array.isArray(right)) return inArray(left, right);
  }else if(cond.operator && cond.operator.toUpperCase() === "IN") {
    return false
  }

  // Subquery EXISTS
  if (cond.operator && cond.operator.toUpperCase() === "EXISTS") {
    let subTable = null
    let subColumn = null
    let subWhere = null
    if(left && typeof left === "object" && "select" in left) {
      subTable = tableMap[left.from];
      if (!subTable) throw new Error(`Table '${left.from}' not found`);
      subColumn = subTable[left.select];
      if (!subColumn) throw new Error(`Column '${left.select}' not in table '${left.from}'`);
      subWhere = left.where
        ? and(
            ...(await Promise.all(
              left.where.map((w: any) =>
                buildWhere(w, tableMap, user, query, default_table)
              )
            ))
          )
        : undefined;
    }
    else if(right && typeof right === "object" && "select" in right) {
      subTable = tableMap[right.from];
      if (!subTable) throw new Error(`Table '${right.from}' not found`);
      subColumn = subTable[right.select];
      if (!subColumn) throw new Error(`Column '${right.select}' not in table '${right.from}'`);
      subWhere = right.where
        ? and(
            ...(await Promise.all(
              right.where.map((w: any) =>
                buildWhere(w, tableMap, user, query, default_table)
              )
            ))
          )
        : undefined;
      return inArray(left, db.select({ val: subColumn }).from(subTable).where(subWhere));
    }
    if(subTable && subColumn && subWhere) return exists(db.select({ val: subColumn }).from(subTable).where(subWhere));
  }

  // Literal operators
  if(cond.operator) {
    switch (cond.operator.toUpperCase()) {
      case "=": {
        if(right == null) return isNull(left)
        else return eq(left, right)
      };
      case "!=": {
        if(right == null) return isNull(left)
        else return ne(left, right)
      };
      case "<": return lt(left, right);
      case "<=": return lte(left, right);
      case ">": return gt(left, right);
      case ">=": return gte(left, right);
      case "LIKE": return like(left, right);
      case "ILIKE": return ilike(left, right);
      case "NOT ILIKE": return notIlike(left, right);
      case "IS": {
        if(right == null) return isNull(left)
        else throw new Error(`Unsupported operator: ${cond.operator}`);
      };
      case "IS NOT": {
        if(right == null) return isNotNull(left)
        else throw new Error(`Unsupported operator: ${cond.operator}`);
      };
      case "IS NULL": return isNull(left);
      case "IS NOT NULL": return isNotNull(left);
      case "BETWEEN": {
        console.log(cond, left, start, end)
        return between(left, start, end)
      }
    }
  }
  throw new Error(`Unsupported operator: ${cond.operator}`);
}


/*───────────────────────────────────────────────
  BUILD ACL WHERE
───────────────────────────────────────────────*/
function buildAclWhere(allowed: FieldPermission, user: any, query:StructuredQuery): WhereCondition | null {
  let aclWhere: WhereCondition | null = null;

  if(!Array.isArray(allowed)) {
    if (typeof allowed === "object" && allowed.where) {
      aclWhere = injectDynamicValues(JSON.parse(JSON.stringify(allowed.where)), user, query) as WhereCondition;
    }
  }

  return aclWhere;
}


async function run_after(query:StructuredQuery, user:any, others:any, is_recursived:boolean) {
  if(query.after && Array.isArray(query.after) && query.after.length > 0 && !is_recursived) {
    let afterQueries:any[] = []
    for(let after_query of query.after) {
      let returned_query: { execute: () => Promise<any> };
      try {
        // await here because buildDrizzleQuery returns a Promise
        returned_query = await buildDrizzleQuery(after_query, user, true);
      } catch (e) {
        console.error("Error building query:", e);
        continue;
      }

      // Execute the query
      let response: any;
      try {
        response = await returned_query.execute();
        afterQueries.push(response)
      } catch (e) {
        console.error("Error executing query:", e);
        continue;
      }
    }
    return { ...others, afterQueries };
  }
  return others
}

async function if_condition(where_condtion:WhereCondition, table_map:any, user:any, query:StructuredQuery, default_table:any):Promise<boolean> {
  let where = await buildWhere(where_condtion, table_map, user, query, default_table)

  // Start empty SQL object
  const need_table:boolean = has_field_or_col_attribute(where_condtion)
  
  let check_query:any = sql`COALESCE(MAX(CASE WHEN`.append(where).append(sql`THEN 1 ELSE 0 END ), 0) AS RESULT`);

  const from_table = need_table ? default_table : sql`(select 1) AS t`

  const builded_query = db.select({
    result: check_query
  }).from(from_table)

  if(query.join) await buildJoin(builded_query, query.join, table_map, user, query, from_table)

  builded_query.limit(1)
  console.log(builded_query.toSQL())
  const [rows]: any = await builded_query.execute()

  console.log(rows)
  const result = rows.result ?? 0;

  // Return as boolean
  return Boolean(result);
}

function has_field_or_col_attribute(
  input: any,
  insideFrom: boolean = false
): boolean {
  if (input === null || typeof input !== 'object') {
    return false;
  }

  if (Array.isArray(input)) {
    return input.some(item => has_field_or_col_attribute(item, insideFrom));
  }

  // If this object defines a FROM clause, everything below it is insideFrom
  const isFromScope = insideFrom || Object.prototype.hasOwnProperty.call(input, 'from');

  // Only count field / $col if NOT inside a from-scope
  if (
    !isFromScope &&
    (Object.prototype.hasOwnProperty.call(input, 'field') ||
     Object.prototype.hasOwnProperty.call(input, '$col'))
  ) {
    return true;
  }

  return Object.values(input).some(value =>
    has_field_or_col_attribute(value, isFromScope)
  );
}

function is_allowed_empty(allowed: FieldPermission) {
  if(Array.isArray(allowed) && allowed.length == 0) return true
  else if(!allowed) return true
  else if(allowed == '') return true
  else if(typeof allowed == 'object' && !Array.isArray(allowed) && allowed.field) {
    return is_allowed_empty(allowed.field)
  }
  return false
}

/*───────────────────────────────────────────────
  MAIN QUERY BUILDER
───────────────────────────────────────────────*/
export async function buildDrizzleQuery(db: Database, query: StructuredQuery, user: any, role:string, structure: Structure, is_recursived:boolean = false) {
  const tableName = query.table;
  const tableStruct = structure[tableName];
  if (!tableStruct) throw new Error(`Table ${tableName} not found`);

  console.log(role)
  const endpoint = tableStruct.endpoints.find((e:any) => e.type === query.type);
  if (!endpoint) throw new Error(`${query.type} not allowed on ${tableName}`);

  if(!endpoint[role]) {
    throw new Error(`Role '${role}' not allowed to perform ${query.type} on ${tableName}`);
  }
  
  const rolePermissions = endpoint[role];
  if (typeof rolePermissions === "string" || Array.isArray(rolePermissions)) {
    throw new Error(`Invalid role permissions format for role '${role}'`);
  }
  
  const allowed = rolePermissions.allowed ?? [];
  
  if(is_allowed_empty(allowed)) throw new Error("Not allowed");

  const tableMap: Record<string, any> = {};
  for (const tblName in structure) {
    tableMap[tblName] = structure[tblName].table;
  }

  let selected_data_fields: Record<string, any> = {};

  if(query.select) {
    selected_data_fields = resolve_fields(structure, query.select, query.type, role, query.table, tableMap);
    selected_data_fields = alias_selected_fields(selected_data_fields);
  }else if(query.data) {
    selected_data_fields = resolve_data(structure, query.data, query.type, role, query.table, tableMap);
  }

  const aclWhere = buildAclWhere(allowed, user, query)

  let combinedWhere: WhereCondition | undefined;
  if (query.where && aclWhere) {
    combinedWhere = {
      type: "and",
      conditions: [query.where, aclWhere]
    };
  } else if (query.where) {
    combinedWhere = query.where;
  } else if(aclWhere) {
    combinedWhere = aclWhere
  }

  let limit = null
  if(query.limit) limit = query.limit

  if (combinedWhere && typeof allowed != 'string' && !Array.isArray(allowed)) {
    const has_been_accepted = await if_condition(combinedWhere, tableMap, user, query, tableStruct.table)

    // rows always has one object: { RESULT: 0 } or 1
    if(!has_been_accepted) throw new Error("Not allowed")
  }

  const built_where = combinedWhere ? await buildWhere(combinedWhere!, tableMap, user, query, tableStruct.table) : false

  const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)

  /*────────────────────────────
    GET
  ────────────────────────────*/
  if (query.type === "GET") {
    const q = db.select(selected_data_fields).from(tableStruct.table);

    if (query.join) await buildJoin(q, query.join, tableMap, user, query, tableStruct.table);

    if (built_where) q.where(built_where);

    if (query.group_by) {
      q.groupBy(
        ...query.group_by.map((f:string) => {
          const [tbl, col] = f.includes(".") ? f.split(".") : [tableName, f];
          return tableMap[tbl][col];
        })
      );
    }

    const orderByFields =
      query.order_by ??
      endpoint?.order_by ??
      [];

    // Resolve default direction
    const defaultDirection =
      query.direction ??
      endpoint?.direction ??
      "ASC";

    if (orderByFields.length > 0) {
      q.orderBy(
        ...orderByFields.map((f: string) => {
          // Allow "column DESC" syntax
          const parts = f.trim().split(/\s+/);
          const columnPart = parts[0];
          const dir = (parts[1] ?? defaultDirection).toUpperCase();

          // Resolve table + column
          const [tbl, col] = columnPart.includes(".")
            ? columnPart.split(".")
            : [tableName, columnPart];

          if (!tableMap[tbl]?.[col]) {
            throw new Error(`Invalid order_by column: ${tbl}.${col}`);
          }

          return dir === "DESC"
            ? desc(tableMap[tbl][col])
            : asc(tableMap[tbl][col]);
        })
      );
    }

    if(limit != null) q.limit(limit)

    console.log(q.toSQL().sql, q.toSQL().params)
    return {
      execute: async () => {
        const rows = await q.execute();

        // Only run `after` if defined
        if (query.after && query.after.length > 0) {
          return await run_after(query, user, { rows }, is_recursived);
        }

        return rows;
      }
    };
  }

  /*────────────────────────────
    PUT
  ────────────────────────────*/
  if (query.type === "PUT") {
    if (!query.data) throw new Error("PUT requires data");
    
    if (!Object.keys(selected_data_fields).length) throw new Error("No allowed fields for PUT");

    const safe = stripPrefixes(selected_data_fields);

    if (!Object.keys(safe).length) {
      throw new Error("UPDATE has no writable fields");
    }

    return {
      execute: async () => {
        const beforeRows = db.select(pre_post_select_fields).from(tableStruct.table)
        
        if(built_where) {
          beforeRows.where(built_where)
        }

        if(limit != null) beforeRows.limit(limit)

        const before = await beforeRows.execute();

        const update_query = db.update(tableStruct.table).set(safe)
        
        if(built_where) {
          update_query.where(built_where)
        }

        if(limit != null) update_query.limit(limit)

        console.log(update_query.toSQL().sql, update_query.toSQL().params)
        
        const response = await update_query.execute();

        const afterRows = db.select(pre_post_select_fields).from(tableStruct.table)
        
        if(built_where) {
          afterRows.where(built_where)
        }

        if(limit != null) afterRows.limit(limit)
        
        const after = await afterRows.execute();

        return await run_after(query, user, { before, after, response }, is_recursived)
      }
    };
  }

  /*────────────────────────────
    POST
  ────────────────────────────*/
  if (query.type === "POST") {
    if (!query.data) throw new Error("POST requires data");
    
    if (!Object.keys(selected_data_fields).length) {
      throw new Error("No allowed fields for POST");
    }
    
    // Inject dynamic values ($user, $data, etc)
    if(!Array.isArray(allowed)) {
      if (typeof allowed === "object" && allowed.where) {
        injectDynamicValues(allowed.where, user, query, selected_data_fields);
      }
    }

    // Remove table prefixes (attendances.xxx → xxx)
    const safe = stripPrefixes(selected_data_fields);

    return {
      execute: async () => {
        const response = await db
          .insert(tableStruct.table)
          .values(safe)
          .execute();

        let insertedRows = null
        if(response && response[0]?.insertId) {
          insertedRows = await db
          .select(pre_post_select_fields)
          .from(tableStruct.table)
          .orderBy(desc(tableStruct.table.id))
          .where(eq(tableStruct.table.id, response[0]?.insertId!))
          .limit(1)
          .execute();
        }

        return await run_after(query, user, { before: null, after: insertedRows, response }, is_recursived)
      }
    };
  }

  /*────────────────────────────
    DELETE
  ────────────────────────────*/
  if (query.type === "DELETE") {
    
    return {
      execute: async () => {
        const toDelete = db.select(pre_post_select_fields).from(tableStruct.table)
        
        if(built_where) {
          toDelete.where(built_where);
        }

        if(limit != null) toDelete.limit(limit)

        const toDeleteRows = await toDelete.execute();

        const delete_query = db.delete(tableStruct.table)
        
        if(built_where) {
          delete_query.where(built_where);
        }

        if(limit != null) delete_query.limit(limit)
        
        const response = await delete_query.execute();

        return { before: toDeleteRows, after: null, response };
      }
    };
  }

  throw new Error("Invalid operation");
}