import axios from "axios";
import {
  User,
  Transaction,
  BankAccount,
  TransactionType,
  PaymentMethod,
} from "../types";

/* =========================================================
   API CONFIG (VITE SAFE)
   ========================================================= */
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/* =========================================================
   AUTH SERVICES
   ========================================================= */

export const registerUser = async (
  user: Omit<User, "id" | "createdAt">
): Promise<{ user: User | null; error: string | null }> => {
  try {
    const res = await api.post("/auth/register", user);
    return { user: res.data.user, error: null };
  } catch (err: any) {
    return {
      user: null,
      error: err.response?.data?.message || "Registration failed",
    };
  }
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> => {
  try {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("nexora_session", JSON.stringify(res.data.user));
    return { user: res.data.user, error: null };
  } catch (err: any) {
    return {
      user: null,
      error: err.response?.data?.message || "Login failed",
    };
  }
};

export const logoutUser = async () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("nexora_session");
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem("nexora_session");
  return data ? JSON.parse(data) : null;
};

/* =========================================================
   USER SERVICES (ADMIN)
   ========================================================= */

export const getAllUsers = async (): Promise<User[]> => {
  const res = await api.get("/users");
  return res.data;
};

export const createUser = async (
  user: Omit<User, "_id" | "createdAt">
): Promise<User> => {
  const res = await api.post("/users", user);
  return res.data;
};

export const updateUser = async (
  id: string,
  updates: Partial<User>
): Promise<User> => {
  const res = await api.put(`/users/${id}`, updates);
  return res.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

/* =========================================================
   TRANSACTION SERVICES
   ========================================================= */

export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await api.get("/transactions");
  return res.data;
};

export const saveTransaction = async (
  transaction: Omit<Transaction, "_id" | "createdAt">
): Promise<void> => {
  await api.post("/transactions", transaction);
};

export const updateTransaction = async (
  id: string,
  updates: Partial<Transaction>
): Promise<void> => {
  await api.put(`/transactions/${id}`, updates);
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await api.delete(`/transactions/${id}`);
};

export const bulkDeleteTransactions = async (
  ids: string[]
): Promise<void> => {
  await api.post("/transactions/bulk-delete", { ids });
};

export const bulkUpdateCategory = async (
  ids: string[],
  category: string
): Promise<void> => {
  await api.post("/transactions/bulk-category", { ids, category });
};

/* =========================================================
   BANK SERVICES
   ========================================================= */

export const getBanks = async (): Promise<BankAccount[]> => {
  const res = await api.get("/banks");
  return res.data;
};

export const saveBank = async (
  bank: Omit<BankAccount, "_id">
): Promise<void> => {
  await api.post("/banks", bank);
};

export const deleteBank = async (id: string): Promise<void> => {
  await api.delete(`/banks/${id}`);
};

/* =========================================================
   REAL-TIME PLACEHOLDER (NO SUPABASE)
   ========================================================= */

export const subscribeToTransactions = (_: () => void) => {
  // Backend does not support realtime yet
  return () => { };
};

/* =========================================================
   OFFLINE FLAG (COMPAT)
   ========================================================= */

export const isOfflineMode = (): boolean => false;
