export default {
  "users": {
    "endpoints": [
      {
        "type": "GET",
        "user": {
          "allow": {
            "field": "*",
            "where": {
              "and": [
                {
                  "field": "have_access",
                  "operator": "=",
                  "value": 1
                },
                {
                  "left_value": "$user.have_access",
                  "operator": "=",
                  "value": 1
                }
              ]
            }
          }
        }
      },
      {
        "type": "PUT",
        "user": {
          "allowed": {
            "field": [
              "*"
            ],
            "where": {
              "if": {
                "when": {
                  "left_value": "$data.name",
                  "operator": "IS NOT NULL"
                },
                "do": true,
                "else": false
              }
            }
          },
          "disallowed": {
            "field": [
              "id",
              "have_access"
            ],
            "where": {
              "left_value": "$user.have_access",
              "operator": "=",
              "value": 0
            }
          }
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