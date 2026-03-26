import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function users_coordinators_endpoints(){
    return {
       endpoints: [
            { 
                type: "GET",
                user: ALL, 
                admin: ALL,
                public_screen: ALL,
                guest: ALL
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
        table: schema.users_coordinators,
    } as any
}