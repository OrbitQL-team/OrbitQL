import { 
  eq, like, and, or, sql, ne, lt, lte, gt, gte, inArray,
  ilike,
  notIlike,
  isNull,
  isNotNull,
  exists,
  between,
  type SQLWrapper,
  desc,
  asc,
  not,
  notLike,
  getTableName
} from "drizzle-orm";
import { Database, WhereCondition, type StructuredQuery, type FieldPermission, Structure, TableStructure, Response, RolePermissions, TriggerStructure, BuildWhereOptions } from "./types.ts";
import { alias_selected_fields, injectDynamicValues, is_op_type, resolve_fields, resolveCustomValue } from "./rbac";
import build_query from "./index.ts";

/*───────────────────────────────────────────────
  BUILD JOIN
───────────────────────────────────────────────*/
export async function buildJoin(db:Database, q: any, joins: any[], tableMap: Record<string, any>, user: any, role:string, structure: Structure, query: StructuredQuery, default_table:any) {
  for (const j of joins) {
    const joinStruct = tableMap[j.table];
    if (!joinStruct) throw new Error(`Table '${j.table}' not found in tableMap`);

    let joinCondition: any;

    // Support object with AND/OR inside 'on'
    if (j.on && (j.on.type === "and" || j.on.type === "or")) {
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
    if (j.type === "INNER") q.innerJoin(joinTable, joinCondition);
    else if (j.type === "LEFT") q.leftJoin(joinTable, joinCondition);
    else throw new Error(`Unsupported join type: ${j.type}`);
  }
}


/*───────────────────────────────────────────────
  BUILD WHERE
───────────────────────────────────────────────*/
export async function buildWhere(db: Database, cond: WhereCondition, tableMap: Record<string, any>, user: any, role: string, structure: Structure, query: StructuredQuery, default_table:any, default_table_name: string): Promise<any> {
  // Nested AND/OR
  if ('and' in cond || 'or' in cond) {
    let parts: SQLWrapper[] = [];

    if ("and" in cond && cond.and) {
        parts = await Promise.all(
            cond.and.map((c) =>
                buildWhere(db, c, tableMap, user, role, structure, query, default_table, default_table_name)
            )
        );
    } else if ("or" in cond && cond.or) {
        parts = await Promise.all(
            cond.or.map((c) =>
                buildWhere(db, c, tableMap, user, role, structure, query, default_table, default_table_name)
            )
        );
    }
    
    const is_one_boolean = parts.some(part => typeof part == "boolean")
    if(is_one_boolean) {
      const has_true = parts.some(part => typeof part === "boolean" && part === true)
      const has_false = parts.some(part => typeof part === "boolean" && part === false)
      if('or' in cond && cond.or && has_true) return sql`true`
      else if('and' in cond && cond.and && has_false) return sql`false`
      else if('and' in cond && cond.and && has_true) {
        parts = parts.filter(part => !(typeof part === "boolean" && part === true))
        console.log('PARTS: ', parts)
        if(parts.length == 1) return sql`${parts}`;
      }
    }
    return 'and' in cond ? and(...parts) : or(...parts);
  }
  else if('if' in cond && cond.if && "when" in cond.if && cond.if.when) {
    let condition:any = sql``
    const when_condition = await if_condition(db, cond.if.when, tableMap, user, role, structure, query, default_table)
    if("do" in cond.if) {
      if(when_condition) {
        let do_condition
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
  }else if('not' in cond && cond.not) {
    return not(await buildWhere(db, cond.not, tableMap, user, role, structure, query, default_table, default_table_name))
  }

  if (cond && ('op' in cond || 'operator' in cond) && is_op_type(cond, "EXISTS") && 'query' in cond) {
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

  // Determine left side
  let left: any;
  let right: any;

  let start: any
  let end: any

  if ("left_value" in cond) {
    left = resolveCustomValue(cond.left_value, user, query, tableMap, default_table_name);
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
    left = resolveCustomValue(cond.value, user, query, tableMap, default_table_name);
  } else {
    console.log(cond)
    throw new Error("Condition must have 'field' or 'left_value' or 'value");
  }

  if ("value" in cond) {
    right = resolveCustomValue(cond.value, user, query, tableMap, default_table_name);
  }
  
  if("start" in cond && "end" in cond && is_op_type(cond, "BETWEEN")) {
    start = resolveCustomValue(cond.start, user, query, tableMap, default_table_name);
    end = resolveCustomValue(cond.end, user, query, tableMap, default_table_name);
  } else if(("start" in cond || "end" in cond)) {
    throw new Error("'start' or 'end' fields must have a compatible operator");
  } else if(is_op_type(cond, "BETWEEN") && !("start" in cond && "end" in cond)) {
    throw new Error("Between operator must have 'start' and 'end' fields");
  }

  // Subquery IN
  if(is_op_type(cond, "IN") && (left != null && left !=undefined)) {
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
  }else if(is_op_type(cond, "IN")) {
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
    }
  }
  throw new Error(`Unsupported operator: ${operator}`);
}


/*───────────────────────────────────────────────
  BUILD ACL WHERE
───────────────────────────────────────────────*/
export function buildAclWhere(allowed: FieldPermission, disallowed: FieldPermission, user: any, query:StructuredQuery, tableMap: Record<string, any>, default_table_name: string): WhereCondition | null {
  // Start with undefined
  let aclWhere: WhereCondition | null = null;

  // Helper to inject if `where` exists
  //function injectIfExists(obj: any) {
  //  return obj && obj.where ? (injectDynamicValues(obj.where, user, query, tableMap, default_table_name) as WhereCondition) : undefined;
  //}

  // !NEED TO BE TESTED AND SEE IF IS USELESS INJECTDYNAMICVALUES
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

/*───────────────────────────────────────────────
  AFTER ROWS EXECUTIONS
───────────────────────────────────────────────*/
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

/*───────────────────────────────────────────────
  IF CONDITION
───────────────────────────────────────────────*/
export async function if_condition(db:Database, where_condtion:WhereCondition, table_map:any, user:any, role: string, structure: Structure, query:StructuredQuery, default_table:any):Promise<boolean> {
  let where = await buildWhere(db, where_condtion, table_map, user, role, structure, query, default_table, getTableName(default_table));

  // Start empty SQL object
  const need_table:boolean = has_field_or_col_attribute(where_condtion)
  
  let check_query:any = sql`COALESCE(MAX(CASE WHEN `.append(sql`${where}`).append(sql` THEN 1 ELSE 0 END ), 0) AS RESULT`);

  const from_table = need_table ? default_table : sql`(select 1) AS t`

  const builded_query = db.select({
    result: check_query
  }).from(from_table)

  if(query.join) await buildJoin(db, builded_query, query.join, table_map, user, role, structure, query, from_table)

  builded_query.limit(1)
  const [rows]: any = await builded_query.execute()

  console.log(rows)
  const result = rows.result ?? 0;

  // Return as boolean
  return Boolean(result);
}

/*───────────────────────────────────────────────
  CHECKS FUNCTIONS
───────────────────────────────────────────────*/
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


/*───────────────────────────────────────────────
  ENDPOINT METHODS
───────────────────────────────────────────────*/
export async function get_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, rolePermissions:RolePermissions, role:string, tableStruct:TableStructure, tableMap: Record<string, any>, selected_data_fields: Record<string, any>, built_where:any, tableName:string, limit:any) {
  const q = db.select(selected_data_fields).from(tableStruct.table);

  if (query.join) await buildJoin(db, q, query.join, tableMap, user, role, structure, query, tableStruct.table);

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
    rolePermissions?.order_by ??
    [];

  // Resolve default direction
  const defaultDirection =
    query.direction ??
    rolePermissions?.direction ??
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
        return await run_after(db, options, query, user, { rows }, role, structure);
      }

      return rows;
    }
  };
}

export async function put_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, pre_post_select_fields: Record<string, any>, role:string, tableStruct:TableStructure, selected_data_fields: Record<string, any>, built_where:any, limit:any, return_before: boolean, return_after:boolean) {
  if (!query.data) throw new Error("PUT requires data");

  return {
    execute: async () => {
      const result:Response = {} as Response
      
      if(return_before) {
        const beforeRows = db.select(pre_post_select_fields).from(tableStruct.table)
        
        if(built_where) {
          beforeRows.where(built_where)
        }

        if(limit != null) beforeRows.limit(limit)

        result.before = await beforeRows.execute();
      }

      const update_query = db.update(tableStruct.table).set(selected_data_fields)
      
      if(built_where) {
        update_query.where(built_where)
      }

      if(limit != null) update_query.limit(limit)
      
      result.response = await update_query.execute();

      if(return_after) {
        const afterRows = db.select(pre_post_select_fields).from(tableStruct.table)
      
        if(built_where) {
          afterRows.where(built_where)
        }

        if(limit != null) afterRows.limit(limit)
        
        result.after = await afterRows.execute();
      }

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

export async function post_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, pre_post_select_fields: Record<string, any>, role:string, tableStruct:TableStructure, selected_data_fields: Record<string, any>, return_after:boolean) {
  if (!query.data) throw new Error("POST requires data");

  return {
    execute: async () => {
      const result:Response = {} as Response
      const response = await db
        .insert(tableStruct.table)
        .values(selected_data_fields)
        .execute();

      result.response = response

      if(return_after) {
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
        result.after = insertedRows
      }

      result.before = null

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

export async function delete_method(db: Database, options:BuildWhereOptions, query: StructuredQuery, user:string, structure:Structure, pre_post_select_fields: Record<string, any>, role:string, tableStruct:TableStructure, built_where:any, limit:any, return_before: boolean){
  return {
    execute: async () => {
      const result:Response = {} as Response
      if(return_before) {
        const toDelete = db.select(pre_post_select_fields).from(tableStruct.table)
      
        if(built_where) {
          toDelete.where(built_where);
        }

        if(limit != null) toDelete.limit(limit)

        const toDeleteRows = await toDelete.execute();
        result.before = toDeleteRows
      }

      const delete_query = db.delete(tableStruct.table)
      
      if(built_where) {
        delete_query.where(built_where);
      }

      if(limit != null) delete_query.limit(limit)
      
      result.response = await delete_query.execute();
      
      result.after

      return await run_after(db, options, query, user, result, role, structure)
    }
  };
}

export async function run_triggers(db: Database, options:BuildWhereOptions, query: StructuredQuery, user: any, role:string, structure: Structure, tableMap: Record<string, any>, tableStruct:TableStructure, selected_data_fields: Record<string, any>, built_where:any, triggers:TriggerStructure[], after:boolean = false) {
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
        if(typeof condition.do == "object" && "type" in condition.do) {
          await build_query(db, condition.do, user, role, structure, {
            disable_triggers: true,
            after: false,
            ...options
          })
        }
      }else if(!when_condition && condition.else) {
        if(typeof condition.else == "object" && "type" in condition.else) {
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
