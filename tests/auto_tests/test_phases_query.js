import { expect } from "vitest";
import compile from "../../src";

export default async function phasedQuery(
  db,
  structure,
  local_user,
  role
) {
  const request = {
    phases: [
      {
        mode: "QUERY",
        queries: [
          {
            type: "GET",
            select: "name",
            table: "users",
            where: {
              field: "id",
              op: "=",
              value: 1,
            },
          },
        ],
      },
    ],
  };

  const compiled = await compile(
    db,
    request,
    local_user,
    role,
    structure
  );

  const result = await compiled.execute();

  console.log("phased query result:", result);

  expect(result).toBeDefined();
  expect(result.ok).toBe(true);
  expect(Array.isArray(result.data)).toBe(true);
}
