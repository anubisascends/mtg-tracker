import { createContext, useContext, useState, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  exp: number;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string;
  role?: string;
}

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  login: (token: string, user: AuthUser, rememberMe: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadFromStorage(): { token: string | null; user: AuthUser | null } {
  const storedToken = localStorage.getItem('token') ?? sessionStorage.getItem('token');
  if (!storedToken) return { token: null, user: null };
  try {
    const decoded = jwtDecode<JwtPayload>(storedToken);
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      return { token: null, user: null };
    }
    const role =
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      decoded.role ||
      'player';
    return {
      token: storedToken,
      user: { userId: parseInt(decoded.sub), username: decoded.username, email: decoded.email, role },
    };
  } catch {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadFromStorage();
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);

  const login = (newToken: string, newUser: AuthUser, rememberMe: boolean) => {
    if (rememberMe) {
      localStorage.setItem('token', newToken);
    } else {
      sessionStorage.setItem('token', newToken);
    }
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAdmin: user?.role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
