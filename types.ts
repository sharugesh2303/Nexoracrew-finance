
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum PaymentMethod {
  CASH = 'CASH',
  GPAY = 'GPAY',
  PHONEPE = 'PHONEPE',
  PAYTM = 'PAYTM',
  FAMPAY = 'FAMPAY',
  CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  position: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  holderName: string;
  cardNumber: string;
  expiryDate: string;
  cardType: 'DEBIT' | 'CREDIT';
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  bankName?: string;
  description: string;
  attachment?: string;
  createdAt: string;
  // New Fields for Team Investment
  investmentType?: 'SINGLE' | 'TEAM'; 
  investors?: string[]; 
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  todayIncome: number;
  todayExpense: number;
  monthIncome: number;
  monthExpense: number;
  yearIncome: number;
  yearExpense: number;
}
