import { expect } from "vitest";
import build_query from "../../src";

export default async function select(
  db,
  structure,
  local_user,
  role
) {
  const query = {
    type: "GET",
    select: "*",
    table: "users",
    where: {
      field: "email",
      operator: "IN",

      value: {
        select: "email",
        from: "employees",

        where: {
          field: "employees.salary",
          operator: "<=",
          value: "1000",
        },
      },
    },
  };

  const built_query = await build_query(
    db,
    query,
    local_user,
    role,
    structure
  );

  const result = await built_query.execute();

  expect(result).toBeDefined();
}