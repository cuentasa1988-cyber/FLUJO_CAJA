export type TabType = 'dashboard' | 'registry' | 'payables' | 'distribution' | 'financial_statements' | 'cashflow30' | 'projections';

export type PeriodMode = 'day' | 'day_range' | 'month' | 'month_range' | 'all';

export interface DatePeriodFilter {
  mode: PeriodMode;
  selectedDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  selectedMonth: string; // YYYY-MM
  startMonth: string; // YYYY-MM
  endMonth: string; // YYYY-MM
}

export type PaymentChannel = 
  | 'cash' 
  | 'debit_card' 
  | 'prepaid_card' 
  | 'credit_card' 
  | 'delivery_app' 
  | 'bank_transfer';

export type ExpenseCategory = 
  // 1. Costos Directos (Variables)
  | 'raw_materials' 
  | 'packaging'
  | 'shipping'
  // 2. Gastos Operativos (Fijos / OPEX)
  | 'rent'
  | 'utilities'
  | 'payroll_daily'
  | 'software_services'
  | 'accounting_legal'
  | 'minor_expenses'
  | 'marketing'
  | 'other_expense'
  // 3. Impuestos y Leyes Sociales
  | 'taxes_sii'
  | 'taxes_previred'
  // 4. Inversiones (CAPEX)
  | 'capex_machinery'
  // Others
  | 'owner_draw'
  | 'profit_distribution'
  | 'tax_reserve';

export type OutflowMethod = 'cash_drawer' | 'bank_transfer';

export type PayableStatus = 'pending' | 'overdue' | 'paid' | 'partial';
export type ReceivableStatus = 'pending' | 'overdue' | 'collected' | 'partial';

export interface FeeConfig {
  debitRate: number; // e.g. 1.53%
  prepaidRate: number; // e.g. 1.71%
  creditRate: number; // e.g. 1.89%
  deliveryAppRate: number; // e.g. 15.0%
  stripeFixedFee: number; // e.g. 0.30
}

export interface PocketConfig {
  profit: number; // e.g. 5% or 10%
  taxes: number; // e.g. 10% or 15%
  ownerPay: number; // e.g. 35%
  opEx: number; // e.g. 50% or 40%
  reserveMonthsTarget: number; // e.g. 3 months
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal';
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  concept: string;
  category?: ExpenseCategory;
  paymentMethod?: PaymentChannel;
  outflowMethod?: OutflowMethod;
  docType?: 'boleta' | 'factura' | 'honorarios' | 'sin_doc'; // Boleta, Factura, Honorarios, Sin documento
  docNumber?: string; // N° Folio / Factura / Boleta opcional
  hasFactura?: boolean; // Backwards-compatible flag for VAT (IVA) calculation
  ivaAmount?: number; // 19% IVA Débito (recaudado en ventas) or IVA Crédito (recuperable en compras)
  netCostAmount?: number; // Costo neto sin IVA (para compras con factura = bruto / 1.19)
  taxRetentionRate?: number; // % Retención legal (ej. 15.25% honorarios SII - Ley 21.133)
  taxRetentionAmount?: number; // Monto retenido para enterar al SII en F29
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  notes?: string;
  linkedReceivableId?: string; // ID of the receivable if this income came from collecting a credit sale
  linkedPayableId?: string; // ID of the payable if this expense came from paying a commitment
  pocketAllocation?: {
    profit: number;
    taxes: number;
    ownerPay: number;
    opEx: number;
  };
}

export interface Payable {
  id: string;
  vendor: string;
  concept: string;
  totalAmount: number;
  remainingAmount: number;
  installmentCount: number;
  currentInstallment: number;
  dueDate: string; // YYYY-MM-DD
  status: PayableStatus;
  category: ExpenseCategory;
  autoDeductInProjection: boolean;
  hasFactura?: boolean;
  docType?: 'boleta' | 'factura' | 'honorarios' | 'sin_doc';
  docNumber?: string;
  notes?: string;
  paymentHistory?: {
    id?: string;
    date: string;
    amount: number;
    outflowMethod: OutflowMethod;
  }[];
}

export interface Receivable {
  id: string;
  clientName: string;
  concept: string;
  totalAmount: number;
  remainingAmount: number;
  installmentCount?: number;
  currentInstallment?: number;
  dueDate: string; // YYYY-MM-DD
  issueDate: string; // YYYY-MM-DD
  status: ReceivableStatus;
  docType?: 'boleta' | 'factura' | 'nota_credito' | 'sin_doc';
  docNumber?: string;
  paymentMethodExpected?: PaymentChannel;
  hasFactura?: boolean;
  notes?: string;
  paymentHistory?: {
    id?: string;
    date: string;
    amount: number;
    destinationMethod: OutflowMethod;
    reference?: string;
  }[];
}

export interface CashDenominations {
  // USD
  b100?: number;
  b50?: number;
  b20?: number;
  b10?: number;
  b5?: number;
  b1?: number;
  // CLP
  b20000?: number;
  b10000?: number;
  b5000?: number;
  b2000?: number;
  b1000?: number;
  c500?: number;
  c100?: number;
  c50?: number;
  c10?: number;
  // Shared
  coins?: number;
}

export interface DailyClosure {
  id: string;
  date: string;
  shift: string;
  openingCash: number;
  cashSales: number;
  cashExpenses: number;
  systemExpectedCash: number;
  countedCash: number;
  variance: number;
  denominations: CashDenominations;
  closedAt: string;
  closedBy: string;
  notes?: string;
}

export interface WhatIfEvent {
  id: string;
  name: string;
  type: 'recurring_expense' | 'one_time_capex' | 'revenue_change_pct' | 'one_time_income';
  amountOrPct: number; // e.g. 800000 (amount) or -20 (percentage)
  startMonthIndex: number; // 0 = first month, 1 = second month, etc.
  endMonthIndex?: number; // for temporary events like seasonal drop in months 4-6
  enabled: boolean;
  description?: string;
}

export interface ProjectionMonth {
  monthKey: string; // e.g. "2023-10"
  label: string; // e.g. "Oct 2023"
  isProjected: boolean;
  estGrossIncome: number;
  estNetIncome: number;
  cogs: number;
  marketing: number;
  payroll: number;
  rentAndUtil: number;
  otherFixed: number;
  scheduledPayables: number;
  whatIfImpactIncome: number;
  whatIfImpactExpense: number;
  totalVariable: number;
  totalFixed: number;
  totalCosts: number;
  netMonthly: number;
  cumulativeCash: number;
}

export interface ProjectionScenario {
  id: string;
  name: string;
  ticketAverage: number;
  monthlySalesUnits?: number; // estimated number of sales/clients per month
  salesVolumeMoMGrowth: number; // percentage, e.g. 5%
  variableCostRatio: number; // percentage of revenue, e.g. 40%
  fixedMonthlyCosts: number; // base fixed costs
  horizonMonths: 3 | 6 | 12 | 24;
  whatIfEvents?: WhatIfEvent[];
}

export interface Partner {
  id: string;
  name: string;
  rutOrId?: string; // RUT / Tax ID / DNI
  equityPct: number; // % Ownership/Participation (e.g. 50%, 30%, 20%)
  role?: string; // e.g. "Socio Operador", "Socio Capitalista", "Fundador"
}

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  businessName: string;
  startingBankBalance: number;
  startingCashDrawer: number;
  feeConfig: FeeConfig;
  pocketConfig: PocketConfig;
  partners?: Partner[]; // List of company partners with their equity %
  targetOperatingMarginPct?: number; // Target operating margin % (e.g. 20%)
}
