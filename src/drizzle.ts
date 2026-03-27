import { 
  eq, like, and, or, sql, ne, lt, lte, gt, gte, inArray,
  ilike,
  notIlike,
  isNull,
  isNotNull,
  exists,
  between,
  type SQLWrapper
} from "drizzle-orm";
import { Database, WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure } from "./types.ts";
import { injectDynamicValues, resolveCustomValue } from "./rbac";
import { buildDrizzleQuery } from "./index.ts";

/*───────────────────────────────────────────────
  BUILD JOIN
───────────────────────────────────────────────*/
export async function buildJoin(db:Database, q: any, joins: any[], tableMap: Record<string, any>, user: any, query: StructuredQuery, default_table:any) {
  for (const j of joins) {
    const joinStruct = tableMap[j.table];
    if (!joinStruct) throw new Error(`Table '${j.table}' not found in tableMap`);

    let joinCondition: any;

    // Support object with AND/OR inside 'on'
    if (j.on && (j.on.type === "and" || j.on.type === "or")) {
      // Complex condition
      joinCondition = await buildWhere(db, j.on, tableMap, user, query, default_table);
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
export async function buildWhere(db: Database, cond: WhereCondition, tableMap: Record<string, any>, user: any, query: StructuredQuery, default_table:any): Promise<any> {
  // Nested AND/OR
  if ('and' in cond || 'or' in cond) {
    let parts: SQLWrapper[] = [];

    if ("and" in cond && cond.and) {
        parts = await Promise.all(
            cond.and.map((c) =>
                buildWhere(db, c, tableMap, user, query, default_table)
            )
        );
    } else if ("or" in cond && cond.or) {
        parts = await Promise.all(
            cond.or.map((c) =>
                buildWhere(db, c, tableMap, user, query, default_table)
            )
        );
    }
    
    const is_one_boolean = parts.some(part => typeof part == "boolean")
    if(is_one_boolean) {
      const has_true = parts.some(part => typeof part === "boolean" && part === true)
      const has_false = parts.some(part => typeof part === "boolean" && part === false)
      if('or' in cond && has_true) return true
      else if('and' in cond && has_false) return false
      else if('and' in cond && has_true) {
        parts = parts.filter(part => !(typeof part === "boolean" && part === true))
        if(parts.length == 1) return parts
      }
    }
    return 'and' in cond ? and(...parts) : or(...parts);
  }
  else if('if' in cond && "when" in cond && cond.when) {
    let condition:any = sql``
    const when_condition = await if_condition(db, cond.when, tableMap, user, query, default_table)
    if("do" in cond && cond.do) {
      let do_condition
      if(typeof cond.do == 'object') do_condition = await buildWhere(db, cond.do, tableMap, user, query, default_table)
      else if(typeof cond.do == 'boolean') return cond.do
      else if(cond.do) do_condition = sql`${cond.do}`

      if(when_condition) {
        if(typeof do_condition == 'boolean') return do_condition
        else condition.append(do_condition)
      }
      else if("else" in cond && cond.else) {
        let else_condition
        if(typeof cond.else == 'object') else_condition = await buildWhere(db, cond.else, tableMap, user, query, default_table)
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
  } else if ("field" in cond && cond.field) {
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
  } else if(cond.operator && cond.operator.toUpperCase() == "BETWEEN" && !("start" in cond && "end" in cond)) {
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
                buildWhere(db, w, tableMap, user, query, default_table)
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
                buildWhere(db, w, tableMap, user, query, default_table)
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
                buildWhere(db, w, tableMap, user, query, default_table)
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
export function buildAclWhere(allowed: FieldPermission, user: any, query:StructuredQuery): WhereCondition | null {
  let aclWhere: WhereCondition | null = null;

  if(!Array.isArray(allowed)) {
    if (typeof allowed === "object" && allowed.where) {
      aclWhere = injectDynamicValues(JSON.parse(JSON.stringify(allowed.where)), user, query) as WhereCondition;
    }
  }

  return aclWhere;
}


export async function run_after(db:Database, query:StructuredQuery, user:any, others:any, role:string, structure: Structure, is_recursived:boolean) {
  if(query.after && Array.isArray(query.after) && query.after.length > 0 && !is_recursived) {
    let afterQueries:any[] = []
    for(let after_query of query.after) {
      let returned_query: { execute: () => Promise<any> };
      try {
        // await here because buildDrizzleQuery returns a Promise
        returned_query = await buildDrizzleQuery(db, after_query, user, role, structure, true);
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

export async function if_condition(db:Database, where_condtion:WhereCondition, table_map:any, user:any, query:StructuredQuery, default_table:any):Promise<boolean> {
  let where = await buildWhere(db, where_condtion, table_map, user, query, default_table)

  // Start empty SQL object
  const need_table:boolean = has_field_or_col_attribute(where_condtion)
  
  let check_query:any = sql`COALESCE(MAX(CASE WHEN`.append(where).append(sql`THEN 1 ELSE 0 END ), 0) AS RESULT`);

  const from_table = need_table ? default_table : sql`(select 1) AS t`

  const builded_query = db.select({
    result: check_query
  }).from(from_table)

  if(query.join) await buildJoin(db, builded_query, query.join, table_map, user, query, from_table)

  builded_query.limit(1)
  console.log(builded_query.toSQL())
  const [rows]: any = await builded_query.execute()

  console.log(rows)
  const result = rows.result ?? 0;

  // Return as boolean
  return Boolean(result);
}

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