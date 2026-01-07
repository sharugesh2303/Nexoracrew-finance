import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, IndianRupee, Wallet, RefreshCw, Users, TrendingUp } from 'lucide-react';
import { User, Transaction, DashboardStats, TransactionType } from '../types';

// ✅ API CONFIGURATION
const API_BASE_URL = 'http://localhost:5000/api/v1'; 

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
        fetchData();
    }
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    try {
        // ✅ FETCH BOTH TRANSACTIONS AND USERS TO SHOW ALL MEMBERS
        const [txRes, usersRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/transactions`, { params: { userId: user.id } }),
            axios.get(`${API_BASE_URL}/users`)
        ]);
        
        const txs = txRes.data;
        const allUsers = usersRes.data;

        setTransactions(txs);
        
        // Pass both transactions and user list to calculator
        calculateStats(txs, allUsers);
        
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const calculateStats = (txs: Transaction[], allUsers: User[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalInc = 0;
    let totalExp = 0;
    let todayInc = 0;
    let todayExp = 0;
    let monthInc = 0;
    let monthExp = 0;
    let yearInc = 0;
    let yearExp = 0;

    const monthlyAgg: Record<number, { income: number; expense: number }> = {};
    const categoryAgg: Record<string, number> = {};
    
    // ✅ 1. Initialize Team Aggregation with ALL users (set to 0)
    // This ensures even members with 0 spending show up in the chart
    const teamAgg: Record<string, number> = {};
    allUsers.forEach(u => {
        teamAgg[u.name] = 0; 
    });

    // Initialize all months to 0 for correct chart sorting
    for(let i=0; i<12; i++) monthlyAgg[i] = { income: 0, expense: 0 };

    txs.forEach(t => {
      const tDate = new Date(t.date);
      const isToday = tDate.toDateString() === now.toDateString();
      const isMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      const isYear = tDate.getFullYear() === currentYear;

      if (t.type === TransactionType.INCOME) {
        totalInc += t.amount;
        if (isToday) todayInc += t.amount;
        if (isMonth) monthInc += t.amount;
        if (isYear) yearInc += t.amount;
      } else {
        // --- EXPENSE LOGIC ---
        totalExp += t.amount;
        if (isToday) todayExp += t.amount;
        if (isMonth) monthExp += t.amount;
        if (isYear) yearExp += t.amount;

        // Category breakdown
        if (categoryAgg[t.category]) categoryAgg[t.category] += t.amount;
        else categoryAgg[t.category] = t.amount;

        // ✅ 2. CORRECT SPENDING ATTRIBUTION
        // If 'investors' list exists (Team Split), attribute to THOSE people.
        // If not (Single), attribute to the CREATOR.
        if (t.investors && t.investors.length > 0) {
            // Split the amount equally among the selected people
            const splitAmount = t.amount / t.investors.length;
            
            t.investors.forEach(investorName => {
                // Initialize if name doesn't exist (e.g., if user was deleted but name remains)
                if (teamAgg[investorName] === undefined) teamAgg[investorName] = 0;
                
                teamAgg[investorName] += splitAmount;
            });
        } else {
            // Fallback: Single person mode (The Creator pays)
            const creatorName = t.userName || 'Unknown';
            if (teamAgg[creatorName] === undefined) teamAgg[creatorName] = 0;
            teamAgg[creatorName] += t.amount;
        }
      }

      // Monthly Chart Data (Current Year Only)
      if (isYear) {
        const mIndex = tDate.getMonth();
        if (t.type === TransactionType.INCOME) monthlyAgg[mIndex].income += t.amount;
        else monthlyAgg[mIndex].expense += t.amount;
      }
    });

    setStats({
      totalIncome: totalInc,
      totalExpense: totalExp,
      balance: totalInc - totalExp,
      todayIncome: todayInc,
      todayExpense: todayExp,
      monthIncome: monthInc,
      monthExpense: monthExp,
      yearIncome: yearInc,
      yearExpense: yearExp
    });

    // Format Monthly Data
    const mData = Object.keys(monthlyAgg).map(k => {
        const monthIndex = parseInt(k);
        return {
            name: new Date(0, monthIndex).toLocaleString('default', { month: 'short' }),
            Income: monthlyAgg[monthIndex].income,
            Expense: monthlyAgg[monthIndex].expense
        };
    });
    setMonthlyData(mData);

    // Format Category Data
    const cData = Object.keys(categoryAgg).map(key => ({
      name: key,
      value: categoryAgg[key]
    })).sort((a,b) => b.value - a.value).slice(0, 6);
    setCategoryData(cData);

    // ✅ 3. Format Team Data (Sorted by spending high to low)
    const tData = Object.keys(teamAgg).map(key => ({
        name: key,
        value: teamAgg[key]
    })).sort((a,b) => b.value - a.value);
    
    setTeamData(tData);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  if (isLoading) return (
    <div className="p-10 text-center flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-blue-500 mr-2"/> Loading Dashboard...
    </div>
  );

  if (!stats) return <div className="p-10 text-center">No data available</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-start z-10 relative">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Balance</p>
              <h3 className={`text-2xl font-bold mt-2 ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                 ₹{stats.balance.toLocaleString()}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Lifetime balance</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Monthly Income</p>
              <h3 className="text-2xl font-bold mt-2 text-emerald-600">
                 ₹{stats.monthIncome.toLocaleString()}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
              <ArrowUpRight size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Current month earnings</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Monthly Expense</p>
              <h3 className="text-2xl font-bold mt-2 text-rose-600">
                 ₹{stats.monthExpense.toLocaleString()}
              </h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg text-rose-600">
              <ArrowDownRight size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Current month spending</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Today's Flow</p>
              <div className="flex space-x-2 mt-2">
                <span className="text-emerald-500 text-sm font-bold flex items-center"><ArrowUpRight size={14}/> ₹{stats.todayIncome}</span>
                <span className="text-rose-500 text-sm font-bold flex items-center"><ArrowDownRight size={14}/> ₹{stats.todayExpense}</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600">
              <IndianRupee size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Real-time daily tracker</p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center"><TrendingUp size={20} className="mr-2 text-blue-500"/> Annual Cashflow</h3>
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Live Data</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1}/>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} 
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="Income" stroke="#10b981" fillOpacity={1} fill="url(#colorInc)" />
                <Area type="monotone" dataKey="Expense" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Expense Categories</h3>
          <div className="h-80 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: 'white'}}/>
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="mb-2 opacity-50"/>
                <p>No expense data found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Contribution Chart */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center">
              <Users size={20} className="mr-2 text-indigo-500"/> Team Contribution Analysis (Spending)
          </h3>
          <div className="h-64 w-full">
             {/* Always render, showing empty bars if value is 0 */}
             {teamData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamData} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100}/>
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} name="Total Spent"/>
                    </BarChart>
                 </ResponsiveContainer>
             ) : (
                 <div className="h-full flex items-center justify-center text-slate-400">
                     No team members found. Add them in Team Crew.
                 </div>
             )}
          </div>
      </div>
    </div>
  );
};