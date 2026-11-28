"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: string | null;
  login: (username: string, password: string, remember?: boolean) => { success: boolean; error?: string };
  logout: () => void;
}

const AUTH_USER_KEY = "workout_auth_user";
const AUTH_TOKEN_KEY = "workout_auth_token";
const AUTH_REMEMBER_KEY = "workout_auth_remember";

// 驗證憑證 (使用者指定)
const VALID_USERNAME = "Benedict";
const VALID_PASSWORD = "108ac1033";

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: () => ({ success: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  // 初始化檢查登入狀態 (支援 localStorage 與 sessionStorage)
  useEffect(() => {
    try {
      const remember = localStorage.getItem(AUTH_REMEMBER_KEY) !== "false";
      const storedUser = remember
        ? localStorage.getItem(AUTH_USER_KEY)
        : sessionStorage.getItem(AUTH_USER_KEY);
      const storedToken = remember
        ? localStorage.getItem(AUTH_TOKEN_KEY)
        : sessionStorage.getItem(AUTH_TOKEN_KEY);

      if (storedUser && storedToken && storedToken.startsWith("auth_token_")) {
        setUser(storedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (usernameInput: string, passwordInput: string, remember = true) => {
    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    // 帳號不分大小寫比對，密碼嚴格比對
    const isUserValid = cleanUser.toLowerCase() === VALID_USERNAME.toLowerCase();
    const isPassValid = cleanPass === VALID_PASSWORD;

    if (!isUserValid || !isPassValid) {
      return {
        success: false,
        error: !isUserValid ? "帳號不存在，請輸入正確的帳號 (Benedict)" : "密碼錯誤，請重新確認",
      };
    }

    const token = `auth_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    startTransition(() => {
      setUser(VALID_USERNAME);
      setIsAuthenticated(true);
    });

    try {
      localStorage.setItem(AUTH_REMEMBER_KEY, remember ? "true" : "false");
      if (remember) {
        localStorage.setItem(AUTH_USER_KEY, VALID_USERNAME);
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        sessionStorage.setItem(AUTH_USER_KEY, VALID_USERNAME);
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {
      // 容錯防護 (例如無痕模式禁用 localStorage)
    }

    return { success: true };
  };

  const logout = () => {
    startTransition(() => {
      setUser(null);
      setIsAuthenticated(false);
    });

    try {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_REMEMBER_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // 忽略錯誤
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
