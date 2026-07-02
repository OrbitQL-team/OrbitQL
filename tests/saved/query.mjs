// export default {
//   phases: [
//     {
//       mode: 'transaction',
//       queries: [
//         {
//           type: "PUT",
//           data: {
//             "name": "prova",
//             "surname": "prova",
//             "email": "prova@prova.prova",
//             "have_access": 1,
//             "age": 18,
//           },
//           table: "users",
//           where: {
//             field: "id",
//             op: "=",
//             value: 1
//           }
//         },
//         {
//           type: "POST",
//           data: {
//             "name": "prova",
//             "surname": null,
//             "email": "prova@prova.prova",
//             "have_access": 1,
//             "age": 18,
//           },
//           table: "users",
//         }
//       ]
//     },
//     {
//       mode: 'query',
//       queries: [
//         {
//           type: "PUT",
//           data: {
//             "name": "prova 2",
//             "surname": "prova 2",
//             "email": "prova@prova.prova 2",
//             "have_access": 1,
//             "age": 18,
//           },
//           table: "users",
//           where: {
//             field: "id",
//             op: "=",
//             value: 1
//           }
//         },
//         {
//           type: "POST",
//           data: {
//             "name": "prova 2",
//             "surname": null,
//             "email": "prova@prova.prova 2",
//             "have_access": 1,
//             "age": 19,
//           },
//           table: "users",
//         }
//       ]
//     },
//   ]
// };

export default {
  type: "POST",
  data: {
    "name": "prova 2",
    "surname": 'test',
    "email": "prova@prova.prova 2",
    "have_access": 1,
    "age": 19,
  },
  table: "users",
  returning: 'id'
}


// export default {
//   type: "GET",
//   select: "*",
//   table: "users",
// }