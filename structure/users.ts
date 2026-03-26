import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function users_endpoints(){
    return {
       endpoints: [
            {
                type: "GET",
                user: { 
                    allowed: {
                        field: ["*"],
                        where: {
                            field: "users.have_access",
                            operator: "=",
                            value: 1
                        }
                    },
                    disallowed: ["have_access"] 
                },
                public_screen: { 
                    allowed: {
                        field: ["*"],
                        where: {
                            field: "users.have_access",
                            operator: "=",
                            value: 1
                        }
                    },
                    disallowed: ["have_access"] 
                },
                guest: { 
                    allowed: {
                        field: ["*"],
                        where: {
                            field: "users.have_access",
                            operator: "=",
                            value: 1
                        }
                    },
                    disallowed: ["have_access"] 
                },
                admin: ALL,
            },
            {
                type: "PUT",
                user: { 
                    allowed:{
                            field: ["*"],
                            where: {
                                field: 'users.id',
                                operator: '=',
                                value: '$user.id'
                            }
                        }, 
                    disallowed: ["id", "have_access", "admin", "organization_id"]
                },
                admin: ALL_EXCEPT_ID,
                public_screen: NONE,
                guest: { 
                    allowed: {
                        field: ["*"],
                        where: {
                            field: 'users.id',
                            operator: '=',
                            value: '$user.id'
                        }
                    }, 
                    disallowed: ["id", "have_access", "admin", "organization_id"]
                }
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
        table: schema.users,
    } as any
} 