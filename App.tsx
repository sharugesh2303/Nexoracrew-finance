import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { Reports } from "./pages/Reports";
import { UsersList } from "./pages/Users";
import { SipInvestment } from "./pages/SipInvestment";

import { User } from "./types";
import { getCurrentUser } from "./services/storage";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = () => {
      try {
        const storedUser = getCurrentUser();
        const token = localStorage.getItem("auth_token");

        if (storedUser && token) {
          console.log("✅ Session restored:", storedUser.email);
          setUser(storedUser);
        }
      } catch (error) {
        console.error("❌ Session restore failed:", error);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("nexora_session");
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("nexora_session");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold animate-pulse">NEXORACREW</h2>
        <p className="text-slate-400 mt-2">
          Connecting to Secure Database...
        </p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 🔐 PUBLIC ROUTE */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
          }
        />

        {/* 🔒 PROTECTED ROUTES */}
        <Route
          path="/*"
          element={
            user ? (
              <Layout user={user} onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Dashboard user={user} />} />
                  <Route
                    path="/transactions"
                    element={<Transactions user={user} />}
                  />
                  <Route
                    path="/reports"
                    element={<Reports user={user} />}
                  />
                  <Route path="/users" element={<UsersList />} />
                  <Route
                    path="/sip"
                    element={<SipInvestment user={user} />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
