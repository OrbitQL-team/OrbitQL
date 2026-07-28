export default {
  "users": {
    "endpoints": [
      {
        "type": "GET",
        "user": {
          "allow": {
            "field": "*",
            "where": {
              "field": "have_access",
              "op": "=",
              "value": "1"
            }
          },
          "disallowed": ["id", "have_access"],
        },
        "admin": {
          "allowed": "*"
        },
      },
      {
        "type": "PUT",
        "user": {
          "allowed": {
            "field": [
              "name",
              "surname",
              "email",
              "age"
            ],
            "where": {
              "and": [
                {
                  "value": "$data.name",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.surname",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.email",
                  "op": "IS NOT NULL"
                },
                {
                  "if": {
                    "when": {
                      "left_value": "$data.age",
                      "op": "<",
                      "value": "0"
                    },
                    "do": false,
                    "else": {
                      "value": "$data.age",
                      "op": "IS NOT NULL"
                    }
                  }
                },
                {
                  "field": "id",
                  "op": "=",
                  "value": "$user.id"
                },
              ]
            }
          },
          "disallowed": []
        },
        "admin": {
          "allowed": {
            "field": "*",
            "where": {
              "and": [
                {
                  "value": "$data.name",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.surname",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.email",
                  "op": "IS NOT NULL"
                },
                {
                  "if": {
                    "when": {
                      "left_value": "$data.age",
                      "op": "<",
                      "value": "0"
                    },
                    "do": false,
                    "else": {
                      "value": "$data.age",
                      "op": "IS NOT NULL"
                    }
                  }
                }
              ]
            }
          },
          "returning": true,
        },
      },
      {
        "type": "POST",
        "admin": {
          "allowed": {
            "field": "*",
            "where": {
              "and": [
                {
                  "value": "$data.name",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.surname",
                  "op": "IS NOT NULL"
                },
                {
                  "value": "$data.email",
                  "op": "IS NOT NULL"
                },
                {
                  "if": {
                    "when": {
                      "left_value": "$data.age",
                      "op": "<",
                      "value": "0"
                    },
                    "do": false,
                    "else": {
                      "value": "$data.age",
                      "op": "IS NOT NULL"
                    }
                  }
                }
              ]
            }
          },
          "returning": true,
        },
      },
      {
        "type": "DELETE",
        "admin": {
          "allowed": "*",
          "returning": true
        }
      }
    ],
    "table": "users"
  },
};