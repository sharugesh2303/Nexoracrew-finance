import React, { useState } from "react";
import axios from "axios";
import { User } from "../types";
import {
  Mail,
  Lock,
  User as UserIcon,
  Briefcase,
  ArrowRight,
  Shield
} from "lucide-react";

interface LoginProps {
  onLogin: (user: User) => void;
}

const API_BASE = "http://localhost:5000/api/v1";

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN
        const res = await axios.post(`${API_BASE}/auth/login`, {
          email,
          password
        });

        const user = res.data.user;
        const token = res.data.token;

        localStorage.setItem("auth_token", token);
        localStorage.setItem("nexora_session", JSON.stringify(user));
        onLogin(user);
      } else {
        // REGISTER
        if (!name || !email || !password || !position) {
          setError("All fields are required");
          setLoading(false);
          return;
        }

        const res = await axios.post(`${API_BASE}/auth/register`, {
          name,
          email,
          password,
          position
        });

        const user = res.data.user;
        const token = res.data.token;

        localStorage.setItem("auth_token", token);
        localStorage.setItem("nexora_session", JSON.stringify(user));
        onLogin(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <h1 className="text-[12rem] font-black text-white animate-pulse">
          NEXORACREW
        </h1>
      </div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-xl mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? "NEXORACREW LOGIN" : "CREATE ACCOUNT"}
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Financial Management System
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-400">
                  FULL NAME
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white"
                    placeholder="Full name"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400">
                  POSITION
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white"
                    placeholder="Manager / Admin"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400">EMAIL</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white"
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Register"}
            {!loading && <ArrowRight size={18} className="ml-2" />}
          </button>
        </form>

        {/* Registration toggle removed to disable public sign-ups */}
      </div>
    </div>
  );
};
