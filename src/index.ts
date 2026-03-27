import { eq, asc, desc } from "drizzle-orm";
import { Database, WhereCondition, StructuredQuery, type FieldPermission, type SubqueryCondition, Structure } from "./types.ts";
import { resolve_data, resolve_fields, stripPrefixes, resolveCustomValue, injectDynamicValues, alias_selected_fields } from "./rbac.ts";
import { buildAclWhere, buildJoin, buildWhere, if_condition, is_allowed_empty, run_after } from "./drizzle.ts";

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
      and: [query.where, aclWhere]
    };
  } else if (query.where) {
    combinedWhere = query.where;
  } else if(aclWhere) {
    combinedWhere = aclWhere
  }

  let limit = null
  if(query.limit) limit = query.limit

  if (combinedWhere && typeof allowed != 'string' && !Array.isArray(allowed)) {
    const has_been_accepted = await if_condition(db, combinedWhere, tableMap, user, query, tableStruct.table)

    // rows always has one object: { RESULT: 0 } or 1
    if(!has_been_accepted) throw new Error("Not allowed")
  }

  const built_where = combinedWhere ? await buildWhere(db, combinedWhere!, tableMap, user, query, tableStruct.table) : false

  const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)

  /*────────────────────────────
    GET
  ────────────────────────────*/
  if (query.type === "GET") {
    const q = db.select(selected_data_fields).from(tableStruct.table);

    if (query.join) await buildJoin(db, q, query.join, tableMap, user, query, tableStruct.table);

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
          return await run_after(db, query, user, { rows }, role, structure, is_recursived);
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

        return await run_after(db, query, user, { before, after, response }, role, structure, is_recursived)
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

        return await run_after(db, query, user, { before: null, after: insertedRows, response }, role, structure, is_recursived)
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