import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function guest_code_endpoints(){
    return {
        endpoints: [
            { 
                type: "GET", 
                user: NONE, 
                admin: ALL,
                public_screen: NONE,
                guest: NONE
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
                admin: NONE,
                public_screen: NONE,
                guest: NONE
            },
            { 
                type: "DELETE", 
                user: NONE, 
                admin: ALL,
                public_screen: NONE,
                guest: NONE
            },
        ],
        table: schema.guest_code,
    } as any
}