import { ALL, NONE, ALL_EXCEPT_ID } from "../structure";
import * as schema from "../schema";

export function lab_positions_endpoints(){
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
                user: {
                    allowed: {
                        field: ["*"],
                        where: {
                            field: "lab_positions.user_id", 
                            operator: "=", 
                            value: "$user.id"
                        }
                    },
                    disallowed: ["user_id", "id"],
                }, 
                admin: {
                    allowed: ["*"],
                    disallowed: ["user_id", "id"],
                },
                public_screen: {
                    allowed: ["*"],
                    disallowed: ["user_id", "id"],
                },
                guest: {
                    allowed: {
                        field: ["*"],
                        where: {
                            field: "lab_positions.user_id", 
                            operator: "=", 
                            value: "$user.id"
                        }
                    },
                    disallowed: ["user_id", "id"],
                },
            },
            { 
                type: "POST", 
                user: {
                    allowed: {
                        field: ["*"],
                        where: {
                            left_value: "$data.lab_positions.user_id", 
                            operator: "=", 
                            value: "$user.id"
                        }
                    },
                    disallowed: ["id"],
                },
                admin: ALL_EXCEPT_ID,
                public_screen: NONE, 
                guest: {
                    allowed: {
                        field: ["*"],
                        where: {
                            left_value: "$data.lab_positions.user_id", 
                            operator: "=", 
                            value: "$user.id"
                        }
                    },
                    disallowed: ["id"],
                },
            },
            { 
                type: "DELETE", 
                user: NONE, 
                admin: ALL,
                public_screen: NONE,
                guest: NONE
            },
        ],
        table: schema.lab_positions,
    } as any
}