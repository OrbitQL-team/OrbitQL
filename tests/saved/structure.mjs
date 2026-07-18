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
          "disallowed": "",
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
          "returning": true
        },
      },
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
        },
        "admin": {
          "allowed": "*",
          "returning": true
        },
        "triggers": [
          {
            "type": "BEFORE",
            "query": {
              "set": {
                "field": "name",
                "when": {
                  "value": "$data.name",
                  "op": "=",
                  "value": "test"
                },
                "value": "wela"
              }
            }
          },
          {
            "type": "AFTER",
            "query": {
              "type": "POST",
              "data": {
                "name": "new",
                "surname": 'new',
                "email": "$after.email",
                "have_access": "$after.have_access",
                "age": "$after.age",
              },
              "table": "users",
            }
          },
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
  },
  "employees": {
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
          "disallowed": "",
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
          "returning": true
        },
      },
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
        },
        "admin": {
          "allowed": "*",
          "returning": true
        },
        "triggers": [
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "name",
                "when": {
                  "value": "$data.name",
                  "op": "IS NULL"
                },
                "value": "wela"
              }
            }
          },
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
  },
  "test": {
    "endpoints": [
      {
        "type": "POST",
        "user": {
          "allowed": [],
          "disallowed": []
        },
        "admin": {
          "allowed": "*",
          "returning": true
        },
        "triggers": [
          {
            "type": "BEFORE",
            "level": "ROW",
            "query": {
              "set": {
                "field": "name",
                "when": {
                  "value": "$data.name",
                  "op": "IS NULL"
                },
                "value": "wela"
              }
            }
          },
        ]
      },
    ],
    "table": "test"
  },
};