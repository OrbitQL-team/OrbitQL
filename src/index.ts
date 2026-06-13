import { Database, WhereCondition, StructuredQuery, Structure, BuildWhereOptions, Transaction, Request, QueryPhase, CompileResult } from "./types.ts";
import { resolve_data, resolve_fields, alias_selected_fields, extractTableMap, stripPrefixes, validate_where_fields } from "./rbac.ts";
import { buildAclWhere, buildWhere, delete_method, get_method, if_condition, is_allowed_empty, post_method, put_method, run_triggers } from "./drizzle.ts";
import { getTableName } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*                               REQUEST HANDLER                              */
/* -------------------------------------------------------------------------- */

export default async function compile(
  db: Database | Transaction,
  request: Request,
  user: any,
  role: string,
  structure: Structure,
  options: BuildWhereOptions = {}
): Promise<CompileResult<any>> {
  if ("phases" in request && request.phases) {
    const parts = await Promise.all(
      request.phases.map((phase) =>
        build_batch(
          db,
          phase,
          user,
          role,
          structure,
          options
        )
      )
    );

    return {
      async execute() {
        const results: any[] = [];
        const errors: any[] = [];

        for (const part of parts) {
          try {
            const res = await part.execute();
            results.push(res);
          } catch (err) {
            errors.push(err);
          }
        }

        return {
          ok: errors.length === 0,
          data: results,
          error: errors.length ? errors : undefined
        };
      }
    };
  }

  const single = await build_query(
    db,
    request as StructuredQuery,
    user,
    role,
    structure,
    options
  );

  return {
    async execute() {
      try {
        const res = await single.execute();

        return {
          ok: true,
          data: res
        };
      } catch (err) {
        return {
          ok: false,
          error: err
        };
      }
    }
  };
}

/* -------------------------------------------------------------------------- */
/*                                QUERY BATCHER                               */
/* -------------------------------------------------------------------------- */

export async function build_batch(
  db: Database | Transaction,
  phase: QueryPhase,
  user: any,
  role: string,
  structure: Structure,
  options: BuildWhereOptions = {}
) {
  const plans = await Promise.all(
    phase.queries.map((query) =>
      build_query(
        db,
        query,
        user,
        role,
        structure,
        options
      )
    )
  );

  switch (phase.mode.toUpperCase()) {
    case "QUERY": {
      return {
        async execute() {
          const results = [];

          for (const plan of plans) {
            results.push(await plan.execute());
          }

          return results;
        },
      };
    }

    case "TRANSACTION": {
      return {
        async execute() {
          return await db.transaction(async (tx: Transaction) => {
            const results = [];

            for (const query of phase.queries) {
              const plan = await build_query(
                tx,
                query,
                user,
                role,
                structure,
                options
              );

              results.push(await plan.execute());
            }

            return results;
          });
        },
      };
    }

    default: {
      throw new Error(
        `Unsupported phase mode: ${phase.mode}`
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              BUILDER FOR QUERY                             */
/* -------------------------------------------------------------------------- */
export async function build_query(db: Database | Transaction, query: StructuredQuery, user: any, role:string, structure: Structure, options:BuildWhereOptions = {}) {
  /* -------------------------------------------------------------------------- */
  /*                              TABLE RETRIEVING                              */
  /* -------------------------------------------------------------------------- */
  const tableName = query.table;
  const tableStruct = structure[tableName];
  if (!tableStruct) throw new Error(`Table ${tableName} not found`);

  const query_type = query.type.toUpperCase()

  /* -------------------------------------------------------------------------- */
  /*                             ENDPOINT RETRIEVING                            */
  /* -------------------------------------------------------------------------- */
  const endpoint = tableStruct.endpoints.find((e:any) => e.type.toUpperCase() === query_type);
  if (!endpoint) throw new Error(`${query_type} not allowed on ${tableName}`);

  if(!endpoint[role]) {
    throw new Error(`Role '${role}' not allowed to perform ${query_type} on ${tableName}`);
  }
  
  /* -------------------------------------------------------------------------- */
  /*                                    ROLES                                   */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /*               QUERY VALIDATION CHECK BEFORE RUNNING THE QUERY              */
  /* -------------------------------------------------------------------------- */

  const tableMap = extractTableMap(structure);

  const default_table = tableStruct.table
  const table_name = getTableName(default_table)

  const aclWhere = buildAclWhere(allowed, disallowed);

  let combinedWhere: WhereCondition | undefined;
  let query_where = query.where ? validate_where_fields(query.where, tableMap, table_name, structure, role, query_type) : query.where
  if (query_where && aclWhere) {
    combinedWhere = {
      and: [aclWhere, query_where]
    };
  } else if (query_where) {
    combinedWhere = query_where;
  } else if(aclWhere) {
    combinedWhere = aclWhere
  }

  if (combinedWhere && (typeof allowed != 'string' && !Array.isArray(allowed) || typeof disallowed != 'string' && !Array.isArray(disallowed))) {
    const has_been_accepted = await if_condition(db, combinedWhere, tableMap, user, role, structure, query, default_table)
    if(!has_been_accepted) throw new Error("Not allowed or Empty")
  }

  let limit = null
  if(query.limit) limit = query.limit

  if(rolePermissions.limit && (limit === null || limit > rolePermissions.limit)) {
    limit = rolePermissions.limit
  }

  /* -------------------------------------------------------------------------- */
  /*                           ALLOWED FIELDS RESOLVER                          */
  /* -------------------------------------------------------------------------- */

  const built_where = combinedWhere ? await buildWhere(db, combinedWhere!, tableMap, user, role, structure, query, default_table, table_name) : false

  let user_select_data_fields: Record<string, any> = {};

  if(query_type == "GET") {
    if("select" in query && query.select) {
      user_select_data_fields = resolve_fields(structure, query.select, query_type, role, query.table, tableMap);
      user_select_data_fields = alias_selected_fields(user_select_data_fields);
    }else throw Error("Select is necessary on GET request")
  }
  if(query_type == "PUT" || query_type == "POST") {
    if("data" in query && query.data) {
      user_select_data_fields = resolve_data(structure, query.data, query_type, role, query.table, tableMap);
      user_select_data_fields = stripPrefixes(user_select_data_fields);
    }else throw Error("Data is necessary on PUT/POST requests")
  }

  let result:any

  let selected_data_fields: Record<string, any> = { ...user_select_data_fields };

  if (!Object.keys(selected_data_fields).length) {
    throw new Error("No allowed fields");
  }

  /* -------------------------------------------------------------------------- */
  /*                               BEFORE TRIGGERS                              */
  /* -------------------------------------------------------------------------- */

  if(endpoint.triggers && !options?.disable_triggers) selected_data_fields = await run_triggers(db, options, query, user, role, structure, tableMap, tableStruct, user_select_data_fields, endpoint.triggers, false)

  let before:any = null
  let after:any = null

  result = {
    execute: async () => {
      return await db.transaction(async (tx: Transaction)=>{
        /* -------------------------------------------------------------------------- */
        /*                           RUN QUERY BASED ON TYPE                          */
        /* -------------------------------------------------------------------------- */
        
        let result

        switch(query_type.toUpperCase()) {
          case 'GET': {
            result = await (await get_method(tx, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, selected_data_fields, built_where, tableName, limit)).execute()
            break;
          }
          case 'PUT': {
            before = await (await get_method(tx, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, undefined, built_where, tableName, limit)).execute()
            result = await (await put_method(tx, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, selected_data_fields, built_where, tableName, limit)).execute()
            break;
          }
          case 'POST': {
            result = await (await post_method(tx, options, query, user, structure, role, tableStruct, tableMap, selected_data_fields, tableName)).execute()
            break;
          }
          case 'DELETE': {
            before = await (await get_method(tx, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, undefined, built_where, tableName, limit)).execute()
            result = await (await delete_method(tx, options, query, user, structure, rolePermissions, role, tableStruct, tableMap, built_where, tableName, limit)).execute()
            break;
          }
          default: {
            throw new Error("Invalid operation");
          }
        }

        return result
      })
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               AFTER TRIGGERS                               */
  /* -------------------------------------------------------------------------- */

  if(endpoint.triggers && !options?.disable_triggers) await run_triggers(db, options, query, user, role, structure, tableMap, tableStruct, user_select_data_fields, endpoint.triggers, false, before, after)

  return result
}