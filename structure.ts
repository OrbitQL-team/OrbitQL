import { type SafeOperator } from "./builder";
import { attendaces_endpoints} from "./structure/attendances";
import { attendaces_types_endpoints} from "./structure/attendances_types";
import { forma_types_endpoint } from "./structure/forma_tags";
import { guest_code_endpoints } from "./structure/guest_code";
import { images_endpoints } from "./structure/images";
import { lab_positions_endpoints } from "./structure/lab_positions";
import { tips_endpoints } from "./structure/tips";
import { tips_sections_endpoints } from "./structure/tips_sections";
import { users_endpoints } from "./structure/users";
import { users_coordinators_endpoints } from "./structure/users_coordinators";
import { lab_endpoints } from "./structure/labs";
import { organizations_endpoints } from "./structure/organizations";

/* -------------------------------------------------------------------------- */
/*                               TYPE DEFINITIONS                             */
/* -------------------------------------------------------------------------- */

export type SimpleCondition = {
  field?: string;
  left_value?: any;
  operator: SafeOperator;
  value: any; // could be literal, placeholder ($user.id), or subquery object
};

// Nested AND/OR conditions
export type NestedCondition = {
  type: "and" | "or";
  conditions: (WhereCondition | SubqueryCondition)[];
};
// A WhereCondition can be simple or nested
export type WhereCondition = SimpleCondition | NestedCondition;

// Subquery structure for IN conditions
export type SubqueryCondition = {
  field?: string;
  left_value?: any;
  operator: "IN";
  value: {
    select: string;
    from: string;
    where?: WhereCondition[];
  };
};

// Field permission with optional where clause
export type FieldPermission =
  | string[] | string
  | {
      field: string | string[];
      where?: WhereCondition;
    };

// Role permissions
export type RolePermissions = {
  allowed: FieldPermission;
  disallowed: string[];
};

// Endpoint types
export type EndpointType = "GET" | "PUT" | "POST" | "DELETE";

// Endpoint structure
export type Endpoint = {
  type: EndpointType;
  user: RolePermissions;
  public_screen: RolePermissions;
  guest: RolePermissions;
  admin: RolePermissions;
  order_by?: string[];
  direction?: "asc" | "desc";
};

// Table structure
export type TableStructure<T = any> = {
  endpoints: Endpoint[];
  table: T;
};

export type Structure = Record<string, TableStructure<any>>;

/* -------------------------------------------------------------------------- */
/*                               PERMISSION PRESETS                           */
/* -------------------------------------------------------------------------- */

export const ALL: RolePermissions = { allowed: ["*"], disallowed: [] };
export const ALL_EXCEPT_ID: RolePermissions = { allowed: ["*"], disallowed: ["id"] };
export const NONE: RolePermissions = { allowed: [], disallowed: [] };

/* -------------------------------------------------------------------------- */
/*                               STRUCTURE CLEANED                            */
/* -------------------------------------------------------------------------- */

export const structure: Structure = {
  attendances: attendaces_endpoints(),

  attendances_types: attendaces_types_endpoints(),

  organizations: organizations_endpoints(),

  forma_tags: forma_types_endpoint(),

  // goals: goals_endpoints(),

  // roadmap_groups: roadmap_groups_endpoints(),

  // people_groups: people_groups_endpoints(),

  guest_code: guest_code_endpoints(),

  images: images_endpoints(),

  labs: lab_endpoints(),

  lab_positions: lab_positions_endpoints(),

  // projects: projects_endpoints(),

  tips: tips_endpoints(),

  tips_sections: tips_sections_endpoints(),

  users: users_endpoints(),

  users_coordinators: users_coordinators_endpoints(),
};