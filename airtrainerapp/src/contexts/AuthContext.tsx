import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, loginUser, registerUser, logoutUser, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'athlete' | 'trainer';
        dateOfBirth: string;
        sports?: string[];
        skillLevel?: string;
        city?: string;
        state?: string;
        travelRadius?: number;
    }) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        checkSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const checkSession = async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.error('Session check failed:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const authUser = await loginUser(email, password);
        setUser(authUser);
    };

    const register = async (data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: 'athlete' | 'trainer';
        dateOfBirth: string;
        sports?: string[];
        skillLevel?: string;
        city?: string;
        state?: string;
        travelRadius?: number;
    }) => {
        const authUser = await registerUser(data);
        setUser(authUser);
    };

    const logout = async () => {
        await logoutUser();
        setUser(null);
    };

    const refreshUser = async () => {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
