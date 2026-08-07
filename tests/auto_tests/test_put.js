import { expect } from "vitest";
import compile from "../../src";

export default async function putTest(
  db,
  structure,
  local_user,
  role
) {
  const request = {
    type: "PUT",
    table: "users",
    data: {
      name: "updated-by-auto-test",
    },
    where: {
      field: "id",
      op: "=",
      value: 1,
    },
    returning: ["id", "name"],
  };

  const compiled = await compile(
    db,
    request,
    local_user,
    role,
    structure
  );

  const result = await compiled.execute();

  console.log("put result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
}
