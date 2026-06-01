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
    select: "name",
    table: "users",
    where: {
      and: [
        {
          field: '$user.have_access',
          op: '!=',
          value: 1
        },
        {
          field: 'email',
          op: 'LIKE',
          value: '%example.com%'
        },
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