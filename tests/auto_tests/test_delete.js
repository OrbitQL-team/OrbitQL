import { expect } from "vitest";
import compile from "../../src";

export default async function deleteTest(
  db,
  structure,
  local_user,
  role
) {
  const email = `delete-${Date.now()}@example.com`;

  const seedRow = {
    name: "Delete Me",
    surname: "Auto",
    email,
    age: 24,
    have_access: 1,
  };

  await db
    .insert(structure.users.table)
    .values(seedRow)
    .execute();

  const request = {
    type: "DELETE",
    table: "users",
    where: {
      field: "email",
      op: "=",
      value: email,
    },
    returning: ["id", "email"],
  };

  const compiled = await compile(
    db,
    request,
    local_user,
    role,
    structure
  );

  const result = await compiled.execute();

  console.log("delete result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
}
