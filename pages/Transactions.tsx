import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, Search, Filter, Download, Trash2, Edit, FileText, X, Check, 
  User as UserIcon, Loader2, Users, Table, CheckSquare, Square
} from 'lucide-react';
import { User, Transaction, TransactionType, PaymentMethod, BankAccount } from '../types';
import * as XLSX from 'xlsx';

// ✅ API CONFIGURATION
const API_BASE_URL = 'http://localhost:5000/api/v1'; 

interface TransactionsProps {
  user: User;
}

export const Transactions: React.FC<TransactionsProps> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [investmentFilter, setInvestmentFilter] = useState<'ALL' | 'TEAM' | 'SINGLE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit / Selection State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditCategoryOpen, setIsBulkEditCategoryOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');

  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    category: '',
    paymentMethod: PaymentMethod.CASH,
    description: '',
    investmentType: 'SINGLE',
    investors: []
  });

  const [tempInvestors, setTempInvestors] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
        refreshData();
    }
  }, [user]);

  const refreshData = async () => {
    if(transactions.length === 0) setIsLoading(true);
    
    try {
        const txResponse = await axios.get(`${API_BASE_URL}/transactions`, {
            params: { userId: user.id }
        });
        setTransactions(txResponse.data);

        try {
            const bankResponse = await axios.get(`${API_BASE_URL}/banks`, {
                params: { userId: user.id }
            });
            setBanks(bankResponse.data);
        } catch (error) {
            console.warn("Could not fetch banks");
        }

        try {
            const usersResponse = await axios.get(`${API_BASE_URL}/users`);
            setAvailableUsers(usersResponse.data);
        } catch (error) {
            console.warn("Could not fetch users");
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || t.type === filterType;
    const matchesInvest = investmentFilter === 'ALL' || 
                          (investmentFilter === 'TEAM' && t.investmentType === 'TEAM') ||
                          (investmentFilter === 'SINGLE' && t.investmentType !== 'TEAM');
                          
    return matchesSearch && matchesType && matchesInvest;
  });

  const handleExportExcel = () => {
    const data = filteredTransactions.map(t => ({
      Date: t.date,
      Type: t.type,
      Category: t.category,
      Amount: t.amount,
      Method: t.paymentMethod,
      Description: t.description,
      CreatedBy: t.userName,
      InvestmentType: t.investmentType,
      TeamMembers: t.investors?.join(', ') || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `NEXORACREW_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Max 5MB allowed.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, attachment: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // ✅ IMPROVED ATTACHMENT VIEWER
  const viewAttachment = (dataUrl: string) => {
      const w = window.open();
      if (w) {
          if (dataUrl.startsWith('data:image')) {
              w.document.write(`
                  <html>
                    <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#1e293b; height:100vh;">
                        <img src="${dataUrl}" style="max-width:90%; max-height:90%; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5);" />
                    </body>
                  </html>
              `);
          } else if (dataUrl.startsWith('data:application/pdf')) {
              w.document.write(`
                  <html>
                    <body style="margin:0; height:100vh;">
                        <iframe src="${dataUrl}" width="100%" height="100%" style="border:none;"></iframe>
                    </body>
                  </html>
              `);
          } else {
              // Fallback for docs/other types
              w.location.href = dataUrl;
          }
      }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredTransactions.map(t => t._id || t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.size} transactions?`)) {
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/transactions/bulk-delete`, {
                ids: Array.from(selectedIds)
            });
            await refreshData();
            setSelectedIds(new Set());
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert("Failed to delete items.");
            setIsLoading(false);
        }
    }
  };

  const handleBulkUpdateCategory = async () => {
      if(!bulkCategory) return;
      setIsLoading(true);
      try {
          await axios.post(`${API_BASE_URL}/transactions/bulk-update-category`, {
              ids: Array.from(selectedIds),
              category: bulkCategory
          });
          setIsBulkEditCategoryOpen(false);
          setBulkCategory('');
          await refreshData();
          setSelectedIds(new Set());
      } catch (error) {
          console.error("Bulk update failed", error);
          alert("Failed to update categories.");
          setIsLoading(false);
      }
  };

  const toggleInvestor = (name: string) => {
    setTempInvestors(prev => {
        if (prev.includes(name)) {
            return prev.filter(n => n !== name);
        } else {
            return [...prev, name];
        }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.date) return;
    
    if (formData.investmentType === 'TEAM' && tempInvestors.length === 0) {
        alert("Please select at least one team member.");
        return;
    }

    setIsSaving(true);

    const txData = {
        userId: user.id,
        userName: user.name,
        date: formData.date!,
        type: formData.type!,
        category: formData.category!,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod!,
        description: formData.description || '',
        bankAccountId: formData.bankAccountId,
        bankName: banks.find(b => (b._id || b.id) === formData.bankAccountId)?.bankName,
        attachment: formData.attachment,
        investmentType: formData.investmentType, 
        investors: formData.investmentType === 'TEAM' ? tempInvestors : undefined
    };

    try {
        if (editingTx) {
            const id = editingTx._id || editingTx.id;
            await axios.put(`${API_BASE_URL}/transactions/${id}`, txData);
        } else {
            await axios.post(`${API_BASE_URL}/transactions`, txData);
        }
        
        setIsModalOpen(false);
        setEditingTx(null);
        resetForm();
        refreshData();
    } catch (error) {
        console.error("Save failed", error);
        alert("Failed to save transaction.");
    } finally {
        setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: TransactionType.EXPENSE,
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      paymentMethod: PaymentMethod.CASH,
      description: '',
      investmentType: 'SINGLE',
      investors: []
    });
    setTempInvestors([]);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setFormData(tx);
    if (tx.investors && tx.investors.length > 0) {
        setTempInvestors(tx.investors);
    } else {
        setTempInvestors([]);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
          await axios.delete(`${API_BASE_URL}/transactions/${id}`);
          refreshData();
      } catch (error) {
          console.error("Delete failed", error);
          alert("Failed to delete transaction.");
      }
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center space-x-6 animate-bounce-in">
              <span className="font-bold">{selectedIds.size} Selected</span>
              <div className="h-4 w-px bg-slate-600"></div>
              <button onClick={() => setIsBulkEditCategoryOpen(true)} className="flex items-center space-x-2 hover:text-blue-400 transition-colors">
                  <Edit size={16} /><span>Change Category</span>
              </button>
              <button onClick={handleBulkDelete} className="flex items-center space-x-2 hover:text-red-400 transition-colors">
                  <Trash2 size={16} /><span>Delete</span>
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white">
                  <X size={16} />
              </button>
          </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 w-full md:w-auto">
          <Search size={20} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search entries..." 
            className="bg-transparent border-none focus:outline-none text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
           <select 
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
            value={investmentFilter}
            onChange={(e) => setInvestmentFilter(e.target.value as any)}
          >
            <option value="ALL">All Investments</option>
            <option value="TEAM">Team Only</option>
            <option value="SINGLE">Single Only</option>
          </select>

           <select 
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="ALL">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>

          <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Table size={18} /><span className="hidden sm:inline">Export</span>
          </button>

          <button onClick={() => { setEditingTx(null); resetForm(); setIsModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Plus size={18} /><span>Add New</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative min-h-[300px]">
        {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-4 py-4 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-500">
                        {selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                    </button>
                </th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Created By & Team</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                <tr key={tx._id || tx.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${selectedIds.has(tx._id || tx.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-4 py-4">
                      <button onClick={() => toggleSelectOne(tx._id || tx.id)} className="text-slate-400 hover:text-blue-500">
                        {selectedIds.has(tx._id || tx.id) ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18}/>}
                      </button>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{tx.date}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col">
                         <span className="text-xs text-slate-400 uppercase tracking-wide mb-1">Added By</span>
                         <div className="flex items-center gap-2 font-bold mb-1">
                             <UserIcon size={14} className="text-slate-400"/>
                             {tx.userName}
                         </div>
                         {tx.investmentType === 'TEAM' && (
                             <div className="mt-1">
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                     <Users size={10} className="mr-1"/> TEAM
                                 </span>
                                 {tx.investors && (
                                     <div className="text-xs text-slate-500 mt-1 pl-1 border-l-2 border-slate-200 ml-1">
                                         {tx.investors.join(', ')}
                                     </div>
                                 )}
                             </div>
                         )}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{tx.description}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                        tx.paymentMethod === PaymentMethod.GPAY ? 'bg-blue-100 text-blue-700' :
                        tx.paymentMethod === PaymentMethod.PHONEPE ? 'bg-purple-100 text-purple-700' :
                        tx.paymentMethod === PaymentMethod.PAYTM ? 'bg-sky-100 text-sky-700' :
                        tx.paymentMethod === PaymentMethod.FAMPAY ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {tx.paymentMethod}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-3">
                      {tx.attachment && (
                        <button onClick={() => viewAttachment(tx.attachment!)} className="text-blue-500 hover:text-blue-700" title="View Bill"><FileText size={16} /></button>
                      )}
                      <button onClick={() => openEdit(tx)} className="text-slate-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(tx._id || tx.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    {!isLoading && "No transactions found matching your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Category Edit Modal */}
      {isBulkEditCategoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold mb-4 dark:text-white">Bulk Change Category</h3>
                <input type="text" list="categories_bulk" className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700 mb-4" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} placeholder="Enter new category..." autoFocus />
                 <datalist id="categories_bulk"><option value="Food" /><option value="Travel" /><option value="Salary" /><option value="Office Rent" /><option value="Stationery" /><option value="Utilities" /><option value="Inventory" /><option value="Maintenance" /></datalist>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsBulkEditCategoryOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                    <button onClick={handleBulkUpdateCategory} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Update All</button>
                </div>
            </div>
          </div>
      )}

      {/* Main Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingTx ? 'Edit Entry' : 'New Transaction'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Transaction Type</label>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
                    <button type="button" onClick={() => setFormData({ ...formData, type: TransactionType.INCOME })} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.type === 'INCOME' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600' : 'text-slate-500'}`}>INCOME</button>
                    <button type="button" onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE })} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.type === 'EXPENSE' ? 'bg-white dark:bg-slate-600 shadow text-rose-600' : 'text-slate-500'}`}>EXPENSE</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (₹)</label>
                  <input type="number" required min="1" className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700 text-lg font-mono" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
                  <input type="date" required className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                  <input type="text" list="categories" required placeholder="Type or Select..." className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  <datalist id="categories"><option value="Food" /><option value="Travel" /><option value="Salary" /><option value="Office Rent" /><option value="Stationery" /><option value="Utilities" /><option value="Inventory" /><option value="Maintenance" /></datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment Via</label>
                  <select className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700" value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}>
                    <option value={PaymentMethod.CASH}>CASH</option>
                    <option value={PaymentMethod.GPAY}>GPay (Google Pay)</option>
                    <option value={PaymentMethod.PHONEPE}>PhonePe</option>
                    <option value={PaymentMethod.PAYTM}>Paytm</option>
                    <option value={PaymentMethod.FAMPAY}>FamPay</option>
                    <option value={PaymentMethod.CARD}>Debit Card</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* TEAM / SOURCE SELECTION LOGIC - Available for both types now */}
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-3">
                      {formData.type === TransactionType.INCOME ? 'Source / Contribution' : 'Investment Source'}
                  </label>
                  
                  <div className="flex gap-4 mb-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="radio" name="invType" checked={formData.investmentType === 'SINGLE'} onChange={() => setFormData({...formData, investmentType: 'SINGLE'})} className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Single Person (Me)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="radio" name="invType" checked={formData.investmentType === 'TEAM'} onChange={() => setFormData({...formData, investmentType: 'TEAM'})} className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Team / Split</span>
                      </label>
                  </div>

                  {formData.investmentType === 'TEAM' && (
                      <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 max-h-40 overflow-y-auto custom-scrollbar">
                          <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Select Members</p>
                          {availableUsers.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                                  {availableUsers.map(u => (
                                      <label key={u._id || u.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors">
                                          <input
                                              type="checkbox"
                                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                              checked={tempInvestors.includes(u.name)}
                                              onChange={() => toggleInvestor(u.name)}
                                          />
                                          <span className="text-sm text-slate-700 dark:text-slate-300">{u.name}</span>
                                      </label>
                                  ))}
                              </div>
                          ) : (
                              <p className="text-sm text-slate-400 italic">No users found. Add them in Team Crew page.</p>
                          )}
                      </div>
                  )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description / Notes</label>
                <textarea rows={2} className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-700" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload Bill (Image/PDF/Doc)</label>
                  <div className="flex items-center space-x-2">
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                          Choose File
                          <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
                      </label>
                      <span className="text-xs text-slate-400">{formData.attachment ? 'File Selected' : 'No file chosen'}</span>
                  </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-6 py-2 mr-3 text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isSaving && <Loader2 className="animate-spin mr-2" size={16} />} Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};