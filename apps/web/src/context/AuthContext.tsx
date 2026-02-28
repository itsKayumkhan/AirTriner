"use client";

import { createContext, useContext } from "react";
import { AuthUser } from "@/lib/auth";

interface AuthContextType {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}
