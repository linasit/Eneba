import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "../store/auth";
export type WalletEntry={id:number;amount_cents:number;source:string;created_at:string};
export function useWallet(){const {user}=useAuth();return useQuery({queryKey:['wallet'],queryFn:()=>api<{total_cents:number;entries:WalletEntry[];demo:true}>('/account/wallet'),enabled:!!user});}
