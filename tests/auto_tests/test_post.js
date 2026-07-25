import { expect } from "vitest";
import compile from "../../src";

export default async function postTest(
  db,
  structure,
  local_user,
  role
) {
  const email = `auto-post-${Date.now()}@example.com`;

  const request = {
    type: "POST",
    table: "users",
    data: {
      name: "Auto Post",
      surname: "Test",
      email,
      age: 42,
      have_access: 1,
    },
    returning: ["id", "name", "email"],
  };

  const compiled = await compile(
    db,
    request,
    local_user,
    role,
    structure
  );

  const result = await compiled.execute();

  console.log("post result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
}
