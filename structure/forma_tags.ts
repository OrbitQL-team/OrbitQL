import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function forma_types_endpoint(){
    return {
        endpoints: [
            { 
                type: "GET",
                user: ALL_EXCEPT_ID, 
                admin: ALL,
                public_screen: ALL_EXCEPT_ID,
                guest: ALL_EXCEPT_ID
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
        table: schema.forma_tags,
    } as any
}