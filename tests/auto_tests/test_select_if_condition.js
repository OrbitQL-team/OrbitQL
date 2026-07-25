import { expect } from "vitest";
import compile from "../../src";

export default async function selectIfCondition(
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
      if: {
        when: {
          field: "have_access",
          op: "=",
          value: 1,
        },
        do: {
          field: "id",
          op: "=",
          value: 1,
        },
        else: {
          field: "id",
          op: "=",
          value: 2,
        },
      },
    },
  };

  const compiled = await compile(db, request, local_user, role, structure);
  const result = await compiled.execute();

  console.log("if condition result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
}
