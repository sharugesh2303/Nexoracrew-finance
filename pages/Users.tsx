import React, { useEffect, useState } from "react";
import axios from "axios";
import { User } from "../types";
import { Loader2, Trash2, Edit, UserPlus, Mail, Briefcase, Calendar } from "lucide-react";

// ✅ API CONFIG
const API_BASE_URL = 'http://localhost:5000/api/v1';

const emptyForm: Partial<User> = {
  name: "",
  email: "",
  position: ""
};

export const UsersList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User>>(emptyForm);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
        const response = await axios.get(`${API_BASE_URL}/users`);
        setUsers(response.data);
    } catch (error) {
        console.error("Failed to load users", error);
    } finally {
        setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      position: user.position
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.position) {
      alert("All fields required");
      return;
    }

    setIsSaving(true);
    try {
        if (editingUser) {
            // Update existing user
            // Handle both _id (MongoDB) and id (Frontend type)
            const id = editingUser._id || editingUser.id;
            await axios.put(`${API_BASE_URL}/users/${id}`, form);
        } else {
            // Create new user
            await axios.post(`${API_BASE_URL}/users`, form);
        }
        
        setShowForm(false);
        loadUsers(); // Refresh list
    } catch (error) {
        console.error("Save failed", error);
        alert("Failed to save user. Email might be duplicate.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/users/${id}`);
        loadUsers();
    } catch (error) {
        console.error("Delete failed", error);
        alert("Failed to delete user.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            Team Management
            </h2>
            <p className="text-slate-500 text-sm">Manage access and roles for your crew</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all"
        >
          <UserPlus size={18} />
          <span>Add User</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 text-sm uppercase font-semibold">
            <tr>
              <th className="p-4 pl-6">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Position</th>
              <th className="p-4">Joined</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="animate-spin text-blue-500" /> Loading users...
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
                  No users found. Add your first team member!
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id || u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 pl-6 font-medium text-slate-800 dark:text-white">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold">
                              {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                      </div>
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                          <Mail size={14} className="opacity-50"/> {u.email}
                      </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      <Briefcase size={12}/>
                      {u.position}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-sm">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="opacity-50"/>
                        {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4 text-right space-x-2 pr-6">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit size={16}/>
                    </button>
                    <button
                      onClick={() => handleDelete(u._id || u.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold dark:text-white border-b border-slate-100 dark:border-slate-700 pb-4">
              {editingUser ? "Edit User" : "Add New User"}
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
                    <input
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. John Doe"
                        value={form.name || ""}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email Address</label>
                    <input
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="john@nexora.crew"
                        value={form.email || ""}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Job Position</label>
                    <input
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Developer"
                        value={form.position || ""}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2"
              >
                {isSaving && <Loader2 className="animate-spin" size={16}/>}
                Save User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};