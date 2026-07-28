import { expect } from "vitest";
import compile from "../../src";

export default async function selectInSubquery(
  db,
  structure,
  local_user,
  role
) {
  const request = {
    type: "GET",
    select: "name",
    table: "users",
    where: {
      field: "id",
      operator: "IN",
      value: {
        select: "id",
        from: "users",
        where: {
          field: "have_access",
          op: "=",
          value: 1,
        },
      },
    },
  };

  const compiled = await compile(db, request, local_user, role, structure);
  const result = await compiled.execute();

  console.log("in subquery result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
}
