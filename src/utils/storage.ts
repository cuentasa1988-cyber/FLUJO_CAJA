import { 
  AppSettings, 
  DailyClosure, 
  Payable, 
  Receivable,
  Transaction, 
  ProjectionScenario,
  DatePeriodFilter 
} from '../types';
import { getDefaultPeriodFilter } from './dateFilter';
import { getLocalDateString } from './financial';

const STORAGE_KEYS = {
  SETTINGS: 'cashflow_settings_v1',
  TRANSACTIONS: 'cashflow_transactions_v1',
  PAYABLES: 'cashflow_payables_v1',
  RECEIVABLES: 'cashflow_receivables_v1',
  CLOSURES: 'cashflow_closures_v1',
  SCENARIO: 'cashflow_scenario_v1',
  PERIOD_FILTER: 'cashflow_period_filter_v1',
};

export const defaultSettings: AppSettings = {
  currency: 'CLP',
  currencySymbol: '$',
  businessName: 'Control Center - Cash Management',
  startingBankBalance: 320000,
  startingCashDrawer: 125000,
  feeConfig: {
    debitRate: 1.53,
    prepaidRate: 1.71,
    creditRate: 1.89,
    deliveryAppRate: 15.0,
    stripeFixedFee: 0,
  },
  pocketConfig: {
    profit: 5,
    taxes: 10,
    ownerPay: 35,
    opEx: 50,
    reserveMonthsTarget: 3,
  },
  partners: [
    { id: 'partner-1', name: 'Socio Principal / Fundador', equityPct: 60, role: 'Socio Operador' },
    { id: 'partner-2', name: 'Socio Co-Fundador', equityPct: 40, role: 'Socio Capitalista' },
  ],
  targetOperatingMarginPct: 25,
};

export const defaultScenario: ProjectionScenario = {
  id: 'base_case',
  name: 'Base Case',
  ticketAverage: 15000,
  monthlySalesUnits: 160, // 160 ventas/clientes x $15.000 = $2.400.000 de ventas base
  salesVolumeMoMGrowth: 5.0,
  variableCostRatio: 42.0,
  fixedMonthlyCosts: 1800000,
  horizonMonths: 12,
  whatIfEvents: [
    {
      id: 'wi-1',
      name: 'Contratación de 1 colaborador (+Sueldo)',
      type: 'recurring_expense',
      amountOrPct: 800000,
      startMonthIndex: 2, // Mes 3 en adelante
      enabled: false,
      description: 'Aumento recurrente en costo de nómina mensual (+ $800.000 / mes)',
    },
    {
      id: 'wi-2',
      name: 'Caída de Ventas Estacional (Invierno / Vacaciones)',
      type: 'revenue_change_pct',
      amountOrPct: -20,
      startMonthIndex: 4, // Mes 5
      endMonthIndex: 6, // Mes 7
      enabled: false,
      description: 'Reducción del 20% en ingresos durante los meses fríos o de baja demanda',
    },
    {
      id: 'wi-3',
      name: 'Compra de Maquinaria / Inversión CAPEX',
      type: 'one_time_capex',
      amountOrPct: 3000000,
      startMonthIndex: 2, // Mes 3
      enabled: false,
      description: 'Desembolso único de capital para equipamiento o renovación técnica',
    },
  ],
};

function getDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

export const initialTransactions: Transaction[] = [
  {
    id: 'tx-001',
    type: 'income',
    date: getDateOffset(0),
    time: '14:15',
    concept: 'Table 4 - Lunch Service',
    paymentMethod: 'credit_card',
    grossAmount: 145.50,
    feeAmount: 4.52,
    netAmount: 140.98,
    pocketAllocation: { profit: 7.05, taxes: 14.10, ownerPay: 49.34, opEx: 70.49 },
  },
  {
    id: 'tx-002',
    type: 'income',
    date: getDateOffset(0),
    time: '13:50',
    concept: 'UberEats #8992',
    paymentMethod: 'delivery_app',
    grossAmount: 42.00,
    feeAmount: 12.60,
    netAmount: 29.40,
    pocketAllocation: { profit: 1.47, taxes: 2.94, ownerPay: 10.29, opEx: 14.70 },
  },
  {
    id: 'tx-003',
    type: 'income',
    date: getDateOffset(0),
    time: '13:30',
    concept: 'Table 2 - Drinks',
    paymentMethod: 'cash',
    grossAmount: 18.00,
    feeAmount: 0.00,
    netAmount: 18.00,
    pocketAllocation: { profit: 0.90, taxes: 1.80, ownerPay: 6.30, opEx: 9.00 },
  },
  {
    id: 'tx-004',
    type: 'expense',
    date: getDateOffset(0),
    time: '12:00',
    concept: 'Supplies Delivery',
    category: 'raw_materials',
    outflowMethod: 'cash_drawer',
    grossAmount: 120.00,
    feeAmount: 0,
    netAmount: 120.00,
  },
  {
    id: 'tx-005',
    type: 'income',
    date: getDateOffset(-2),
    time: '10:00',
    concept: 'Stripe Payout',
    paymentMethod: 'bank_transfer',
    grossAmount: 8450.00,
    feeAmount: 0,
    netAmount: 8450.00,
    pocketAllocation: { profit: 422.50, taxes: 845.00, ownerPay: 2957.50, opEx: 4225.00 },
  },
  {
    id: 'tx-006',
    type: 'expense',
    date: getDateOffset(-3),
    time: '16:30',
    concept: 'Gusto Payroll',
    category: 'payroll_daily',
    outflowMethod: 'bank_transfer',
    grossAmount: 12300.00,
    feeAmount: 0,
    netAmount: 12300.00,
  },
  {
    id: 'tx-007',
    type: 'expense',
    date: getDateOffset(-5),
    time: '11:15',
    concept: 'FedEx Logistics',
    category: 'minor_expenses',
    outflowMethod: 'bank_transfer',
    grossAmount: 450.00,
    feeAmount: 0,
    netAmount: 450.00,
  },
  {
    id: 'tx-008',
    type: 'income',
    date: getDateOffset(0),
    time: '11:00',
    concept: 'Corporate Event Deposit',
    paymentMethod: 'debit_card',
    grossAmount: 2500.00,
    feeAmount: 38.25,
    netAmount: 2461.75,
    pocketAllocation: { profit: 123.09, taxes: 246.18, ownerPay: 861.61, opEx: 1230.87 },
  },
  {
    id: 'tx-009',
    type: 'income',
    date: getDateOffset(0),
    time: '15:20',
    concept: 'Catering Order #104',
    paymentMethod: 'prepaid_card',
    grossAmount: 1814.50,
    feeAmount: 31.03,
    netAmount: 1783.47,
    pocketAllocation: { profit: 89.17, taxes: 178.35, ownerPay: 624.21, opEx: 891.74 },
  },
  {
    id: 'tx-010',
    type: 'expense',
    date: getDateOffset(0),
    time: '17:00',
    concept: 'Daily Staff Shift Bonus',
    category: 'payroll_daily',
    outflowMethod: 'cash_drawer',
    grossAmount: 225.50,
    feeAmount: 0,
    netAmount: 225.50,
  },
];

export const initialPayables: Payable[] = [
  {
    id: 'pay-001',
    vendor: 'Acme Heavy Machinery',
    concept: 'Excavator Installment 4/12',
    totalAmount: 120000,
    remainingAmount: 80000,
    installmentCount: 12,
    currentInstallment: 4,
    dueDate: getDateOffset(-7),
    status: 'pending',
    category: 'raw_materials',
    autoDeductInProjection: true,
  },
  {
    id: 'pay-002',
    vendor: 'Downtown Office Park',
    concept: 'Q4 Rent Advance',
    totalAmount: 45000,
    remainingAmount: 45000,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(-14),
    status: 'overdue',
    category: 'rent',
    autoDeductInProjection: true,
  },
  {
    id: 'pay-003',
    vendor: 'Global Tech Suppliers',
    concept: 'Server Hardware Net-30',
    totalAmount: 18500,
    remainingAmount: 0,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(-20),
    status: 'paid',
    category: 'software_services',
    autoDeductInProjection: false,
  },
  {
    id: 'pay-004',
    vendor: 'Cloud Services Inc.',
    concept: 'Annual Enterprise License',
    totalAmount: 24000,
    remainingAmount: 24000,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(10),
    status: 'pending',
    category: 'software_services',
    autoDeductInProjection: true,
  },
  {
    id: 'pay-005',
    vendor: 'AWS Hosting',
    concept: 'Cloud Infrastructure Oct',
    totalAmount: 1250,
    remainingAmount: 1250,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(2),
    status: 'pending',
    category: 'software_services',
    autoDeductInProjection: true,
  },
  {
    id: 'pay-006',
    vendor: 'Office Lease',
    concept: 'Monthly Facility Fee',
    totalAmount: 4500,
    remainingAmount: 4500,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(4),
    status: 'pending',
    category: 'rent',
    autoDeductInProjection: true,
  },
  {
    id: 'pay-007',
    vendor: 'Marketing Agency',
    concept: 'Growth Retainer Q4',
    totalAmount: 3000,
    remainingAmount: 3000,
    installmentCount: 1,
    currentInstallment: 1,
    dueDate: getDateOffset(6),
    status: 'overdue',
    category: 'marketing',
    autoDeductInProjection: true,
  },
];

export const initialReceivables: Receivable[] = [
  {
    id: 'rec-001',
    clientName: 'Restaurante Los Robles SpA',
    concept: 'Venta insumos / Pedido corporativo',
    totalAmount: 350000,
    remainingAmount: 350000,
    dueDate: getDateOffset(4),
    issueDate: getDateOffset(-10),
    status: 'pending',
    docType: 'factura',
    docNumber: 'F-1048',
    paymentMethodExpected: 'bank_transfer',
    hasFactura: true,
    notes: 'Pago prometido a 15 días tras recepción de factura.',
  },
  {
    id: 'rec-002',
    clientName: 'Comercial del Valle Ltda',
    concept: 'Servicio técnico y mantenimiento mensual',
    totalAmount: 180000,
    remainingAmount: 80000,
    dueDate: getDateOffset(12),
    issueDate: getDateOffset(-15),
    status: 'partial',
    docType: 'factura',
    docNumber: 'F-1035',
    paymentMethodExpected: 'bank_transfer',
    hasFactura: true,
    notes: 'Abonaron $100.000, saldo restante comprometido para próxima semana.',
    paymentHistory: [
      {
        date: getDateOffset(-2),
        amount: 100000,
        destinationMethod: 'bank_transfer',
        reference: 'Transf. 98124',
      }
    ],
  },
  {
    id: 'rec-003',
    clientName: 'Café & Panadería Central',
    concept: 'Pedido mercadería semanal',
    totalAmount: 75000,
    remainingAmount: 75000,
    dueDate: getDateOffset(18),
    issueDate: getDateOffset(-3),
    status: 'pending',
    docType: 'boleta',
    docNumber: 'B-4521',
    paymentMethodExpected: 'bank_transfer',
    hasFactura: false,
    notes: 'Crédito semanal habitual.',
  },
];

export const initialClosures: DailyClosure[] = [
  {
    id: 'close-001',
    date: getDateOffset(-1),
    shift: 'Shift 1',
    openingCash: 1200,
    cashSales: 650,
    cashExpenses: 100,
    systemExpectedCash: 1750,
    countedCash: 1750,
    variance: 0,
    denominations: { b100: 10, b50: 10, b20: 10, b10: 4, b5: 2, b1: 0, coins: 0 },
    closedAt: `${getDateOffset(-1)} 21:00`,
    closedBy: 'Manager',
  }
];

export const storage = {
  isCleanMode: (): boolean => {
    try {
      const stored = localStorage.getItem('cashflow_empty_state_v1');
      // If explicitly set to 'false', it means demo data is active.
      // Otherwise, default to true (clean mode) so no unregistered data ever displays.
      return stored !== 'false';
    } catch {
      return true;
    }
  },

  getSettings: (): AppSettings => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
      if (storage.isCleanMode()) {
        return { ...defaultSettings, startingBankBalance: 0, startingCashDrawer: 0 };
      }
      return defaultSettings;
    } catch {
      return defaultSettings;
    }
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getTransactions: (): Transaction[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) {
        const rawList: Transaction[] = JSON.parse(data);
        const seenIds = new Set<string>();
        const seenLinked = new Set<string>();
        const cleanList: Transaction[] = [];

        for (const tx of rawList) {
          if (!tx.id || seenIds.has(tx.id)) continue;
          
          if (tx.linkedReceivableId) {
            const key = `${tx.linkedReceivableId}_${tx.grossAmount || tx.netAmount}_${tx.date}`;
            if (seenLinked.has(key)) continue;
            seenLinked.add(key);
          }

          seenIds.add(tx.id);
          cleanList.push(tx);
        }
        if (cleanList.length > 0) {
          return cleanList;
        }
      }

      // Check emergency backup key before concluding empty
      const backupData = localStorage.getItem('cashflow_transactions_backup_v1') || localStorage.getItem('cashflow_transactions_backup');
      if (backupData) {
        try {
          const backupList: Transaction[] = JSON.parse(backupData);
          if (Array.isArray(backupList) && backupList.length > 0) {
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, backupData);
            return backupList;
          }
        } catch {}
      }

      // Check legacy keys
      const legacyKeys = ['cashflow_transactions', 'transactions_backup', 'transactions'];
      for (const k of legacyKeys) {
        const leg = localStorage.getItem(k);
        if (leg) {
          try {
            const parsed = JSON.parse(leg);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, leg);
              return parsed;
            }
          } catch {}
        }
      }

      if (storage.isCleanMode()) {
        return [];
      }
      return initialTransactions;
    } catch {
      return storage.isCleanMode() ? [] : initialTransactions;
    }
  },
  saveTransactions: (txs: Transaction[]) => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
    if (Array.isArray(txs) && txs.length > 0) {
      try {
        localStorage.setItem('cashflow_transactions_backup_v1', JSON.stringify(txs));
      } catch {}
    }
  },

  getPayables: (): Payable[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PAYABLES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      const backupData = localStorage.getItem('cashflow_payables_backup_v1') || localStorage.getItem('cashflow_payables_backup');
      if (backupData) {
        try {
          const backupList: Payable[] = JSON.parse(backupData);
          if (Array.isArray(backupList) && backupList.length > 0) {
            localStorage.setItem(STORAGE_KEYS.PAYABLES, backupData);
            return backupList;
          }
        } catch {}
      }

      if (storage.isCleanMode()) return [];
      return initialPayables;
    } catch {
      return storage.isCleanMode() ? [] : initialPayables;
    }
  },
  savePayables: (payables: Payable[]) => {
    localStorage.setItem(STORAGE_KEYS.PAYABLES, JSON.stringify(payables));
    if (Array.isArray(payables) && payables.length > 0) {
      try {
        localStorage.setItem('cashflow_payables_backup_v1', JSON.stringify(payables));
      } catch {}
    }
  },

  getReceivables: (): Receivable[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECEIVABLES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      const backupData = localStorage.getItem('cashflow_receivables_backup_v1') || localStorage.getItem('cashflow_receivables_backup');
      if (backupData) {
        try {
          const backupList: Receivable[] = JSON.parse(backupData);
          if (Array.isArray(backupList) && backupList.length > 0) {
            localStorage.setItem(STORAGE_KEYS.RECEIVABLES, backupData);
            return backupList;
          }
        } catch {}
      }

      if (storage.isCleanMode()) return [];
      return initialReceivables;
    } catch {
      return storage.isCleanMode() ? [] : initialReceivables;
    }
  },
  saveReceivables: (receivables: Receivable[]) => {
    localStorage.setItem(STORAGE_KEYS.RECEIVABLES, JSON.stringify(receivables));
    if (Array.isArray(receivables) && receivables.length > 0) {
      try {
        localStorage.setItem('cashflow_receivables_backup_v1', JSON.stringify(receivables));
      } catch {}
    }
  },

  getClosures: (): DailyClosure[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLOSURES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      const backupData = localStorage.getItem('cashflow_closures_backup_v1');
      if (backupData) {
        try {
          const backupList: DailyClosure[] = JSON.parse(backupData);
          if (Array.isArray(backupList) && backupList.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CLOSURES, backupData);
            return backupList;
          }
        } catch {}
      }

      if (storage.isCleanMode()) return [];
      return initialClosures;
    } catch {
      return storage.isCleanMode() ? [] : initialClosures;
    }
  },
  saveClosures: (closures: DailyClosure[]) => {
    localStorage.setItem(STORAGE_KEYS.CLOSURES, JSON.stringify(closures));
    if (Array.isArray(closures) && closures.length > 0) {
      try {
        localStorage.setItem('cashflow_closures_backup_v1', JSON.stringify(closures));
      } catch {}
    }
  },

  getScenario: (): ProjectionScenario => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCENARIO);
      if (data) return JSON.parse(data);
      if (storage.isCleanMode()) {
        return {
          ...defaultScenario,
          fixedMonthlyCosts: 0,
          ticketAverage: 0,
          monthlySalesUnits: 0,
          variableCostRatio: 0,
        };
      }
      return defaultScenario;
    } catch {
      return defaultScenario;
    }
  },
  saveScenario: (scenario: ProjectionScenario) => {
    localStorage.setItem(STORAGE_KEYS.SCENARIO, JSON.stringify(scenario));
  },

  getPeriodFilter: (): DatePeriodFilter => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PERIOD_FILTER) || localStorage.getItem('cashflow_period_filter');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.mode) {
          return parsed;
        }
      }
      return getDefaultPeriodFilter();
    } catch {
      return getDefaultPeriodFilter();
    }
  },
  savePeriodFilter: (filter: DatePeriodFilter) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PERIOD_FILTER, JSON.stringify(filter));
      localStorage.setItem('cashflow_period_filter', JSON.stringify(filter));
    } catch {
      // ignore
    }
  },

  clearAllData: (customBalances?: { bank?: number; cashDrawer?: number; businessName?: string }) => {
    try {
      // Mark clean mode permanently to stop initial demo datasets from resurfacing
      localStorage.setItem('cashflow_empty_state_v1', 'true');
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYABLES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECEIVABLES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.CLOSURES, JSON.stringify([]));

      // Remove all legacy and backup keys to prevent revival of old datasets
      const keysToRemove = [
        'cashflow_transactions',
        'transactions_backup',
        'transactions',
        'cashflow_transactions_backup_v1',
        'cashflow_payables_backup_v1',
        'cashflow_payables_backup',
        'cashflow_receivables_backup_v1',
        'cashflow_receivables_backup',
        'cashflow_closures_backup_v1',
        'cashflow_period_filter'
      ];
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }

      let currentSettings = defaultSettings;
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) currentSettings = JSON.parse(stored);
      } catch {}

      const cleanSettings: AppSettings = {
        ...currentSettings,
        businessName: customBalances?.businessName || currentSettings.businessName || 'Mi Empresa',
        startingBankBalance: customBalances?.bank ?? 0,
        startingCashDrawer: customBalances?.cashDrawer ?? 0,
        partners: currentSettings.partners && currentSettings.partners.length > 0
          ? currentSettings.partners
          : [{ id: 'partner-1', name: 'Socio Principal / Dueño', equityPct: 100, role: 'Socio Fundador' }],
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cleanSettings));

      const cleanScenario: ProjectionScenario = {
        ...defaultScenario,
        ticketAverage: 0,
        monthlySalesUnits: 0,
        fixedMonthlyCosts: 0,
        variableCostRatio: 0,
        whatIfEvents: defaultScenario.whatIfEvents.map(we => ({ ...we, enabled: false })),
      };
      localStorage.setItem(STORAGE_KEYS.SCENARIO, JSON.stringify(cleanScenario));

      const defaultPeriod = getDefaultPeriodFilter();
      localStorage.setItem(STORAGE_KEYS.PERIOD_FILTER, JSON.stringify(defaultPeriod));
      localStorage.setItem('cashflow_period_filter', JSON.stringify(defaultPeriod));

      return {
        settings: cleanSettings,
        scenario: cleanScenario,
        periodFilter: defaultPeriod,
      };
    } catch (e) {
      console.error('Error clearing all data:', e);
      const fallbackSettings = { ...defaultSettings, startingBankBalance: 0, startingCashDrawer: 0 };
      const fallbackScenario = { ...defaultScenario, fixedMonthlyCosts: 0, ticketAverage: 0 };
      const fallbackPeriod = getDefaultPeriodFilter();
      return {
        settings: fallbackSettings,
        scenario: fallbackScenario,
        periodFilter: fallbackPeriod,
      };
    }
  },

  resetToDemoData: () => {
    try {
      localStorage.setItem('cashflow_empty_state_v1', 'false');
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(initialTransactions));
      localStorage.setItem(STORAGE_KEYS.PAYABLES, JSON.stringify(initialPayables));
      localStorage.setItem(STORAGE_KEYS.RECEIVABLES, JSON.stringify(initialReceivables));
      localStorage.setItem(STORAGE_KEYS.CLOSURES, JSON.stringify(initialClosures));
      localStorage.setItem(STORAGE_KEYS.SCENARIO, JSON.stringify(defaultScenario));
      const defaultPeriod = getDefaultPeriodFilter();
      localStorage.setItem(STORAGE_KEYS.PERIOD_FILTER, JSON.stringify(defaultPeriod));
      localStorage.setItem('cashflow_period_filter', JSON.stringify(defaultPeriod));
      return {
        settings: defaultSettings,
        transactions: initialTransactions,
        payables: initialPayables,
        receivables: initialReceivables,
        closures: initialClosures,
        scenario: defaultScenario,
        periodFilter: defaultPeriod,
      };
    } catch (e) {
      console.error('Error restoring demo data:', e);
    }
  }
};
