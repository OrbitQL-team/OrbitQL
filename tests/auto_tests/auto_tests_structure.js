export default {
  "users": {
    "endpoints": [
      {
        "type": "GET",
        "user": {
          "allow": {
            "field": [
              "id",
              "name",
              "email",
              "surname"
            ],
            "where": {
              "and": [
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
          }
        },
        "admin": {
          "allowed": {
            "field": "*",
            "where": {
              "left_value": "$user.have_access",
              "op": "=",
              "value": 1
            }
          }
        }
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
                    "value": "$data.name",
                    "op": "IS NOT NULL"
                  },
                  "do": true,
                  "else": false
                },
                {
                  "if": {
                    "value": "$data.surname",
                    "op": "IS NOT NULL"
                  },
                  "do": true,
                  "else": false
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
          "disallowed": "*"
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
          "disallowed": "id"
        }
      },
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
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
          "disallowed": "id"
        }
      },
      {
        "type": "DELETE",
        "user": {
          "allowed": [],
          "disallowed": []
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
          "disallowed": ""
        }
      }
    ],
    "table": "users"
  }
};