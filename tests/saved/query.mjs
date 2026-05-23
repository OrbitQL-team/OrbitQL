export default {
  "type": "PUT",
  "data": {
    "name": 'test returning',
    "surname": 'test returning',
    "email": 'test returning@email.work_maybe',
    "have_access": 1
  },
  "where": {
    "field": "id",
    "op": "=",
    "value": "479"
  },
  "returning": "id",
  "table": "users",
};