import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function tips_endpoints(){
    return {
        endpoints: [
            {
                type: "GET",
                user: { allowed: ["*"], disallowed: ["id", "order_num"] },
                admin: ALL,
                public_screen: { allowed: ["*"], disallowed: ["id", "order_num"] },
                guest: { allowed: ["*"], disallowed: ["id", "order_num"] },
                order_by: ["section_tip", "order_num"],
                direction: "asc",
            },
            { 
                type: "PUT", 
                user: NONE, 
                admin: ALL_EXCEPT_ID,
                public_screen: NONE,
                guest: NONE
            },
            { 
                type: "POST", 
                user: NONE, 
                admin: ALL_EXCEPT_ID,
                public_screen: NONE,
                guest: NONE
            },
            { 
                type: "DELETE", 
                user: NONE, 
                admin: ALL,
                public_screen: NONE,
                guest: NONE
            }
        ],
        table: schema.tips,
    } as any
}