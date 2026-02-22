import { formatDateForMySQL } from "$lib";
import { ALL, ALL_EXCEPT_ID, NONE } from "../structure";
import * as schema from "../schema";

const put_type = {
  type: "or",
  conditions: [
    {
      type: "and",
      conditions: [
        { field: "attendances.day", operator: ">", value: formatDateForMySQL(new Date()) },
        { field: "attendances.user_id", operator: "=", value: "$user.id" }
      ]
    },
    {
      type: "and",
      conditions: [
        {
          type: "and",
          conditions: [
            { field: "attendances.day", operator: "=", value: formatDateForMySQL(new Date()) },
            { field: "attendances.user_id", operator: "=", value: "$user.id" }
          ]
        },
        {
          type: "or",
          conditions: [
            {
              field: "attendances.last_type",
              operator: "=",
              value: "$data.attendances.type"
            },
            {
              left_value: "$data.attendances.type",
              operator: "IN",
              value: {
                select: "id",
                from: "attendances_types",
                where: [{ field: "attendances_types.today", operator: "=", value: 1 }]
              }
            }
          ]
        }
      ]
    }
  ]
}

const put_hours_worked = {
  type: "and",
  conditions: [
    { field: "attendances.day", operator: ">=", value: formatDateForMySQL(new Date()) },
    { field: "attendances.user_id", operator: "=", value: "$user.id" },
    { left_value: "$data.attendances.hours_worked", operator: "BETWEEN", start: "00:00:00", end: "23:59:59" },
  ]
}

export function attendaces_endpoints() {
  return {
    endpoints: [
      { 
        type: "GET", 
        user: ALL, 
        admin: ALL, 
        public_screen: ALL, 
        guest: ALL 
      },
      {
        type: "PUT",
        user: {
          allowed: {
            field: ['type', 'hours_worked'],
            where: {
              type: 'and',
              conditions: [
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.type",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_type,
                  else: true
                },
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.hours_worked",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_hours_worked,
                  else: true
                },
              ] 
            }
          },
          disallowed: ["id","user_id","day", "last_type_id"],
        },
        public_screen: {
          allowed: {
            field: ["type"],
            where: {
              type: "or",
              conditions: [
                {
                  field: "attendances.day", 
                  operator: ">", 
                  value: formatDateForMySQL(new Date())
                },
                {
                  type: "and",
                  conditions: [
                    {
                      field: "attendances.day", 
                      operator: "=", 
                      value: formatDateForMySQL(new Date())
                    },
                    {
                      type: "or",
                      conditions: [
                        {
                          field: "attendances.last_type",
                          operator: "=",
                          value: "$data.attendances.type"
                        },
                        {
                          left_value: "$data.attendances.type",
                          operator: "IN",
                          value: {
                            select: "id",
                            from: "attendances_types",
                            where: [{ field: "attendances_types.today", operator: "=", value: 1 }]
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          },
          disallowed: ["id","user_id","day", "last_type_id", "hours_worked"],
        },
        guest: {
          allowed: {
            field: ['type', 'hours_worked'],
            where: {
              type: 'and',
              conditions: [
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.type",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_type,
                  else: true
                },
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.hours_worked",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_hours_worked,
                  else: true
                },
              ] 
            }
          },
          disallowed: ["id","user_id","day", "last_type_id"],
        },
        admin: ALL_EXCEPT_ID,
      },
      {
        type: "POST",
        user: {
          allowed: {
            field: ['type', 'hours_worked', 'day', "user_id"],
            where: {
              type: 'and',
              conditions: [
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.type",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_type,
                  else: true
                },
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.hours_worked",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_hours_worked,
                  else: true
                },
              ] 
            }
          },
          disallowed: ["id", "last_type_id"],
        },
        public_screen: {
          allowed: {
            field: ['type', 'hours_worked', 'day', "user_id"],
            where: {
              type: "or",
              conditions: [
                {
                  left_value: "$data.attendances.day", 
                  operator: ">", 
                  value: formatDateForMySQL(new Date())
                },
                {
                  type: "and",
                  conditions: [
                    {
                      left_value: "$data.attendances.day", 
                      operator: "=", 
                      value: formatDateForMySQL(new Date())
                    },
                    {
                      left_value: "$data.attendances.type",
                      operator: "IN",
                      value: {
                        select: "id",
                        from: "attendances_types",
                        where: [{ field: "attendances_types.today", operator: "=", value: 1 }]
                      }
                    }
                  ]
                }
              ]
            }
          },
          disallowed: ["id", "last_type"],
        },
        guest: {
          allowed: {
            field: ['type', 'hours_worked', 'day', "user_id"],
            where: {
              type: 'and',
              conditions: [
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.type",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_type,
                  else: true
                },
                {
                  type: 'IF',
                  when: {
                    left_value: "$data.attendances.hours_worked",
                    operator: "IS NOT",
                    value: null
                  },
                  do: put_hours_worked,
                  else: true
                },
              ] 
            }
          },
          disallowed: ["id", "last_type_id"],
        },
        admin: ALL_EXCEPT_ID
      },
      { type: "DELETE",
        user: NONE, 
        admin: ALL, 
        public_screen: NONE, 
        guest: NONE 
      },
    ],
    table: schema.attendances,
  } as any
}