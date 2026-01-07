import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Reports } from './pages/Reports';
import { UsersList } from './pages/Users';
import { SipInvestment } from './pages/SipInvestment'; // ✅ Added Import
import { User } from './types';
import { getCurrentUser } from './services/storage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const storedUser = await getCurrentUser();
        // Also check if token exists to be sure
        const token = localStorage.getItem("auth_token");

        if (storedUser && token) {
          console.log("Session restored for:", storedUser.email);
          setUser(storedUser);
        }
      } catch (error) {
        console.error("Session restore failed:", error);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("nexora_session");
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
      <h2 className="text-2xl font-bold animate-pulse">NEXORACREW</h2>
      <p className="text-slate-400 mt-2">Connecting to Secure Database...</p>
    </div>
  );

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/transactions" element={<Transactions user={user} />} />
          <Route path="/transactions" element={<Transactions user={user} />} />
          {/* <Route path="/banks" element={<Banks user={user} />} />  REMOVED */}
          <Route path="/reports" element={<Reports user={user} />} />
          <Route path="/reports" element={<Reports user={user} />} />
          <Route path="/users" element={<UsersList />} />
          {/* ✅ Added SIP Route */}
          <Route path="/sip" element={<SipInvestment user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;