import { Database, WhereCondition, StructuredQuery, Structure, BuildWhereOptions } from "./types.ts";
import { resolve_data, resolve_fields, alias_selected_fields, extractTableMap, stripPrefixes } from "./rbac.ts";
import { buildAclWhere, buildWhere, delete_method, get_method, if_condition, is_allowed_empty, post_method, put_method, run_triggers } from "./drizzle.ts";
import { getTableName } from "drizzle-orm";

/*───────────────────────────────────────────────
  MAIN QUERY BUILDER
───────────────────────────────────────────────*/
export default async function build_query(db: Database, query: StructuredQuery, user: any, role:string, structure: Structure, options:BuildWhereOptions = {}) {
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
          ? rolePermissions.allowed ?? []
          : 'allow' in rolePermissions
          ? rolePermissions.allow ?? []
          : [];

  const disallowed =
      'disallowed' in rolePermissions
          ? rolePermissions.disallowed ?? []
          : 'deny' in rolePermissions
          ? rolePermissions.deny ?? []
          : [];
  
  if(is_allowed_empty(allowed)) throw new Error("Not allowed");

  const tableMap = extractTableMap(structure);

  const table_name = getTableName(tableStruct.table)

  const aclWhere = buildAclWhere(allowed, disallowed, user, query, tableMap, table_name);

  let combinedWhere: WhereCondition | undefined;
  let query_where = query.where
  if (query_where && aclWhere) {
    combinedWhere = {
      and: [query_where, aclWhere]
    };
  } else if (query_where) {
    combinedWhere = query_where;
  } else if(aclWhere) {
    combinedWhere = aclWhere
  }

  if (combinedWhere && (typeof allowed != 'string' && !Array.isArray(allowed) || typeof disallowed != 'string' && !Array.isArray(disallowed))) {
    const has_been_accepted = await if_condition(db, combinedWhere, tableMap, user, role, structure, query, tableStruct.table)
    if(!has_been_accepted) throw new Error("Not allowed")
  }

  let limit = null
  if(query.limit) limit = query.limit

  if(rolePermissions.limit && (limit === null || limit > rolePermissions.limit)) {
    limit = rolePermissions.limit
  }

  const return_before = rolePermissions.return_before ?? false
  const return_after = rolePermissions.return_after ?? false

  const built_where = combinedWhere ? await buildWhere(db, combinedWhere!, tableMap, user, role, structure, query, tableStruct.table, table_name) : false

  let user_select_data_fields: Record<string, any> = {};

  if(query.select) {
    user_select_data_fields = resolve_fields(structure, query.select, query.type, role, query.table, tableMap);
    user_select_data_fields = alias_selected_fields(user_select_data_fields);
  }else if(query.data) {
    user_select_data_fields = resolve_data(structure, query.data, query.type, role, query.table, tableMap);
    user_select_data_fields = stripPrefixes(user_select_data_fields);
  }

  let result:any

  let selected_data_fields: Record<string, any> = { ...user_select_data_fields };

  if(endpoint.triggers && !options?.disable_triggers) selected_data_fields = await run_triggers(db, options, query, user, role, structure, tableMap, tableStruct, user_select_data_fields, built_where, endpoint.triggers, false)

  if (!Object.keys(selected_data_fields).length) {
    throw new Error("No allowed fields");
  }

  switch(query.type.toUpperCase()) {
    case 'GET': {
      result = await get_method(db, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, selected_data_fields, built_where, tableName, limit)
      break;
    }
    case 'PUT': {
      const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)
      result = await put_method(db, options, query, user, structure, pre_post_select_fields, role, tableStruct, selected_data_fields, built_where, limit, return_before, return_after)
      break;
    }
    case 'POST': {
      const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)
      result = await post_method(db, options, query, user, structure, pre_post_select_fields, role, tableStruct, selected_data_fields, return_after)
      break;
    }
    case 'DELETE': {
      const pre_post_select_fields = resolve_fields(structure, ["*"], "GET", role, query.table, tableMap)
      result = await delete_method(db, options, query, user, structure, pre_post_select_fields, role, tableStruct, built_where, limit, return_before)
      break;
    }
    default: {
      throw new Error("Invalid operation");
    }
  }

  if(endpoint.triggers && !options?.disable_triggers) await run_triggers(db, options, query, user, role, structure, tableMap, tableStruct, user_select_data_fields, built_where, endpoint.triggers, false)

  return result
}