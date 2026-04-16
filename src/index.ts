import { Database, WhereCondition, StructuredQuery, Structure } from "./types.ts";
import { resolve_data, resolve_fields, alias_selected_fields, extractTableMap } from "./rbac.ts";
import { buildAclWhere, buildWhere, delete_method, get_method, if_condition, is_allowed_empty, post_method, put_method } from "./drizzle.ts";
import { getTableName } from "drizzle-orm";

/*───────────────────────────────────────────────
  MAIN QUERY BUILDER
───────────────────────────────────────────────*/
export default async function build_query(db: Database, query: StructuredQuery, user: any, role:string, structure: Structure) {
  const tableName = query.table;
  const tableStruct = structure[tableName];
  if (!tableStruct) throw new Error(`Table ${tableName} not found`);

  const endpoint = tableStruct.endpoints.find((e:any) => e.type === query.type);
  if (!endpoint) throw new Error(`${query.type} not allowed on ${tableName}`);

  if(!endpoint[role]) {
    throw new Error(`Role '${role}' not allowed to perform ${query.type} on ${tableName}`);
  }
  
  const rolePermissions = endpoint[role];
  if (typeof rolePermissions === "string" || Array.isArray(rolePermissions)) {
    throw new Error(`Invalid role permissions format for role '${role}'`);
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
  
  if(is_allowed_empty(allowed)) throw new Error("Not allowed");

  const tableMap = extractTableMap(structure);

  let selected_data_fields: Record<string, any> = {};

  if(query.select) {
    selected_data_fields = resolve_fields(structure, query.select, query.type, role, query.table, tableMap);
    selected_data_fields = alias_selected_fields(selected_data_fields);
  }else if(query.data) {
    selected_data_fields = resolve_data(structure, query.data, query.type, role, query.table, tableMap);
  }

  if(Object.keys(selected_data_fields).length == 0) throw new Error("No fields allowed");

  const aclWhere = buildAclWhere(allowed, disallowed, user, query, tableMap, getTableName(tableStruct.table));

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

  if(rolePermissions.limit && (limit === null || limit > rolePermissions.limit)) {
    limit = rolePermissions.limit
  }

  if (combinedWhere && (typeof allowed != 'string' && !Array.isArray(allowed) || typeof disallowed != 'string' && !Array.isArray(disallowed))) {
    const has_been_accepted = await if_condition(db, combinedWhere, tableMap, user, query, tableStruct.table)
    if(!has_been_accepted) throw new Error("Not allowed")
  }

  const built_where = combinedWhere ? await buildWhere(db, combinedWhere!, tableMap, user, query, tableStruct.table, getTableName(tableStruct.table)) : false

  const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)

  switch(query.type.toUpperCase()) {
    case 'GET': {
      return await get_method(db, query, user, structure, endpoint, role, tableStruct, tableMap, selected_data_fields, built_where, tableName, limit)
    }
    case 'PUT': {
      return await put_method(db, query, user, structure, pre_post_select_fields, role, tableStruct, selected_data_fields, built_where, limit)
    }
    case 'POST': {
      return await post_method(db, query, user, structure, pre_post_select_fields, role, tableStruct, tableMap, getTableName(tableStruct.table), selected_data_fields, allowed, disallowed)
    }
    case 'DELETE': {
      return await delete_method(db, pre_post_select_fields, tableStruct, built_where, limit)
    }
    default: {
      throw new Error("Invalid operation");
    }
  }
}