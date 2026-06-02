export default {
  type: "GET",
  select: [
    "$count.id",
    "$count_distinct.id",
    "$avg.age",
    "$avg_distinct.age",
    "$max.age",
    "$min.age",
    "$sum.age",
    "$sum_distinct.age",
  ],
  table: "users",
};