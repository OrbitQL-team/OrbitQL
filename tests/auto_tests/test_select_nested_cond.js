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
    select: ["surname", "email"],
    table: "users",
    where: {
      and: [
        {
          field: 'have_access',
          op: '!=',
          value: 1
        },
        {
            or: [
                {
                    field: 'email',
                    op: 'LIKE',
                    value: '%@example.com%'
                },
                {
                    field: 'email',
                    op: 'LIKE',
                    value: '%@TEST.TEST%'
                }
            ]
        }
      ]
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