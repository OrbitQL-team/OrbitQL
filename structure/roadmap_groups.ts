import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function roadmap_groups_endpoints(){
    return {
        endpoints: [
            {
                type: "GET",
                user: { allowed: ["*"], disallowed: ["order_num"] },
                admin: ALL,
                order_by: ["order_num"],
                direction: "asc",
            },
            { type: "PUT", user: NONE, admin: ALL_EXCEPT_ID },
            { type: "POST", user: NONE, admin: ALL_EXCEPT_ID },
            { type: "DELETE", user: NONE, admin: ALL },
        ],
        table: schema.roadmap_groups,
    } as any
}