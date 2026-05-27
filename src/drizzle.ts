import { 
  eq, like, and, or, sql, ne, lt, lte, gt, gte, inArray,
  ilike,
  notIlike,
  isNull,
  isNotNull,
  exists,
  between,
  not,
  notLike,
  getTableName,
  notExists,
  notInArray,
  notBetween
} from "drizzle-orm";
import { Database, WhereCondition, type StructuredQuery, type FieldPermission, Structure, TableStructure, RolePermissions, TriggerStructure, BuildWhereOptions, IfCondition, ExistsCondition, NotExistsCondition, Returning } from "./types.ts";
import { alias_selected_fields, is_op_type, requests_data, resolve_fields, resolve_group_by_fields, resolve_order_by_fields, resolve_returning_fields, resolveCustomValue, toArray } from "./rbac";
import build_query from "./index.ts";

/* -------------------------------------------------------------------------- */
/*                                 BUILD JOINS                                */
/* -------------------------------------------------------------------------- */

export async function buildJoin(db:Database, q: any, joins: any[], tableMap: Record<string, any>, user: any, role:string, structure: Structure, query: StructuredQuery, default_table:any) {
  for (const j of joins) {
    const joinStruct = tableMap[j.table];
    if (!joinStruct) throw new Error(`Table '${j.table}' not found in tableMap`);

    let joinCondition: any;

    // Support object with AND/OR inside 'on'
    if (j.on && j.on.type && (j.on.type.toUpperCase() === "AND" || j.on.type.toUpperCase() === "OR")) {
      // Complex condition
      joinCondition = await buildWhere(db, j.on, tableMap, user, role, structure, query, default_table, getTableName(default_table));
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
    if (j.type.toUpperCase() === "INNER") q.innerJoin(joinTable, joinCondition);
    else if (j.type.toUpperCase() === "LEFT") q.leftJoin(joinTable, joinCondition);
    else throw new Error(`Unsupported join type: ${j.type}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                               MAIN CONDITIONS                              */
/* -------------------------------------------------------------------------- */

async function and_condition(parts:any[]) { 
  const is_one_boolean = parts.some(part => typeof part == "boolean")
  if(is_one_boolean) {
    const has_false = parts.some(part => typeof part === "boolean" && part === false)
    if(has_false) return sql`false`
    else {
      parts = parts.filter(part => !(typeof part === "boolean" && part === true))
      console.log('PARTS: ', parts)
      if(parts.length == 1) return sql`${parts}`;
    }
  }
  return and(...parts);
}

async function or_condition(parts: any[]) {
  const is_one_boolean = parts.some(part => typeof part == "boolean")
  if(is_one_boolean) {
    const has_true = parts.some(part => typeof part === "boolean" && part === true)
    if(has_true) return sql`true`
  }
  return or(...parts);
} 

async function if_conditions(db: Database, cond: IfCondition, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery, default_table:any, default_table_name: string) {
  let condition:any = sql``
  const when_condition = await if_condition(db, cond.if.when, tableMap, user, role, structure, query, default_table)
  if("do" in cond.if) {
    if(when_condition) {
      let do_condition
      if(typeof cond.if.do == 'function') throw Error('Function not allowed in where condition')
      if(typeof cond.if.do == 'object') {
        if(("type" in cond.if.do)) throw Error('Structured Query not allowed in where condition')
        else do_condition = await buildWhere(db, cond.if.do, tableMap, user, role, structure, query, default_table, default_table_name)
      }
      else if(typeof cond.if.do == 'boolean') return cond.if.do
      else if(cond.if.do) do_condition = sql`${cond.if.do}`

      condition.append(do_condition)
    }
    else if("else" in cond.if) {
      let else_condition
      if(typeof cond.if.else == 'function') throw Error('Function not allowed in where condition')
      if(typeof cond.if.else == 'object') {
        if(("type" in cond.if.else)) throw Error('Structured Query not allowed in where condition')
        else else_condition = await buildWhere(db, cond.if.else, tableMap, user, role, structure, query, default_table, default_table_name)
      }
      else if(typeof cond.if.else == 'boolean') return cond.if.else
      else if(cond.if.else) else_condition = sql`${cond.if.else}`
        
      condition.append(else_condition)
    }
  }
  return condition
}

async function exists_condition(db: Database, cond: ExistsCondition, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery) {
  let subTable = null
  let fields = null
  let subWhere = null
  const sub_query = cond.query
  if(sub_query) {
    subTable = tableMap[sub_query.from];
    if (!subTable) throw new Error(`Table '${sub_query.from}' not found`);
    fields = resolve_fields(structure, sub_query.select, 'GET', role, subTable, tableMap);
    fields = alias_selected_fields(fields);
    if(!fields) throw new Error(`Inner fields not found`);
    subWhere = sub_query.where
      ? await buildWhere(db, sub_query.where, tableMap, user, role, structure, query, subTable, getTableName(subTable))
      : undefined;
  }
  let inner_query = db.select(fields).from(subTable)
  if(subWhere) {
    inner_query = inner_query.where(subWhere)
  }
  return exists(inner_query);
}

async function not_exists_condition(db: Database, cond: NotExistsCondition, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery) {
  let subTable = null
  let fields = null
  let subWhere = null
  const sub_query = cond.query
  if(sub_query) {
    subTable = tableMap[sub_query.from];
    if (!subTable) throw new Error(`Table '${sub_query.from}' not found`);
    fields = resolve_fields(structure, sub_query.select, 'GET', role, subTable, tableMap);
    fields = alias_selected_fields(fields);
    if(!fields) throw new Error(`Inner fields not found`);
    subWhere = sub_query.where
      ? await buildWhere(db, sub_query.where, tableMap, user, role, structure, query, subTable, getTableName(subTable))
      : undefined;
  }
  let inner_query = db.select(fields).from(subTable)
  if(subWhere) {
    inner_query = inner_query.where(subWhere)
  }
  return notExists(inner_query);
}

async function in_condition(db: Database, left:any, right: any, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery) {
  if (right && typeof right === "object" && "select" in right) {
    const subTable = tableMap[right.from];
    if (!subTable) throw new Error(`Table '${right.from}' not found`);
    let fields = resolve_fields(structure, right.select, 'GET', role, subTable, tableMap);
    fields = alias_selected_fields(fields);
    if(!fields) throw new Error(`Inner fields not found`);
    const subWhere = right.where
      ? await buildWhere(db, right.where, tableMap, user, role, structure, query, subTable, getTableName(subTable))
      : undefined;
    let inner_query = db.select(fields).from(subTable)
    if(subWhere) {
      inner_query = inner_query.where(subWhere)
    }
    return inArray(left, inner_query);
  }
  // Normal IN array
  if (Array.isArray(right)) return inArray(left, right);
  throw Error('Wrong values for in condition')
}

async function not_in_condition(db: Database, left:any, right: any, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery) {
  if (right && typeof right === "object" && "select" in right) {
      const subTable = tableMap[right.from];
      if (!subTable) throw new Error(`Table '${right.from}' not found`);
      let fields = resolve_fields(structure, right.select, 'GET', role, subTable, tableMap);
      fields = alias_selected_fields(fields);
      if(!fields) throw new Error(`Inner fields not found`);
      const subWhere = right.where
        ? await buildWhere(db, right.where, tableMap, user, role, structure, query, subTable, getTableName(subTable))
        : undefined;
      let inner_query = db.select(fields).from(subTable)
      if(subWhere) {
        inner_query = inner_query.where(subWhere)
      }
      return notInArray(left, inner_query);
    }
    // Normal NOT IN array
    if (Array.isArray(right)) return notInArray(left, right);
  throw Error('Wrong values for not in condition')
}

/* -------------------------------------------------------------------------- */
/*                                WHERE BUILDER                               */
/* -------------------------------------------------------------------------- */

export async function buildWhere(db: Database, cond: WhereCondition, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery, default_table:any, default_table_name: string, custom_data?:Record<string, any>): Promise<any> {
  // Nested AND/OR
  if ("and" in cond && cond.and) {
    let parts = await Promise.all(
      cond.and.map((c) =>
        buildWhere(db, c, tableMap, user, role, structure, query, default_table, default_table_name)
      )
    );
    return await and_condition(parts)
  }
  else if ("or" in cond && cond.or) {
    let parts = await Promise.all(
      cond.or.map((c) =>
        buildWhere(db, c, tableMap, user, role, structure, query, default_table, default_table_name)
      )
    );
    return await or_condition(parts)
  }
  else if('if' in cond && cond.if && "when" in cond.if && cond.if.when) {
    return await if_conditions(db, cond, tableMap, user, role, structure, query, default_table, default_table_name)
  }else if('not' in cond && cond.not) {
    return not(await buildWhere(db, cond.not, tableMap, user, role, structure, query, default_table, default_table_name))
  }

  if (cond && ('op' in cond || 'operator' in cond) && is_op_type(cond, "EXISTS") && 'query' in cond) {
    return await exists_condition(db, cond, tableMap, user, role, structure, query)
  }

  if (cond && ('op' in cond || 'operator' in cond) && is_op_type(cond, "NOT EXISTS") && 'query' in cond) {
    return await not_exists_condition(db, cond, tableMap, user, role, structure, query)
  }

  // Determine left side
  let left: any;
  let right: any;

  let start: any
  let end: any

  if(!custom_data && !('if' in cond ) && requests_data(cond) && query.data && Array.isArray(query.data)) {
    //AND CONDITION AND PASS CUSTOM DATA FOR EACH OF THE ARRAY
    let parts = await Promise.all(
      query.data.map((custom_data) =>
        buildWhere(db, cond, tableMap, user, role, structure, query, default_table, default_table_name, custom_data)
      )
    );
    return await and_condition(parts)
  }

  if ("left_value" in cond) {
    left = resolveCustomValue(cond.left_value, user, query, tableMap, default_table_name, custom_data);
  } else if ("field" in cond && cond.field) {
    let tbl, col;
    if(cond.field.includes(".")) {
      [tbl, col] = cond.field.split(".");
    }else {
      col = cond.field;
      tbl = default_table_name;
    }
    const column = tableMap[tbl]?.[col];
    if (!column) throw new Error(`Column '${cond.field}' not found`);
    left = column;
  } else if("value" in cond) {
    left = resolveCustomValue(cond.value, user, query, tableMap, default_table_name, custom_data);
  } else {
    console.log(cond)
    throw new Error("Condition must have 'field' or 'left_value' or 'value");
  }

  if ("value" in cond) {
    right = resolveCustomValue(cond.value, user, query, tableMap, default_table_name, custom_data);
  }
  
  if("start" in cond && "end" in cond && is_op_type(cond, "BETWEEN")) {
    start = resolveCustomValue(cond.start, user, query, tableMap, default_table_name, custom_data);
    end = resolveCustomValue(cond.end, user, query, tableMap, default_table_name, custom_data);
  } else if(("start" in cond || "end" in cond)) {
    throw new Error("'start' or 'end' fields must have a compatible operator");
  } else if(is_op_type(cond, "BETWEEN") && !("start" in cond && "end" in cond)) {
    throw new Error("Between operator must have 'start' and 'end' fields");
  }

  // Subquery IN
  if(is_op_type(cond, "IN") && (left != null && left !=undefined)) {
    return await in_condition(db, left, right, tableMap, user, role, structure, query)
  }else if(is_op_type(cond, "IN")) {
    return sql`false`
  }

  if(is_op_type(cond, "NOT IN") && (left != null && left !=undefined)) {
    return await not_in_condition(db, left, right, tableMap, user, role, structure, query)
  }else if(is_op_type(cond, "NOT IN")) {
    return sql`false`
  }

  const operator = cond.operator ?? cond.op

  // Literal operators
  if(operator) {
    switch (operator.toUpperCase()) {
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
      case "NOT LIKE": return notLike(left, right);
      case "ILIKE": return ilike(left, right);
      case "NOT ILIKE": return notIlike(left, right);
      case "IS": {
        if(right == null) return isNull(left)
        else throw new Error(`Unsupported operator: ${operator}`);
      };
      case "IS NOT": {
        if(right == null) return isNotNull(left)
        else throw new Error(`Unsupported operator: ${operator}`);
      };
      case "IS NULL": return isNull(left);
      case "IS NOT NULL": return isNotNull(left);
      case "BETWEEN": {
        return between(left, start, end)
      }
      case "NOT BETWEEN": {
        return notBetween(left, start, end)
      }
    }
  }
  throw new Error(`Unsupported operator: ${operator}`);
}

/* -------------------------------------------------------------------------- */
/*                                 ACL BUILDER                                */
/* -------------------------------------------------------------------------- */

export function buildAclWhere(allowed: FieldPermission, disallowed: FieldPermission): WhereCondition | null {
  // Start with undefined
  let aclWhere: WhereCondition | null = null;

  function injectIfExists(obj: any) {
     return obj && obj.where ? (obj.where as WhereCondition) : undefined;
  }
  
  const allowedWhere = injectIfExists(allowed);
  const disallowedWhere = injectIfExists(disallowed);

  if (allowedWhere && disallowedWhere) {
    aclWhere = {
      and: [
        allowedWhere,
        {
          not: disallowedWhere
        }
      ],
    };
  } else if (allowedWhere) {
    aclWhere = allowedWhere;
  } else if (disallowedWhere) {
    aclWhere = {
      not: disallowedWhere
    };
  }

  return aclWhere;
}

/* -------------------------------------------------------------------------- */
/*                            AFTER QUERIES BUILDER                           */
/* -------------------------------------------------------------------------- */

export async function run_after(db:Database, options:BuildWhereOptions, query:StructuredQuery, user:any, others:any, role:string, structure: Structure) {
  if(!options.after) return others
  if(query.after && Array.isArray(query.after) && query.after.length > 0) {
    let afterQueries:any[] = []
    const spliced_queries = typeof options.after == 'number' ? query.after.slice(0, options.after) : query.after;
    for(let after_query of spliced_queries) {
      let returned_query: { execute: () => Promise<any> };
      try {
        // await here because build_query returns a Promise
        returned_query = await build_query(db, after_query, user, role, structure, {
          after: false,
          ...options
        });
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

/* -------------------------------------------------------------------------- */
/*                      IF CONDITION TO VALIDATE QUERIES                      */
/* -------------------------------------------------------------------------- */

export async function if_condition(db:Database, where_condtion:WhereCondition, table_map:any, user:any, role: string, structure: Structure, query:StructuredQuery, default_table:any):Promise<boolean> {
  let where = await buildWhere(db, where_condtion, table_map, user, role, structure, query, default_table, getTableName(default_table));

  // Start empty SQL object
  const need_table:boolean = query.join ? true : has_field_or_col_attribute(where_condtion)
  
  let check_query:any = sql`COALESCE(MAX(CASE WHEN `.append(sql`${where}`).append(sql` THEN 1 ELSE 0 END ), 0) AS RESULT`);

  const from_table = need_table ? default_table : sql`(select 1) AS t`

  const builded_query = db.select({
    result: check_query
  }).from(from_table)

  if(query.join) await buildJoin(db, builded_query, query.join, table_map, user, role, structure, query, from_table)

  builded_query.limit(1)
  console.log(builded_query.toSQL().sql, builded_query.toSQL().params)
  const [rows]: any = await builded_query.execute()

  console.log(rows)
  const result = rows.result ?? 0;

  // Return as boolean
  return Boolean(result);
}

/* -------------------------------------------------------------------------- */
/*         CHECK IF HAS FIELD OR COL TO ADD OR NOT TABLE TO CONDITION         */
/* -------------------------------------------------------------------------- */

export function has_field_or_col_attribute(
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

export function is_allowed_empty(allowed: FieldPermission) {
  if(Array.isArray(allowed) && allowed.length == 0) return true
  else if(!allowed) return true
  else if(allowed == '') return true
  else if(typeof allowed == 'object' && !Array.isArray(allowed) && allowed.field) {
    return is_allowed_empty(allowed.field)
  }
  return false
}

/* -------------------------------------------------------------------------- */
/*                           ENDPOINT QUERY METHODS                           */
/* -------------------------------------------------------------------------- */

export async function get_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, rolePermissions:RolePermissions, role:string, tableStruct:TableStructure, tableMap: Record<string, any>, selected_data_fields: Record<string, any>, built_where:any, tableName:string, limit:any) {
  const q = db.select(selected_data_fields).from(tableStruct.table);

  if (query.join) await buildJoin(db, q, query.join, tableMap, user, role, structure, query, tableStruct.table);

  if (built_where) q.where(built_where);

  const groupByFields =
    resolve_group_by_fields(structure, toArray(query.group_by), query.type, role, tableName, tableMap) ??
    toArray(rolePermissions?.group_by) ??
    [];

  if (groupByFields.length > 0) {
    q.groupBy(...groupByFields);
  }

  const orderByFields =
    resolve_order_by_fields(structure, toArray(query.order_by), query.type, role, tableName, tableMap) ??
    toArray(rolePermissions?.order_by) ??
    [];

  if (orderByFields.length > 0) {
    q.orderBy(...orderByFields);
  }

  if(limit != null) q.limit(limit)

  return {
    execute: async () => {
      const sql = q.toSQL()
      console.log(sql.sql, sql.params)
      const rows = await q.execute();

      // Only run `after` if defined
      if (query.after && query.after.length > 0) {
        return await run_after(db, options, query, user, { rows }, role, structure);
      }

      return rows;
    }
  };
}

export async function put_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, rolePermissions:RolePermissions, role:string, tableStruct:TableStructure, tableMap: Record<string, any>, selected_data_fields: Record<string, any>, built_where:any, tableName:string, limit:any) {
  if (!query.data) throw new Error("PUT requires data");

  return {
    execute: async () => {

      const update_query = db.update(tableStruct.table).set(selected_data_fields)
      
      if(built_where) {
        update_query.where(built_where)
      }

      const orderByFields =
        resolve_order_by_fields(structure, toArray(query.order_by), query.type, role, tableName, tableMap) ??
        toArray(rolePermissions?.order_by) ??
        [];

      if (orderByFields.length > 0) {
        update_query.orderBy(...orderByFields);
      }

      if(limit != null) update_query.limit(limit)

      if(query.returning) {
        let fields = resolve_returning_fields(structure, query.returning, query.type, role, tableName, tableMap)
        fields = alias_selected_fields(fields)
        if (Object.keys(fields).length === 0) {
          throw new Error("No valid returning fields allowed");
        }
        if (typeof update_query.returning === 'function') {
          update_query.returning(fields);
        }else if (typeof update_query.output === 'function') {
          update_query.output(fields);
        }
      }
      
      let result = await update_query.execute();

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

export async function post_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, role:string, tableStruct:TableStructure, tableMap: Record<string, any>, selected_data_fields: Record<string, any>, tableName:string) {
  if (!query.data) throw new Error("POST requires data");

  return {
    execute: async () => {
      const post_query = db
        .insert(tableStruct.table)
        .values(selected_data_fields)

      if(query.returning) {
        let fields = resolve_returning_fields(structure, query.returning, query.type, role, tableName, tableMap)
        fields = alias_selected_fields(fields)
        if (Object.keys(fields).length === 0) {
          throw new Error("No valid returning fields allowed");
        }
        if (typeof post_query.returning === 'function') {
          post_query.returning(fields);
        }else if (typeof post_query.$returningId === 'function') {
          post_query.$returningId(fields);
        }else if (typeof post_query.output === 'function') {
          post_query.output(fields);
        }
      }
        
      let result = await post_query.execute();

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

export async function delete_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, rolePermissions:RolePermissions, role:string, tableStruct:TableStructure, tableMap: Record<string, any>, built_where:any, tableName:string, limit:any){
  return {
    execute: async () => {
      const delete_query = db.delete(tableStruct.table)
      
      if(built_where) {
        delete_query.where(built_where);
      }

      const orderByFields =
        resolve_order_by_fields(structure, toArray(query.order_by), query.type, role, tableName, tableMap) ??
        toArray(rolePermissions?.order_by) ??
        [];

      if (orderByFields.length > 0) {
        delete_query.orderBy(...orderByFields);
      }

      if(limit != null) delete_query.limit(limit)

      if(query.returning) {
        let fields = resolve_returning_fields(structure, query.returning, query.type, role, tableName, tableMap)
        fields = alias_selected_fields(fields)
        if (Object.keys(fields).length === 0) {
          throw new Error("No valid returning fields allowed");
        }
        if (typeof delete_query.returning === 'function') {
          delete_query.returning(fields);
        }else if (typeof delete_query.output === 'function') {
          delete_query.output(fields);
        }
      }
      
      let result = await delete_query.execute();

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

/* -------------------------------------------------------------------------- */
/*                               TRIGGERS RUNNER                              */
/* -------------------------------------------------------------------------- */

export async function run_triggers(db: Database, options:BuildWhereOptions, query: StructuredQuery, user: any, role:string, structure: Structure, tableMap: Record<string, any>, tableStruct:TableStructure, selected_data_fields: Record<string, any>, triggers:TriggerStructure[], after:boolean = false) {
  const timing_filtered_triggers = triggers.filter((trigger)=>{
    if(after && trigger.type.toUpperCase() == 'AFTER') {
      return true
    }else if(!after && trigger.type.toUpperCase() == 'BEFORE') {
      return true
    }
    return false
  })
  for(let trigger of timing_filtered_triggers) {
    if("if" in trigger.query) {
      const condition = trigger.query.if
      const when_condition = await if_condition(db, condition.when, tableMap, user, role, structure, query, tableStruct.table)
      if(when_condition && condition.do) {
        if(typeof condition.do == "function" && "type" in condition.do) {
          await condition.do();
        }else if(typeof condition.do == "object" && "type" in condition.do) {
          await build_query(db, condition.do, user, role, structure, {
            disable_triggers: true,
            after: false,
            ...options
          })
        }
      }else if(!when_condition && condition.else) {
        if(typeof condition.else == "function" && "type" in condition.else) {
          await condition.else();
        }else if(typeof condition.else == "object" && "type" in condition.else) {
          await build_query(db, condition.else, user, role, structure, {
            disable_triggers: true,
            after: false,
            ...options
          })
        }
      }
    }
    if ("set" in trigger.query) {
      if (after) {
        console.log('Set not available in after queries')
        continue
      }

      const set = trigger.query.set
      const table_name = getTableName(tableStruct.table)

      const where = await buildWhere(
        db,
        set.when,
        tableMap,
        user,
        role,
        structure,
        query,
        tableStruct.table,
        table_name
      )

      const set_value = resolveCustomValue(
        set.value,
        user,
        query,
        tableMap,
        table_name
      )

      let fallback_value

      if ("else_value" in set) {
        fallback_value = resolveCustomValue(
          set.else_value,
          user,
          query,
          tableMap,
          table_name
        )
      } else if (selected_data_fields[set.field]) {
        // preserve previous transformation safely
        fallback_value = selected_data_fields[set.field]
      } else {
        fallback_value = sql`COALESCE(${set_value}, '')`
      }

      console.log('SETTING: ', set.field)

      selected_data_fields[set.field] = sql`
        CASE 
          WHEN ${where} THEN ${set_value}
          ELSE ${fallback_value}
        END
      `
    }
    if("type" in trigger.query) {
      await build_query(db, trigger.query, user, role, structure, {
        disable_triggers: true,
        after: false,
        ...options
      })
    }
  }
  return selected_data_fields
}
