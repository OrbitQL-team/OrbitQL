import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function people_groups_endpoints(){
    return {
        endpoints: [
            { type: "GET", user: ALL_EXCEPT_ID, admin: ALL },
            { type: "PUT", user: NONE, admin: ALL_EXCEPT_ID },
            { type: "POST", user: NONE, admin: ALL_EXCEPT_ID },
            { type: "DELETE", user: NONE, admin: ALL },
        ],
        table: schema.people_groups,
    } as any
}