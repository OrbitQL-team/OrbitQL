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
      or: [
        {
          field: "age",
          operator: "BETWEEN",
          start: 13,
          end: 56,
        },
        {
          field: "age",
          operator: "NOT BETWEEN",
          start: 10,
          end: 70,
        }
      ]
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