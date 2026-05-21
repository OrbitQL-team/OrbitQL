export default {
  "users": {
    "endpoints": [
      {
        "type": "GET",
        "user": {
          "allow": [
            "id",
            "name",
            "email",
            "surname"
          ],
          "disallowed": "",
        },
        "admin": {
          "allowed": {
            "field": "*",
            "where": {
              "left_value": "$user.have_access",
              "op": "=",
              "value": 1
            }
          },
          "disallowed": "name",
          "limit": 10,
        },
      },
      {
        "type": "PUT",
        "user": {
          "allowed": {
            "field": [
              "name",
              "surname"
            ],
            "where": {
              "and": [
                {
                  "if": {
                    "when": {
                      "value": "$data.name",
                      "op": "IS NOT NULL"
                    },
                    "do": true,
                    "else": false
                  },
                },
                {
                  "if": {
                    "when": {
                      "value": "$data.surname",
                      "op": "IS NOT NULL"
                    },
                    "do": true,
                    "else": false
                  },
                },
                {
                  "field": "id",
                  "op": "=",
                  "value": "$user.id"
                },
                {
                  "left_value": "$user.have_access",
                  "op": "=",
                  "value": 1
                }
              ]
            }
          },
          "disallowed": [
            "*"
          ]
        },
        "admin": {
          "allowed": {
            "field": "*",
            "where": {
              "left_value": "$user.have_access",
              "op": "=",
              "value": 1
            }
          },
          "disallowed": "",
          "return_after": 1
        },
        "triggers": [
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "name",
                "when": {
                  "field": "name",
                  "op": "=",
                  "value": "Daniele"
                },
                "value": "wela"
              }
            }
          },
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "surname",
                "when": {
                  "field": "surname",
                  "op": "=",
                  "value": "Zucchelli"
                },
                "value": "wela"
              }
            }
          }
        ]
      },
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
        },
        "admin": {
          "allowed": "*",
          "return_after": 1
        },
        "triggers": [
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "name",
                "when": {
                  "field": "name",
                  "op": "IS NULL"
                },
                "value": "wela"
              }
            }
          },
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "surname",
                "when": {
                  "field": "surname",
                  "op": "IS NULL"
                },
                "value": "wela"
              }
            }
          }
        ]
      },
      {
        "type": "DELETE",
        "user": {
          "allowed": [],
          "disallowed": []
        }
      }
    ],
    "table": "users"
  }
};