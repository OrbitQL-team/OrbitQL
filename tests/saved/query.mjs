export default {
  "type": "GET",
  "select": ["*"],
  "table": "users",
  join: [
    {
      table: "employees",
      type: "LEFT",

      on: {
        "employees.employee_id": "users.id",
      },
    },
  ],
};