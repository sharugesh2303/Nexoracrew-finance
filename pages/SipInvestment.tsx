import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  TrendingUp, Plus, Calculator, RefreshCw, X, Check, 
  Wallet, Trash2, Target, Calendar, UserCheck, AlertCircle, 
  PieChart as PieIcon, ArrowRight, Download, Clock, BarChart2,
  TrendingDown, DollarSign, Activity, ArrowUp, ArrowDown, CheckCircle, 
  Lock, Eye, EyeOff, Bell, FileText, Upload, Search, ShieldCheck, Zap
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Transaction, TransactionType, PaymentMethod } from '../types';

// --- CONSOLE CLEANUP: Suppress Recharts "width" warning during animations ---
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && /width.*height.*chart/.test(args[0])) {
    return; // Ignore this specific harmless warning
  }
  originalConsoleError(...args);
};

const API_BASE_URL = 'http://localhost:5000/api/v1';

interface SipProps {
  user: User;
}

interface SipPlan {
  _id: string;
  name: string;
  totalAmount: number;
  startDate: string;
  dayOfMonth: number;
  splitType: 'EQUAL' | 'CUSTOM';
  members: { name: string; amount: number }[];
  active: boolean;
  goalName?: string;
  goalTarget?: number;
  currentNav?: number;
  fundSymbol?: string;
}

interface MarketAsset {
  name: string;
  symbol: string;
  price: number;
  change: number;
  currency: string;
  type?: string;
}

export const SipInvestment: React.FC<SipProps> = ({ user }) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLANS' | 'CALCULATOR' | 'MARKET'>('OVERVIEW');
  const [isLoading, setIsLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => localStorage.getItem('sip_privacy') === 'true');

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sipPlans, setSipPlans] = useState<SipPlan[]>([]);
  
  // Metrics
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [currentMarketValue, setCurrentMarketValue] = useState<number>(() => Number(localStorage.getItem('sip_market_value')) || 0);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  
  // Modal & Form
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SipPlan | null>(null);
  const [newPlanStep, setNewPlanStep] = useState(1);
  const [newPlan, setNewPlan] = useState<Partial<SipPlan>>({
    name: '', totalAmount: 5000, startDate: new Date().toISOString().split('T')[0], 
    dayOfMonth: 5, splitType: 'EQUAL', members: [], goalName: '', goalTarget: 100000, currentNav: 0
  });

  // Market & Tools
  const [marketIndices, setMarketIndices] = useState<MarketAsset[]>([]);
  const [sipSearchResults, setSipSearchResults] = useState<MarketAsset[]>([]);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [paymentProof, setPaymentProof] = useState<string>('');

  // Plan Detail Specifics
  const [planCurrentValue, setPlanCurrentValue] = useState<number>(0);
  const [graphRange, setGraphRange] = useState('1Y');
  const [graphData, setGraphData] = useState<any[]>([]);
  const [isChartReady, setIsChartReady] = useState(false); // ✅ Fix for chart crash

  // Calculator
  const [calcAmount, setCalcAmount] = useState(5000);
  const [calcRate, setCalcRate] = useState(12);
  const [calcYears, setCalcYears] = useState(5);
  const [calcResult, setCalcResult] = useState({ invested: 0, total: 0 });

  // --- INITIALIZATION ---
  useEffect(() => { fetchData(); fetchMarketData(); }, [user]);
  useEffect(() => { localStorage.setItem('sip_privacy', String(isPrivacyMode)); }, [isPrivacyMode]);
  useEffect(() => { if (currentMarketValue === 0 && totalPortfolioValue > 0) setCurrentMarketValue(totalPortfolioValue); }, [totalPortfolioValue]);
  useEffect(() => { if(currentMarketValue > 0) localStorage.setItem('sip_market_value', currentMarketValue.toString()); }, [currentMarketValue]);
  
  // Generate Graph Data when Plan Selected (With Delay)
  useEffect(() => {
      let timer: NodeJS.Timeout;
      
      if(selectedPlan) {
          // 1. Reset states immediately
          setGraphData([]);
          setIsChartReady(false);
          
          // 2. Delay calculation to allow Modal Animation (usually 300ms) to finish
          timer = setTimeout(() => {
             generateGraphData(graphRange, selectedPlan.currentNav || 100);
             setIsChartReady(true);
          }, 500); 
      }
      return () => clearTimeout(timer); 
  }, [selectedPlan, graphRange]);

  useEffect(() => {
    const months = calcYears * 12;
    const i = calcRate / 12 / 100;
    const total = calcAmount * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
    setCalcResult({ invested: calcAmount * months, total: Math.round(total) });
  }, [calcAmount, calcRate, calcYears]);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
        const [txRes, usersRes, plansRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/transactions`, { params: { userId: user.id } }),
            axios.get(`${API_BASE_URL}/users`),
            axios.get(`${API_BASE_URL}/sip-plans`)
        ]);

        const allTxs: Transaction[] = txRes.data;
        const sips = allTxs.filter(t => t.category.toUpperCase().includes('SIP') || t.category.toUpperCase().includes('INVESTMENT'));
        sips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTransactions(sips);
        setUsers(usersRes.data);
        setSipPlans(plansRes.data);
        calculateMetrics(sips);
    } catch (error) { console.error("Error", error); } 
    finally { setIsLoading(false); }
  };

  const fetchMarketData = async () => {
      try {
          const res = await axios.get(`${API_BASE_URL}/market/live`);
          setMarketIndices(res.data);
      } catch (e) { 
          console.warn("Market API unavailable"); 
      }
  };

  const calculateMetrics = (sips: Transaction[]) => {
      let total = 0;
      const historyMap: Record<string, number> = {};
      sips.forEach(t => {
          total += t.amount;
          const dateKey = t.date.substring(0, 7);
          if (!historyMap[dateKey]) historyMap[dateKey] = 0;
          historyMap[dateKey] += t.amount;
      });
      setTotalPortfolioValue(total);
      let running = 0;
      setPortfolioHistory(Object.keys(historyMap).sort().map(d => {
          running += historyMap[d];
          return { date: d, value: running };
      }));
  };

  // --- GRAPH GENERATOR ---
  const generateGraphData = (range: string, basePrice: number) => {
      const dataPoints = [];
      let points = 30;
      let volatility = 0.02;

      if(range === '1D') { points = 24; volatility = 0.005; }
      else if(range === '1W') { points = 7; volatility = 0.01; }
      else if(range === '1M') { points = 30; volatility = 0.02; }
      else if(range === '1Y') { points = 12; volatility = 0.05; }
      else { points = 50; volatility = 0.08; } // 3Y, 5Y

      let current = basePrice * 0.8; 
      for(let i=0; i<points; i++) {
          const change = (Math.random() - 0.4) * volatility; 
          current = current * (1 + change);
          dataPoints.push({ time: i, value: current });
      }
      dataPoints[dataPoints.length-1].value = basePrice;
      setGraphData(dataPoints);
  };

  // --- PLAN DETAIL HELPERS ---
  const getPlanStats = (plan: SipPlan) => {
      const planTxs = transactions.filter(t => t.description?.includes(plan.name));
      const planInvested = planTxs.reduce((sum, t) => sum + t.amount, 0);
      
      const liveNav = plan.currentNav || 100;
      const estimatedUnits = planInvested / (liveNav * 0.9);
      const liveValue = planCurrentValue > 0 ? planCurrentValue : (estimatedUnits * liveNav);
      
      const planGrowth = liveValue - planInvested;
      const planGrowthPerc = planInvested > 0 ? (planGrowth / planInvested) * 100 : 0;
      
      const dailyChange = liveValue * 0.008; 
      const isDayPositive = Math.random() > 0.4;

      return { planInvested, liveValue, planGrowth, planGrowthPerc, planTxs, dailyChange, isDayPositive };
  };

  const getPlanBenefits = (name: string) => {
      const n = name.toLowerCase();
      if(n.includes('tax') || n.includes('elss')) return ['Tax Saving (80C)', '3 Year Lock-in', 'High Returns'];
      if(n.includes('gold')) return ['Hedge vs Inflation', 'Safe Haven', 'Portfolio Stability'];
      if(n.includes('index') || n.includes('nifty')) return ['Low Cost', 'Market Returns', 'Steady Growth'];
      if(n.includes('small')) return ['Very High Growth', 'High Risk', 'Long Term Wealth'];
      return ['Disciplined Savings', 'Rupee Cost Averaging', 'Compound Growth'];
  };

  // --- ACTIONS ---
  const handleCreatePlan = async () => {
      if (!newPlan.name || !newPlan.totalAmount || newPlan.members?.length === 0) return alert("Fill all details");
      try {
          await axios.post(`${API_BASE_URL}/sip-plans`, { ...newPlan, active: true });
          setIsPlanModalOpen(false); setNewPlanStep(1); fetchData();
      } catch (error) { alert("Error creating plan"); }
  };

  const handleDeletePlan = async (id: string) => {
      if(confirm("Stop tracking this SIP Plan?")) {
          try { await axios.delete(`${API_BASE_URL}/sip-plans/${id}`); fetchData(); setSelectedPlan(null); } catch (error) {}
      }
  };

  const handleDeleteHistory = async (id: string) => {
      if(confirm("Delete this payment record? This will adjust your total wealth.")) {
          try { await axios.delete(`${API_BASE_URL}/transactions/${id}`); 
          const txRes = await axios.get(`${API_BASE_URL}/transactions`, { params: { userId: user.id } });
          const allTxs = txRes.data;
          const sips = allTxs.filter((t: Transaction) => t.category.toUpperCase().includes('SIP') || t.category.toUpperCase().includes('INVESTMENT'));
          setTransactions(sips);
          } catch (error) { alert("Delete failed"); }
      }
  };

  const handleMarketSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!marketSearchQuery.trim()) return;
    setIsSearching(true);
    try {
        const res = await axios.get(`${API_BASE_URL}/market/search`, { params: { q: marketSearchQuery } });
        setMarketIndices(res.data); 
    } catch (error) { } finally { setIsSearching(false); }
  };
  const resetMarket = () => { setMarketSearchQuery(''); fetchMarketData(); };

  const searchSipFund = async (query: string) => {
      if (!query || query.length < 3) return;
      setIsSearching(true);
      try {
          const res = await axios.get(`${API_BASE_URL}/market/search`, { params: { q: query } });
          setSipSearchResults(res.data);
      } catch (e) { setSipSearchResults([]); } 
      finally { setIsSearching(false); }
  };

  const selectSipFund = (asset: MarketAsset) => {
      setNewPlan({ 
          ...newPlan, 
          name: asset.name, 
          fundSymbol: asset.symbol, 
          currentNav: asset.price 
      });
      setSipSearchResults([]); 
  };

  const recordPayment = async (plan: SipPlan, memberName: string, amount: number) => {
      if(!confirm(`Confirm payment of ₹${amount} from ${memberName}?`)) return;
      try {
          await axios.post(`${API_BASE_URL}/transactions`, {
              userId: user.id, userName: user.name, type: TransactionType.EXPENSE,
              category: 'SIP Investment', amount: amount, date: new Date().toISOString().split('T')[0],
              description: `SIP Installment: ${plan.name}`, paymentMethod: PaymentMethod.BANK_TRANSFER,
              investmentType: 'TEAM', investors: [memberName], attachment: paymentProof 
          });
          alert("Payment Recorded!"); setPaymentProof(''); fetchData();
      } catch (e) { alert("Failed"); }
  };

  const getPaymentInfo = (plan: SipPlan, memberName: string) => {
      const today = new Date();
      const currentDay = today.getDate();
      const dueDateThisMonth = new Date(today.getFullYear(), today.getMonth(), plan.dayOfMonth);
      let nextDueDate = new Date(dueDateThisMonth);
      if (currentDay > plan.dayOfMonth) nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      const daysRemaining = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      const hasPaid = transactions.some(t => {
          const tDate = new Date(t.date);
          const targetMonth = nextDueDate.getMonth() - (currentDay > plan.dayOfMonth ? 0 : 1);
          return t.description.toLowerCase().includes(plan.name.toLowerCase()) && 
                 (t.investors?.includes(memberName) || t.userName === memberName) &&
                 (tDate.getMonth() === targetMonth);
      });

      if (hasPaid) return { status: 'PAID', text: 'Paid', color: 'text-emerald-500' };
      if (daysRemaining < -5) return { status: 'DEFAULTED', text: 'Late', color: 'text-red-600' };
      if (daysRemaining < 0) return { status: 'OVERDUE', text: 'Overdue', color: 'text-red-500' };
      return { status: 'PENDING', text: `Due: ${daysRemaining}d`, color: 'text-orange-500' };
  };

  const formatMoney = (amount: number) => isPrivacyMode ? '₹ •••••' : `₹${amount.toLocaleString()}`;
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPaymentProof(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleMemberSelection = (userName: string) => {
      const currentMembers = newPlan.members || [];
      const exists = currentMembers.find(m => m.name === userName);
      let updatedMembers = exists ? currentMembers.filter(m => m.name !== userName) : [...currentMembers, { name: userName, amount: 0 }];
      if (newPlan.splitType === 'EQUAL' && updatedMembers.length > 0) {
          const share = Math.floor((newPlan.totalAmount || 0) / updatedMembers.length);
          updatedMembers = updatedMembers.map(m => ({ ...m, amount: share }));
      }
      setNewPlan({ ...newPlan, members: updatedMembers });
  };

  const updateMemberAmount = (userName: string, amount: number) => {
      const updated = newPlan.members?.map(m => m.name === userName ? { ...m, amount } : m);
      setNewPlan({ ...newPlan, members: updated });
  };

  const profitLoss = currentMarketValue - totalPortfolioValue;
  const isProfit = profitLoss >= 0;

  if (isLoading) return <div className="p-10 flex justify-center"><RefreshCw className="animate-spin text-blue-500"/></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. TOP NAV */}
      <div className="flex justify-between items-center">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-xl inline-flex shadow-sm border border-slate-200 dark:border-slate-700">
              {[{ id: 'OVERVIEW', icon: Wallet, label: 'Portfolio' }, { id: 'PLANS', icon: Target, label: 'Active Plans' }, { id: 'MARKET', icon: Activity, label: 'Market' }, { id: 'CALCULATOR', icon: Calculator, label: 'XIRR Calc' }].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <tab.icon size={16}/> {tab.label}
                  </button>
              ))}
          </div>
          <div className="flex gap-3">
              <button onClick={() => setIsPrivacyMode(!isPrivacyMode)} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors">{isPrivacyMode ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
              <button onClick={() => { setIsPlanModalOpen(true); setNewPlanStep(1); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"><Plus size={18}/> New Goal</button>
          </div>
      </div>

      {/* --- TAB 1: OVERVIEW --- */}
      {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
                  <div className="relative z-10 grid grid-cols-2 gap-8">
                      <div><p className="text-indigo-200 text-xs uppercase tracking-wider mb-2">Total Invested</p><h2 className="text-4xl font-bold">{formatMoney(totalPortfolioValue)}</h2></div>
                      <div><p className="text-indigo-200 text-xs uppercase tracking-wider mb-2">Current Value (Est)</p><div className="flex items-center gap-2">{!isPrivacyMode && <input type="number" value={currentMarketValue || ''} onChange={e => setCurrentMarketValue(Number(e.target.value))} className="text-4xl font-bold bg-transparent border-b border-white/20 w-40 focus:outline-none focus:border-white text-white" placeholder={totalPortfolioValue.toString()} />}{isPrivacyMode && <span className="text-4xl font-bold">₹ •••••</span>}</div></div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                      <div><p className="text-xs text-indigo-300">Total Returns</p><p className={`text-xl font-bold flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{isProfit ? <ArrowUp size={20}/> : <ArrowDown size={20}/>} {formatMoney(Math.abs(profitLoss))}</p></div>
                  </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18}/> Recent History</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                      {transactions.slice(0, 5).map(tx => (
                          <div key={tx.id || (tx as any)._id} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                              <div><p className="font-medium text-slate-700 dark:text-slate-300">{tx.description}</p><p className="text-xs text-slate-400">{new Date(tx.date).toLocaleDateString()}</p></div>
                              <span className="font-bold text-emerald-600">+₹{tx.amount}</span>
                          </div>
                      ))}
                      {transactions.length === 0 && <p className="text-slate-400 text-xs">No records yet.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB 2: PLANS --- */}
      {activeTab === 'PLANS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sipPlans.map(plan => {
                  const invested = transactions.filter(t => t.description.includes(plan.name)).reduce((s, t) => s + t.amount, 0);
                  const progress = plan.goalTarget ? Math.min((invested / plan.goalTarget) * 100, 100) : 0;
                  const dueInfo = getPaymentInfo(plan, ''); 

                  return (
                    <div key={plan._id} onClick={() => { setSelectedPlan(plan); setPlanCurrentValue(0); }} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 flex justify-between">
                            <div><h3 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{plan.name}</h3>{plan.fundSymbol && <span className="text-[10px] text-slate-500">{plan.fundSymbol}</span>}</div>
                            <div className="text-right"><span className="block text-xl font-bold text-indigo-600">{formatMoney(plan.totalAmount)}</span><span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded">{plan.splitType} SPLIT</span></div>
                        </div>
                        <div className="p-5">
                            {plan.goalTarget && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1 text-slate-500"><span>Goal: {formatMoney(plan.goalTarget)}</span><span>{Math.round(progress)}%</span></div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-emerald-500 h-full rounded-full" style={{width: `${progress}%`}}></div></div>
                                </div>
                            )}
                            <div className="space-y-3">
                                {plan.members.map((member, idx) => {
                                    const info = getPaymentInfo(plan, member.name);
                                    return (
                                      <div key={idx} className="flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{member.name.charAt(0)}</div>
                                              <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{member.name}</p><p className="text-xs text-slate-400">{formatMoney(member.amount)}</p></div>
                                          </div>
                                          {info.status === 'PAID' ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"><CheckCircle size={14}/> Paid</span> : <button onClick={(e) => { e.stopPropagation(); recordPayment(plan, member.name, member.amount); }} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-all shadow-sm"><Wallet size={14}/> Pay</button>}
                                      </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-center flex justify-between px-6">
                            <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> Due Day: {plan.dayOfMonth}</span>
                            <button onClick={(e) => {e.stopPropagation(); handleDeletePlan(plan._id)}} className="text-xs text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                        </div>
                    </div>
                  );
              })}
          </div>
      )}

      {/* --- TAB 3: MARKET WATCH --- */}
      {activeTab === 'MARKET' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-white">Live Indices</h3>
                  <form onSubmit={handleMarketSearch} className="flex gap-2">
                      <input type="text" placeholder="Search (e.g. RELIANCE)" className="p-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-700 outline-none w-64" value={marketSearchQuery} onChange={e => setMarketSearchQuery(e.target.value)}/>
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">{isSearching ? <RefreshCw className="animate-spin" size={18}/> : <Search size={18}/>}</button>
                      {marketSearchQuery && <button type="button" onClick={resetMarket} className="text-slate-400 p-2"><X size={18}/></button>}
                  </form>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                  {marketIndices.map((m, i) => (
                      <div key={i} className="flex justify-between items-center border p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <div><span className="font-medium text-slate-700 dark:text-slate-200">{m.name}</span><p className="text-xs text-slate-400">{m.symbol}</p></div>
                          <div className="text-right"><p className="font-bold text-slate-800 dark:text-white">{m.currency === 'USD' ? '$' : '₹'}{m.price.toFixed(2)}</p><p className={`text-xs font-bold ${m.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%</p></div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- TAB 4: CALCULATOR --- */}
      {activeTab === 'CALCULATOR' && (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2"><Calculator className="text-indigo-500"/> SIP Calculator</h3>
              <div className="space-y-6">
                  <div><div className="flex justify-between mb-2 text-sm font-medium"><span>Monthly Invest</span><span>₹{calcAmount}</span></div><input type="range" min="500" max="50000" step="500" value={calcAmount} onChange={e=>setCalcAmount(Number(e.target.value))} className="w-full accent-indigo-600"/></div>
                  <div><div className="flex justify-between mb-2 text-sm font-medium"><span>Rate (%)</span><span>{calcRate}%</span></div><input type="range" min="1" max="30" step="0.5" value={calcRate} onChange={e=>setCalcRate(Number(e.target.value))} className="w-full accent-emerald-500"/></div>
                  <div><div className="flex justify-between mb-2 text-sm font-medium"><span>Years</span><span>{calcYears}</span></div><input type="range" min="1" max="40" step="1" value={calcYears} onChange={e=>setCalcYears(Number(e.target.value))} className="w-full accent-blue-500"/></div>
                  <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl text-center"><p className="text-slate-500 text-sm uppercase">Projected Wealth</p><h2 className="text-4xl font-bold text-indigo-600 mt-2">₹{calcResult.total.toLocaleString()}</h2></div>
              </div>
          </div>
      )}

      {/* --- 🌟 PLAN DETAIL VIEW (FULL SCREEN) --- */}
      {selectedPlan && (
          <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
              {(() => {
                  const { planInvested, liveValue, planGrowth, planGrowthPerc, planTxs, dailyChange, isDayPositive } = getPlanStats(selectedPlan);
                  const benefits = getPlanBenefits(selectedPlan.name);

                  return (
                    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                        {/* Header Nav */}
                        <div className="flex items-center justify-between">
                            <button onClick={() => setSelectedPlan(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
                                <ArrowRight className="rotate-180" size={24}/> Back to Dashboard
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => handleDeletePlan(selectedPlan._id)} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-100"><Trash2 size={16}/> Delete Plan</button>
                            </div>
                        </div>

                        {/* Top Hero Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Main Value Card */}
                            <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Value</p>
                                    <h1 className="text-5xl font-bold text-slate-800 dark:text-white">₹{Math.round(liveValue).toLocaleString()}</h1>
                                    <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${planGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                        {planGrowth >= 0 ? <TrendingUp size={16} className="mr-1"/> : <TrendingDown size={16} className="mr-1"/>}
                                        ₹{Math.abs(Math.round(planGrowth)).toLocaleString()} ({planGrowthPerc.toFixed(2)}%)
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Invested: ₹{planInvested.toLocaleString()}</p>
                                </div>
                                
                                {/* Live Ticker Box */}
                                <div className="mt-6 md:mt-0 bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl min-w-[250px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Activity size={12}/> Daily P&L</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">LIVE</span>
                                    </div>
                                    <h3 className={`text-2xl font-bold ${isDayPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {isDayPositive ? '+' : '-'}₹{dailyChange.toFixed(2)}
                                    </h3>
                                    <div className="mt-4">
                                        <p className="text-xs text-slate-400 mb-1">Check Live NAV</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-slate-700 dark:text-white">₹</span>
                                            <input 
                                                type="number" 
                                                className="bg-transparent border-b border-slate-300 dark:border-slate-600 w-full font-mono text-lg focus:outline-none focus:border-blue-500 dark:text-white"
                                                placeholder={selectedPlan.currentNav ? selectedPlan.currentNav.toString() : "Enter NAV"}
                                                value={planCurrentValue || ''}
                                                onChange={e => setPlanCurrentValue(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Benefits Card */}
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ShieldCheck/> Plan Benefits</h3>
                                <ul className="space-y-3">
                                    {benefits.map((b, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm opacity-90">
                                            <CheckCircle size={16} className="mt-0.5 text-emerald-300 shrink-0"/>
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-6 pt-4 border-t border-white/20">
                                    <p className="text-xs text-indigo-200 uppercase tracking-wider mb-1">Goal Status</p>
                                    <div className="flex justify-between items-end">
                                        <span className="font-bold text-xl">{selectedPlan.goalTarget ? Math.min((planInvested/selectedPlan.goalTarget)*100, 100).toFixed(0) : 0}%</span>
                                        <span className="text-xs opacity-70">of ₹{(selectedPlan.goalTarget || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-black/20 h-1.5 rounded-full mt-2"><div className="bg-white h-full rounded-full" style={{width: `${selectedPlan.goalTarget ? Math.min((planInvested/selectedPlan.goalTarget)*100, 100) : 0}%`}}></div></div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Graph Section */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><BarChart2 className="text-blue-500"/> Performance Graph</h3>
                                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mt-4 md:mt-0">
                                    {['1D', '1W', '1M', '6M', '1Y', '3Y', '5Y'].map(r => (
                                        <button 
                                            key={r} 
                                            onClick={() => setGraphRange(r)}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${graphRange === r ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* FIXED GRAPH CONTAINER */}
                            <div style={{ width: '100%', height: 300, minHeight: '300px', display: 'block', position: 'relative' }}>
                                {isChartReady && graphData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={graphData}>
                                            <defs>
                                                <linearGradient id="colorGraph" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5}/>
                                            <XAxis dataKey="time" hide />
                                            <YAxis domain={['auto', 'auto']} orientation="right" tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} cursor={{stroke: '#3b82f6', strokeWidth: 2}}/>
                                            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fill="url(#colorGraph)" animationDuration={1000}/>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <RefreshCw className="animate-spin mb-2" />
                                            <span className="text-xs">Generating Chart...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Transaction History (Granular Control) */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="font-bold text-slate-800 dark:text-white">Transaction History</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase tracking-wider font-bold text-xs">
                                        <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Payer</th><th className="px-6 py-4 text-right">Amount</th><th className="px-6 py-4 text-center">Proof</th><th className="px-6 py-4 text-center">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {planTxs.map(tx => (
                                            <tr key={tx.id || (tx as any)._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono">{tx.date}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px]">{tx.investors?.[0]?.charAt(0)}</div>
                                                    {tx.investors?.[0] || tx.userName}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-600">₹{tx.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {tx.attachment ? <button onClick={() => window.open(tx.attachment)} className="text-blue-600 hover:underline text-xs flex items-center justify-center gap-1"><FileText size={12}/> View</button> : <span className="text-slate-300 text-xs">-</span>}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => handleDeleteHistory(tx.id || (tx as any)._id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {planTxs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No payments recorded yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                  );
              })()}
          </div>
      )}

      {/* --- CREATE MODAL (Restored) --- */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="font-bold text-lg dark:text-white">Create New SIP Goal</h2>
                    <button onClick={() => setIsPlanModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    {/* Fund Search */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Fund / Plan Name</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search Mutual Fund or enter custom name..." 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white"
                                value={newPlan.name}
                                onChange={e => { setNewPlan({...newPlan, name: e.target.value}); searchSipFund(e.target.value); }}
                            />
                            {isSearching && <div className="absolute right-3 top-3"><RefreshCw className="animate-spin text-slate-400" size={16}/></div>}
                            {sipSearchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                    {sipSearchResults.map((r, i) => (
                                        <div key={i} onClick={() => selectSipFund(r)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm">
                                            <p className="font-bold dark:text-white">{r.name}</p>
                                            <p className="text-xs text-slate-400">{r.symbol}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Goal Amount</label>
                            <input 
                                type="number" 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white"
                                placeholder="₹ 1,00,000"
                                value={newPlan.goalTarget || ''}
                                onChange={e => setNewPlan({...newPlan, goalTarget: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Monthly SIP</label>
                            <input 
                                type="number" 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white"
                                placeholder="₹ 5,000"
                                value={newPlan.totalAmount || ''}
                                onChange={e => setNewPlan({...newPlan, totalAmount: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    {/* Members Selection */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Split With Team</label>
                        <div className="flex gap-2 flex-wrap mb-3">
                            {users.map(u => {
                                const isSelected = newPlan.members?.some(m => m.name === u.name);
                                return (
                                    <button 
                                        key={u.id} 
                                        onClick={() => toggleMemberSelection(u.name)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500'}`}
                                    >
                                        {u.name}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Member Amounts */}
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {newPlan.members?.map((m, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg text-sm">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{m.name}</span>
                                    <input 
                                        type="number" 
                                        className="w-24 text-right bg-transparent border-b border-slate-300 focus:outline-none dark:text-white"
                                        value={m.amount}
                                        onChange={(e) => updateMemberAmount(m.name, Number(e.target.value))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleCreatePlan}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                    >
                        <Plus size={18}/> Create Plan
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};