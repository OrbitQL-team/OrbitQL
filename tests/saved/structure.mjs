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
                  "operator": "=",
                  "value": "$user.id"
                },
                {
                  "left_value": "$user.have_access",
                  "operator": "=",
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
              "operator": "=",
              "value": 1
            }
          },
          "disallowed": ""
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
                    "operator": "IS NOT NULL"
                  },
                  "do": true,
                  "else": false
                },
                {
                  "if": {
                    "value": "$data.surname",
                    "operator": "IS NOT NULL"
                  },
                  "do": true,
                  "else": false
                },
                {
                  "field": "id",
                  "operator": "=",
                  "value": "$user.id"
                },
                {
                  "left_value": "$user.have_access",
                  "operator": "=",
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
              "operator": "=",
              "value": 1
            }
          },
          "disallowed": ""
        }
      },
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
        }
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