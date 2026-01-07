import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, FileBarChart, Filter, Loader2 } from 'lucide-react';
import { User, Transaction, PaymentMethod } from '../types';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ✅ API CONFIG
const API_BASE_URL = 'http://localhost:5000/api/v1';

interface ReportsProps {
  user: User;
}

export const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [reportType, setReportType] = useState('monthly');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // Data State
  const [stats, setStats] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. Fetch Data on Load
  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/transactions`, {
        params: { userId: user.id }
      });
      setAllTransactions(response.data);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Recalculate Summary whenever filters or data change
  useEffect(() => {
    if (!isLoading) {
      calculateSummary();
    }
  }, [allTransactions, year, month, reportType, paymentFilter, isLoading]);

  const getFilteredTransactions = () => {
    return allTransactions.filter(t => {
      const d = new Date(t.date);
      let dateMatch = false;

      if (reportType === 'monthly') {
        dateMatch = d.getFullYear() === year && d.getMonth() === month;
      } else {
        dateMatch = d.getFullYear() === year;
      }

      const paymentMatch = paymentFilter === 'ALL' || t.paymentMethod === paymentFilter;

      return dateMatch && paymentMatch;
    });
  };

  const calculateSummary = () => {
    const txs = getFilteredTransactions();
    const summary: Record<string, number> = {};

    txs.forEach(t => {
      if (!summary[t.paymentMethod]) summary[t.paymentMethod] = 0;

      if (t.type === 'INCOME') summary[t.paymentMethod] += t.amount;
      else summary[t.paymentMethod] -= t.amount;
    });

    setStats(Object.entries(summary).map(([method, amount]) => ({ method, amount })));
  };

  // --- HELPER: Convert Image URL to Base64 for PDF ---
  const getImageData = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } else {
          reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePDFReport = async () => {
    try {
      setIsGenerating(true);
      const doc = new jsPDF();
      const filteredTxs = getFilteredTransactions();

      // --- Calculations ---
      const totalIncome = filteredTxs.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = filteredTxs.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      const netBalance = totalIncome - totalExpense;

      // --- Header Design ---
      const logoX = 15;
      const logoY = 15;
      const logoWidth = 25;
      const logoHeight = 25;

      // 1. ADD LOGO FROM PUBLIC FOLDER
      try {
        // ⚠️ MAKE SURE 'logo.png' EXISTS IN YOUR PUBLIC FOLDER
        const logoBase64 = await getImageData('/logo.jpg');
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (imgError) {
        console.warn("Logo loading failed, falling back to text", imgError);
        // Fallback if image fails
        doc.setFontSize(20);
        doc.setTextColor(46, 16, 101);
        doc.text("NC", logoX + 5, logoY + 15);
      }

      // 2. Brand Name & Tagline (Positioned next to logo)
      const textStartX = logoX + logoWidth + 5;

      doc.setFontSize(22);
      doc.setTextColor(30, 27, 75);
      doc.setFont("times", "bold");
      doc.text("NEXORACREW", textStartX, logoY + 12);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("WHERE IDEAS MEET INNOVATION", textStartX, logoY + 18);

      // --- Header Divider ---
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(15, logoY + 30, 195, logoY + 30);

      // --- Details ---
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("FINANCIAL STATEMENT", 195, 25, { align: "right" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("HQ: Palakkari, Trichy - 01", 195, 30, { align: "right" });
      doc.text("Email: nexora.crew@gmail.com", 195, 34, { align: "right" });

      const startInfoY = 60;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.text(`INVOICE #: INV-${Date.now().toString().slice(-6)}`, 15, startInfoY);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, startInfoY + 5);

      doc.setFont("helvetica", "bold");
      doc.text(`AUDITOR:`, 195, startInfoY, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.text(`THARSAN (CEO)`, 195, startInfoY + 5, { align: "right" });

      // --- Summary Boxes ---
      let startY = 75;
      const boxWidth = 58;
      const boxHeight = 22;
      const gap = 6;

      // Income
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(15, startY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(22, 163, 74);
      doc.setFontSize(8);
      doc.text("TOTAL INCOME", 20, startY + 7);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Rs. ${totalIncome.toLocaleString()}`, 20, startY + 16);

      // Expense
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(15 + boxWidth + gap, startY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("TOTAL EXPENSE", 20 + boxWidth + gap, startY + 7);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Rs. ${totalExpense.toLocaleString()}`, 20 + boxWidth + gap, startY + 16);

      // Balance
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(15 + (boxWidth * 2) + (gap * 2), startY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("NET BALANCE", 20 + (boxWidth * 2) + (gap * 2), startY + 7);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Rs. ${netBalance.toLocaleString()}`, 20 + (boxWidth * 2) + (gap * 2), startY + 16);

      // --- Table ---
      const tableColumn = ["Date", "Category", "Description", "Inv.", "Type", "Amount"];
      const tableRows = filteredTxs.map(tx => {
        let investStr = "Self";
        if (tx.investmentType === 'TEAM' && tx.investors) {
          investStr = `Team (${tx.investors.length})`;
        }
        return [
          new Date(tx.date).toLocaleDateString(),
          tx.category,
          tx.description,
          investStr,
          tx.type,
          `Rs. ${tx.amount.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY + 30,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59] as any,
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 45 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        },
        styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      });

      // --- Safe Positioning for Footer Content ---
      const lastTable = (doc as any).lastAutoTable;
      let finalY = lastTable ? lastTable.finalY + 15 : startY + 50;

      if (finalY > 230) {
        doc.addPage();
        finalY = 20;
      }

      // Breakdown
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("PAYMENT CHANNEL BREAKDOWN", 15, finalY);

      const summaryRows = stats.map(s => [s.method, `Rs. ${s.amount.toLocaleString()}`]);

      autoTable(doc, {
        head: [["Channel", "Net Flow"]],
        body: summaryRows,
        startY: finalY + 4,
        theme: 'plain',
        headStyles: { fillColor: [226, 232, 240], textColor: 50, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        tableWidth: 80,
        columnStyles: { 1: { halign: 'right' } }
      });

      // --- Seal & Signature ---
      const lastSummary = (doc as any).lastAutoTable;
      finalY = Math.max(lastSummary ? lastSummary.finalY + 10 : finalY + 20, finalY);

      // --- 1. CIRCULAR STAMP (Simple) ---
      const sealY = finalY + 20;
      const sealX = 160;

      if (sealY > 270) {
        doc.addPage();
      }

      // Simple Stamp
      doc.setDrawColor(185, 28, 28);
      doc.setLineWidth(0.8);
      doc.circle(sealX, sealY, 18, 'S');
      doc.setLineWidth(0.2);
      doc.circle(sealX, sealY, 16, 'S');

      doc.setTextColor(185, 28, 28);
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.text("NEXORACREW", sealX, sealY - 6, { align: "center" });
      doc.text("AUDITED", sealX, sealY + 1, { align: "center" });
      doc.setFontSize(5);
      doc.text(`ID: ${user.id.slice(0, 6).toUpperCase()}`, sealX, sealY + 7, { align: "center" });

      // --- 2. SIGNATURE (Image with Fallback) ---
      try {
        // ⚠️ PLACE 'signature.png' or 'signature.jpg' IN PUBLIC FOLDER
        // Checking for PNG first
        const sigBase64 = await getImageData('/signature.png');
        doc.addImage(sigBase64, 'PNG', sealX - 20, sealY + 16, 40, 20);
      } catch (e) {
        try {
          // Fallback to JPG
          const sigBase64 = await getImageData('/signature.jpg');
          doc.addImage(sigBase64, 'JPG', sealX - 20, sealY + 16, 40, 20);
        } catch (err) {
          // Fallback to Text if no image found
          doc.setFont("times", "italic");
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text("Tharsan", sealX, sealY + 30, { align: "center" });
        }
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text("FOUNDER & CEO", sealX, sealY + 38, { align: "center" });

      // --- Save ---
      doc.save(`NEXORACREW_STMT_${year}_${Date.now()}.pdf`);
      setIsGenerating(false);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF. Please try again or check console for details.");
      setIsGenerating(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-[500px] items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Financial Statements</h2>
        <p className="text-slate-500 mt-2">Generate official signed PDF bills and audit breakdowns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold mb-6 dark:text-white flex items-center text-lg"><Filter size={20} className="mr-2 text-blue-500" /> Report Configuration</h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Report Type</label>
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                <button onClick={() => setReportType('monthly')} className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${reportType === 'monthly' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-500'}`}>Monthly</button>
                <button onClick={() => setReportType('yearly')} className={`flex-1 py-2.5 rounded-md text-sm font-bold transition-all ${reportType === 'yearly' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-500'}`}>Yearly</button>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full p-3 rounded-lg border border-slate-200 dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                  ))}
                </select>
              </div>
              {reportType === 'monthly' && (
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Month</label>
                  <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full p-3 rounded-lg border border-slate-200 dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-2 focus:ring-blue-500">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Payment Channel Filter</label>
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 dark:bg-slate-700 dark:border-slate-600 font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Payment Methods</option>
                <option value={PaymentMethod.GPAY}>Google Pay (GPay)</option>
                <option value={PaymentMethod.PHONEPE}>PhonePe</option>
                <option value={PaymentMethod.PAYTM}>Paytm</option>
                <option value={PaymentMethod.FAMPAY}>FamPay</option>
                <option value={PaymentMethod.CARD}>Debit Cards</option>
                <option value={PaymentMethod.CASH}>Cash</option>
              </select>
            </div>

            <button
              onClick={generatePDFReport}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              <span>{isGenerating ? "Generating Statement..." : "Generate Official Statement"}</span>
            </button>
          </div>
        </div>

        {/* Live Preview / Stats */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col">
          <h3 className="font-bold mb-6 dark:text-white flex items-center text-lg"><FileBarChart size={20} className="mr-2 text-emerald-500" /> Payment Analysis</h3>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {stats.length > 0 ? stats.map((stat, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${stat.amount >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{stat.method}</span>
                </div>
                <span className={`font-bold font-mono ${stat.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {stat.amount >= 0 ? '+' : ''} ₹{stat.amount.toLocaleString()}
                </span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <FileBarChart size={40} className="mb-2 opacity-50" />
                <p>No data available for this period.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-slate-500">Total Volume</span>
              <span className="font-bold text-slate-800 dark:text-white">
                ₹{stats.reduce((acc, curr) => acc + Math.abs(curr.amount), 0).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">Showing Net Flow (Income - Expense)</p>
          </div>
        </div>
      </div>
    </div>
  );
};