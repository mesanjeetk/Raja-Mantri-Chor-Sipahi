import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
    id: string;
    username: string;
    email: string;
    bio?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (username: string, email: string, password: string, bio?: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check if user is already logged in on mount
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error('Failed to parse stored user:', error);
                localStorage.removeItem('user');
                localStorage.removeItem('accessToken');
            }
        }

        setIsLoading(false);
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const response = await api.post('/users/sign-in', { email, password });

            if (response.data.success) {
                const { user: userData, accessToken } = response.data.data;

                // Store token and user data
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('user', JSON.stringify(userData));

                setUser(userData);
            } else {
                throw new Error(response.data.message || 'Login failed');
            }
        } catch (error: any) {
            console.error('Sign in error:', error);
            throw new Error(error.response?.data?.message || 'Failed to sign in');
        }
    };

    const signUp = async (username: string, email: string, password: string, bio?: string) => {
        try {
            const response = await api.post('/users/sign-up', {
                username,
                email,
                password,
                bio: bio || '',
            });

            if (response.data.success) {
                const { user: userData, accessToken } = response.data.data;

                // Store token and user data
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('user', JSON.stringify(userData));

                setUser(userData);
            } else {
                throw new Error(response.data.message || 'Registration failed');
            }
        } catch (error: any) {
            console.error('Sign up error:', error);
            throw new Error(error.response?.data?.message || 'Failed to sign up');
        }
    };

    const signOut = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                signIn,
                signUp,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
