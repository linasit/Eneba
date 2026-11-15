import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface User {
  id: number;
  email: string;
  username: string;
}
interface Ctx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string, code?:string): Promise<void>;
  register(email: string, username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: () => api<User>("/auth/me").catch(() => null),
  });
  const set = (u: User | null) => {
    qc.removeQueries({ queryKey: ["orders"] });
    qc.removeQueries({queryKey:["account-profile"]});
    qc.removeQueries({queryKey:["wallet"]});
    qc.setQueryData(["me"], u);
  };
  return (
    <AuthCtx.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        login: async (email, password, code) =>
          set(
            await api<User>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password, code }),
            }),
          ),
        register: async (email, username, password) =>
          set(
            await api<User>("/auth/register", {
              method: "POST",
              body: JSON.stringify({ email, username, password }),
            }),
          ),
        logout: async () => {
          await api("/auth/logout", { method: "POST" });
          set(null);
          qc.removeQueries({ queryKey: ["orders"] });
    qc.removeQueries({queryKey:["account-profile"]});
    qc.removeQueries({queryKey:["wallet"]});
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
