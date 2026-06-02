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
      "field": "email",
      "operator": "IS NOT NULL"
    }
  };

  const built_query = await build_query(
    db,
    query,
    local_user,
    role,
    structure
  );

  const result = await built_query.execute();

  console.log('result: ', result)

  expect(result).toBeDefined();
}