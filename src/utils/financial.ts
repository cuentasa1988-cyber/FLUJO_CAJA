import { 
  AppSettings, 
  FeeConfig, 
  PaymentChannel, 
  PocketConfig, 
  Transaction, 
  Payable, 
  ProjectionScenario, 
  ProjectionMonth 
} from '../types';

// Helper to check CLP and apply rounding
export function isCLPActive(): boolean {
  try {
    const settingsStr = localStorage.getItem('cashflow_settings_v1');
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      return settings.currency === 'CLP';
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

export function applyCurrencyRules(amount: number): number {
  if (isCLPActive()) {
    return Math.round(amount);
  }
  return Number(amount.toFixed(2));
}

/**
 * Calculates fee and net amount for a transaction based on channel
 */
export function calculatePaymentFee(
  grossAmount: number, 
  channel: PaymentChannel, 
  feeConfig: FeeConfig
): { fee: number; net: number } {
  if (grossAmount <= 0) return { fee: 0, net: 0 };

  let feeRate = 0;
  let fixedFee = 0;

  switch (channel) {
    case 'debit_card':
      feeRate = feeConfig.debitRate / 100;
      break;
    case 'prepaid_card':
      feeRate = feeConfig.prepaidRate / 100;
      break;
    case 'credit_card':
      feeRate = feeConfig.creditRate / 100;
      break;
    case 'delivery_app':
      feeRate = feeConfig.deliveryAppRate / 100;
      break;
    case 'cash':
    case 'bank_transfer':
    default:
      feeRate = 0;
      break;
  }

  const rawFee = grossAmount * feeRate + fixedFee;
  const rawNet = grossAmount - rawFee;
  
  return { 
    fee: applyCurrencyRules(rawFee), 
    net: applyCurrencyRules(rawNet) 
  };
}

/**
 * Calculates 4 Pockets allocation for a given net income
 */
export function calculatePocketAllocation(netAmount: number, config: PocketConfig) {
  return { 
    profit: applyCurrencyRules(netAmount * (config.profit / 100)), 
    taxes: applyCurrencyRules(netAmount * (config.taxes / 100)), 
    ownerPay: applyCurrencyRules(netAmount * (config.ownerPay / 100)), 
    opEx: applyCurrencyRules(netAmount * (config.opEx / 100)) 
  };
}

/**
 * Format currency utility with support for decimals
 */
export function formatCurrency(amount: number, symbol: string = '$', decimals: number = 2): string {
  const isCLP = isCLPActive();

  // Force CLP rules if active
  const activeDecimals = isCLP ? 0 : decimals;
  const targetAmount = isCLP ? Math.round(amount) : amount;
  
  const isNegative = targetAmount < 0;
  const absVal = Math.abs(targetAmount);
  
  let formatted = '';
  if (isCLP) {
    // Bulletproof manual formatting for CLP (es-CL) to ensure dots for thousands,
    // overriding any weird browser locale overrides that might force commas.
    formatted = absVal.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).replace(/,/g, '.');
  } else {
    formatted = absVal.toLocaleString('en-US', {
      minimumFractionDigits: activeDecimals,
      maximumFractionDigits: activeDecimals,
    });
  }

  if (isNegative) {
    return `-${symbol}${formatted}`;
  }
  return `${symbol}${formatted}`;
}

/**
 * Get current liquid cash (Bank balance + Cash in Drawer)
 */
export function calculateCurrentLiquidity(
  settings: AppSettings, 
  transactions: Transaction[], 
  payables: Payable[]
) {
  let bank = settings.startingBankBalance;
  let cashDrawer = settings.startingCashDrawer;

  // Process all historical transactions
  for (const tx of transactions) {
    if (tx.type === 'income') {
      if (tx.paymentMethod === 'cash') {
        cashDrawer += tx.netAmount;
      } else {
        bank += tx.netAmount;
      }
    } else if (tx.type === 'expense') {
      if (tx.outflowMethod === 'cash_drawer') {
        cashDrawer -= tx.grossAmount;
      } else {
        bank -= tx.grossAmount;
      }
    } else if (tx.type === 'capital_contribution') {
      if (tx.paymentMethod === 'cash' || tx.outflowMethod === 'cash_drawer') {
        cashDrawer += (tx.netAmount || tx.grossAmount);
      } else {
        bank += (tx.netAmount || tx.grossAmount);
      }
    } else if (tx.type === 'partner_withdrawal') {
      if (tx.outflowMethod === 'cash_drawer' || tx.paymentMethod === 'cash') {
        cashDrawer -= tx.grossAmount;
      } else {
        bank -= tx.grossAmount;
      }
    }
  }

  const totalLiquidity = bank + cashDrawer;
  return { bank, cashDrawer, totalLiquidity };
}

/**
 * Computes Daily KPIs for a given target date
 */
export function calculateDailyMetrics(
  targetDate: string, 
  transactions: Transaction[], 
  startingCashDrawer: number
) {
  const dayTxs = transactions.filter(t => t.date === targetDate);

  let grossRevenue = 0;
  let netRevenue = 0;
  let processingFees = 0;
  let dailyExpenses = 0;
  let cashSales = 0;
  let cashExpenses = 0;

  for (const tx of dayTxs) {
    if (tx.type === 'income') {
      grossRevenue += tx.grossAmount;
      netRevenue += tx.netAmount;
      processingFees += tx.feeAmount;
      if (tx.paymentMethod === 'cash') {
        cashSales += tx.netAmount;
      }
    } else if (tx.type === 'expense') {
      dailyExpenses += tx.grossAmount;
      if (tx.outflowMethod === 'cash_drawer') {
        cashExpenses += tx.grossAmount;
      }
    } else if (tx.type === 'capital_contribution') {
      if (tx.paymentMethod === 'cash' || tx.outflowMethod === 'cash_drawer') {
        cashSales += (tx.netAmount || tx.grossAmount);
      }
    } else if (tx.type === 'partner_withdrawal') {
      if (tx.outflowMethod === 'cash_drawer' || tx.paymentMethod === 'cash') {
        cashExpenses += tx.grossAmount;
      }
    }
  }

  const expectedCashDrawer = startingCashDrawer + cashSales - cashExpenses;

  return {
    dayTransactions: dayTxs,
    grossRevenue,
    netRevenue,
    processingFees,
    dailyExpenses,
    cashSales,
    cashExpenses,
    expectedCashDrawer,
  };
}

/**
 * Computes Payables metrics
 */
export function calculatePayablesMetrics(payables: Payable[], currentCash: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let totalOutstanding = 0;
  let dueIn30Days = 0; // Mes Actual / Vencidos
  let due30To60Days = 0; // Próximo Mes (+30D)
  let duePost60Days = 0; // 60-90 Días o más

  for (const p of payables) {
    if (p.status !== 'paid' && p.remainingAmount > 0) {
      totalOutstanding += p.remainingAmount;
      
      const [pYear, pMonth] = (p.dueDate || '').split('-').map(Number);
      
      if (!pYear || !pMonth) {
        dueIn30Days += p.remainingAmount;
        continue;
      }

      // Difference in calendar months from current month
      const monthDiff = (pYear - currentYear) * 12 + (pMonth - 1 - currentMonth);

      if (monthDiff <= 0) {
        // Due in current month or overdue
        dueIn30Days += p.remainingAmount;
      } else if (monthDiff === 1) {
        // Due next month
        due30To60Days += p.remainingAmount;
      } else {
        // Due 60+ days out
        duePost60Days += p.remainingAmount;
      }
    }
  }

  const post30DLiquidity = currentCash - dueIn30Days;
  const post30DCommitments = totalOutstanding - dueIn30Days;
  const isFullyFunded = currentCash >= dueIn30Days;

  return {
    totalOutstanding,
    dueIn30Days,
    due30To60Days,
    duePost60Days,
    post30DLiquidity,
    post30DCommitments,
    isFullyFunded,
  };
}

/**
 * Computes 4 Pockets actual spend vs theoretical target
 */
export function calculatePocketsActualVsTarget(
  transactions: Transaction[], 
  config: PocketConfig
) {
  let totalNetRevenue = 0;
  let actualOpExSpend = 0;
  let actualOwnerDraw = 0;
  let actualTaxPaid = 0;
  let actualProfitDistributed = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalNetRevenue += tx.netAmount;
    } else if (tx.type === 'expense') {
      if (tx.category === 'owner_draw') {
        actualOwnerDraw += tx.grossAmount;
      } else if (tx.category === 'taxes_sii' || tx.category === 'taxes_previred' || tx.category === 'tax_reserve') {
        actualTaxPaid += tx.grossAmount;
      } else if (tx.category === 'profit_distribution') {
        actualProfitDistributed += tx.grossAmount;
      } else {
        // All other categories are operational expenses
        actualOpExSpend += tx.grossAmount;
      }
    }
  }

  const theoreticalProfit = totalNetRevenue * (config.profit / 100);
  const theoreticalOwner = totalNetRevenue * (config.ownerPay / 100);
  const theoreticalTaxes = totalNetRevenue * (config.taxes / 100);
  const theoreticalOpEx = totalNetRevenue * (config.opEx / 100);

  // Percentages actual of total revenue
  const actualProfitPct = totalNetRevenue > 0 ? (actualProfitDistributed / totalNetRevenue) * 100 : 0;
  const actualOwnerPct = totalNetRevenue > 0 ? (actualOwnerDraw / totalNetRevenue) * 100 : 0;
  const actualTaxPct = totalNetRevenue > 0 ? (actualTaxPaid / totalNetRevenue) * 100 : 0;
  const actualOpExPct = totalNetRevenue > 0 ? (actualOpExSpend / totalNetRevenue) * 100 : 0;

  // 3-Month OpEx target for reserve vault
  // Assuming the data covers approx 1 month for demo/simplicity, or average it properly.
  // We will simply use actualOpExSpend as a monthly proxy if we don't have historical months.
  const monthlyAvgOpEx = actualOpExSpend;
  const reserveVaultTarget = monthlyAvgOpEx * config.reserveMonthsTarget;
  const reserveFundVaultCurrent = actualProfitDistributed;
  const reserveFundVaultPct = reserveVaultTarget > 0 ? Math.min(100, Math.round((reserveFundVaultCurrent / reserveVaultTarget) * 100)) : 0;

  return {
    totalNetRevenue,
    theoretical: {
      profit: theoreticalProfit,
      owner: theoreticalOwner,
      taxes: theoreticalTaxes,
      opEx: theoreticalOpEx,
    },
    actual: {
      profit: actualProfitDistributed,
      owner: actualOwnerDraw,
      taxes: actualTaxPaid,
      opEx: actualOpExSpend,
    },
    percentages: {
      profit: Number(actualProfitPct.toFixed(1)),
      owner: Number(actualOwnerPct.toFixed(1)),
      taxes: Number(actualTaxPct.toFixed(1)),
      opEx: Number(actualOpExPct.toFixed(1)),
    },
    reserveVault: {
      current: reserveFundVaultCurrent,
      target: reserveVaultTarget,
      percentage: reserveFundVaultPct,
    }
  };
}

/**
 * 12-24 Months Projection Generator & Key KPIs with What-If Sensitivity Engine
 */
export function generateProjections(
  scenario: ProjectionScenario, 
  payables: Payable[] = [], 
  currentCash: number = 0,
  transactions: Transaction[] = []
): {
  months: ProjectionMonth[];
  breakEvenMonthly: number;
  runwayMonths: number;
  netBurnRateMonthly: number;
  deathValleyMonth: string | null;
  deathValleyMonthIndex: number | null;
  minCashRequired: number;
  realOperatingMargin: number;
  annualNetProfit: number;
} {
  const horizon = scenario.horizonMonths || 12;
  const months: ProjectionMonth[] = [];
  
  // Calculate actual income from transactions if available
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const totalActualIncome = incomeTransactions.reduce((acc, t) => acc + t.netAmount, 0);

  // Baseline monthly income calculation:
  // If user sets monthlySalesUnits or ticketAverage, calculate base revenue (Units * Ticket).
  // If actual transactions exist and no units were customized, fallback to actuals or units * ticket.
  const salesUnits = scenario.monthlySalesUnits !== undefined 
    ? scenario.monthlySalesUnits 
    : (totalActualIncome > 0 && scenario.ticketAverage > 0 ? Math.round(totalActualIncome / scenario.ticketAverage) : 150);
  
  const baseMonthlyIncome = salesUnits > 0 && scenario.ticketAverage > 0
    ? Math.round(salesUnits * scenario.ticketAverage)
    : (totalActualIncome > 0 ? totalActualIncome : 0);

  let runningCumulative = currentCash;

  const now = new Date();
  const monthNamesSpanish = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  let totalHorizonIncome = 0;
  let totalHorizonCosts = 0;
  let firstNegativeCashMonth: string | null = null;
  let firstNegativeCashIndex: number | null = null;

  const baseFixed = scenario.fixedMonthlyCosts || 0;
  // Safety buffer: 2 months of fixed costs
  const minCashRequired = baseFixed * 2;

  const activeWhatIfs = (scenario.whatIfEvents || []).filter(w => w.enabled);

  for (let i = 0; i < horizon; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = monthNamesSpanish[targetDate.getMonth()];
    const year = targetDate.getFullYear();
    const isProjected = i > 0;
    const label = isProjected ? `${monthName} ${year} (P)` : `${monthName} ${year}`;
    const monthKey = `${year}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    // MoM income growth compounding
    const growthFactor = Math.pow(1 + (scenario.salesVolumeMoMGrowth / 100), i);
    let estGrossIncome = Math.round(baseMonthlyIncome * growthFactor);

    // Evaluate What-If Events on Income
    let whatIfImpactIncome = 0;
    let whatIfImpactExpense = 0;

    for (const wi of activeWhatIfs) {
      if (wi.type === 'revenue_change_pct') {
        const start = wi.startMonthIndex;
        const end = wi.endMonthIndex !== undefined ? wi.endMonthIndex : horizon;
        if (i >= start && i <= end) {
          const delta = estGrossIncome * (wi.amountOrPct / 100);
          estGrossIncome = Math.max(0, Math.round(estGrossIncome + delta));
          whatIfImpactIncome += delta;
        }
      } else if (wi.type === 'one_time_income') {
        if (i === wi.startMonthIndex) {
          estGrossIncome += Math.round(wi.amountOrPct);
          whatIfImpactIncome += Math.round(wi.amountOrPct);
        }
      } else if (wi.type === 'recurring_expense') {
        const start = wi.startMonthIndex;
        const end = wi.endMonthIndex !== undefined ? wi.endMonthIndex : horizon;
        if (i >= start && i <= end) {
          whatIfImpactExpense += Math.round(wi.amountOrPct);
        }
      } else if (wi.type === 'one_time_capex') {
        if (i === wi.startMonthIndex) {
          whatIfImpactExpense += Math.round(wi.amountOrPct);
        }
      }
    }

    const estNetIncome = estGrossIncome;

    // COGS & Variable costs based on variableCostRatio
    const varRatio = (scenario.variableCostRatio || 40) / 100;
    const cogs = Math.round(estGrossIncome * (varRatio * 0.75));
    const marketing = Math.round(estGrossIncome * (varRatio * 0.25));
    const totalVariable = cogs + marketing;

    // Fixed costs from payables and fixed config
    const monthlyPayablesScheduled = payables
      .filter(p => p.status !== 'paid' && p.remainingAmount > 0)
      .reduce((acc, p) => acc + p.remainingAmount, 0);

    const payroll = baseFixed > 0 ? Math.round(baseFixed * 0.75) : 0;
    const rentAndUtil = baseFixed > 0 ? Math.round(baseFixed * 0.25) : 0;
    const otherFixed = 0;
    const scheduledPayables = Math.round(monthlyPayablesScheduled);

    const totalFixed = payroll + rentAndUtil + otherFixed;
    const totalCosts = totalVariable + totalFixed + scheduledPayables + whatIfImpactExpense;
    const netMonthly = estGrossIncome - totalCosts;

    runningCumulative += netMonthly;

    // Detect Death Valley (Caja <= 0)
    if (runningCumulative <= 0 && firstNegativeCashMonth === null) {
      firstNegativeCashMonth = label;
      firstNegativeCashIndex = i;
    }

    totalHorizonIncome += estGrossIncome;
    totalHorizonCosts += totalCosts;

    months.push({
      monthKey,
      label,
      isProjected,
      estGrossIncome,
      estNetIncome,
      cogs,
      marketing,
      payroll,
      rentAndUtil,
      otherFixed,
      scheduledPayables,
      whatIfImpactIncome: Math.round(whatIfImpactIncome),
      whatIfImpactExpense: Math.round(whatIfImpactExpense),
      totalVariable,
      totalFixed,
      totalCosts,
      netMonthly,
      cumulativeCash: runningCumulative,
    });
  }

  // Break-Even Point calculation: Fixed Costs / (1 - (Variable Costs / Revenue))
  const avgVariableRatio = (scenario.variableCostRatio || 40) / 100;
  const contributionMarginRatio = Math.max(0.05, 1 - avgVariableRatio);
  const totalMonthlyFixed = baseFixed;
  const breakEvenMonthly = totalMonthlyFixed > 0 ? Math.round(totalMonthlyFixed / contributionMarginRatio) : 0;

  // Actual Monthly Burn rate calculation
  const totalActualExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.grossAmount, 0);
  const monthlyFixedBurn = totalMonthlyFixed > 0 ? totalMonthlyFixed : (totalActualExpenses > 0 ? totalActualExpenses : 1);
  
  // Net Burn Rate (Average monthly cash deficit if negative)
  const negativeNetMonths = months.filter(m => m.netMonthly < 0);
  const netBurnRateMonthly = negativeNetMonths.length > 0 
    ? Math.round(negativeNetMonths.reduce((sum, m) => sum + Math.abs(m.netMonthly), 0) / negativeNetMonths.length)
    : monthlyFixedBurn;

  // Runway Calculation:
  // If cash is consumed, runway = currentCash / netBurnRate. If net is positive, runway in zero-revenue emergency = currentCash / monthlyFixedBurn
  let runwayMonths = 0;
  if (currentCash > 0 && monthlyFixedBurn > 0) {
    runwayMonths = Number((currentCash / monthlyFixedBurn).toFixed(1));
  } else {
    runwayMonths = 0;
  }

  // Operating Margin over the projection horizon
  const realOperatingMargin = totalHorizonIncome > 0 
    ? Number((((totalHorizonIncome - totalHorizonCosts) / totalHorizonIncome) * 100).toFixed(1))
    : 0;

  const annualNetProfit = totalHorizonIncome - totalHorizonCosts;

  return {
    months,
    breakEvenMonthly,
    runwayMonths,
    netBurnRateMonthly,
    deathValleyMonth: firstNegativeCashMonth,
    deathValleyMonthIndex: firstNegativeCashIndex,
    minCashRequired,
    realOperatingMargin,
    annualNetProfit,
  };
}

/**
 * Calculates IVA and PPM (Formulario 29) summary for a given array of transactions.
 * Sincronizado exactamente con las reglas tributarias del SII (Art. 84 LIR).
 */
export function calculateIVASummary(transactions: Transaction[]) {
  let ivaDebito = 0; // Tax to pay (from sales)
  let ivaCredito = 0; // Tax credit (from purchases)
  let salesNet = 0; // Base Imponible Neta de Primera Categoría (para PPM)
  let salesNetAfectas = 0; // Ventas afectas con boleta/factura
  let salesNetExentas = 0; // Ventas exentas o no gravadas

  for (const tx of transactions) {
    if (tx.type === 'income') {
      const hasTax = tx.docType === 'factura' || tx.docType === 'boleta' || tx.hasFactura || (tx.ivaAmount !== undefined && tx.ivaAmount > 0);
      if (hasTax) {
        const iva = tx.ivaAmount || (tx.grossAmount - (tx.grossAmount / 1.19));
        const net = tx.grossAmount - iva;
        ivaDebito += iva;
        salesNetAfectas += net;
        salesNet += net;
      } else {
        salesNetExentas += tx.grossAmount;
        salesNet += tx.grossAmount;
      }
    } else if (tx.type === 'expense') {
      const hasFactura = tx.hasFactura || tx.docType === 'factura';
      const iva = tx.ivaAmount || (hasFactura ? (tx.grossAmount - (tx.grossAmount / 1.19)) : 0);
      if (iva > 0) {
        ivaCredito += iva;
      }
    }
  }

  const ivaAPagar = Math.max(0, ivaDebito - ivaCredito);
  const remanente = Math.max(0, ivaCredito - ivaDebito);
  // PPM régimen Pro-Pyme 1% sobre Base Imponible Neta (sin IVA)
  const estimatedPpm = Math.round(salesNet * 0.01);

  return {
    ivaDebito: applyCurrencyRules(ivaDebito),
    ivaCredito: applyCurrencyRules(ivaCredito),
    ivaAPagar: applyCurrencyRules(ivaAPagar),
    remanente: applyCurrencyRules(remanente),
    salesNet: applyCurrencyRules(salesNet),
    salesNetAfectas: applyCurrencyRules(salesNetAfectas),
    salesNetExentas: applyCurrencyRules(salesNetExentas),
    estimatedPpm: applyCurrencyRules(estimatedPpm),
  };
}

/**
 * Computes complete consolidated metrics for a filtered set of transactions (any period)
 */
export function calculatePeriodTransactionsMetrics(
  periodTransactions: Transaction[],
  startingCashDrawer: number = 0
) {
  let grossRevenue = 0;
  let netRevenue = 0;
  let processingFees = 0;
  let totalExpenses = 0;
  let cashSales = 0;
  let cashExpenses = 0;
  let bankSales = 0;
  let bankExpenses = 0;

  for (const tx of periodTransactions) {
    if (tx.type === 'income') {
      grossRevenue += tx.grossAmount;
      netRevenue += tx.netAmount;
      processingFees += tx.feeAmount;
      if (tx.paymentMethod === 'cash') {
        cashSales += tx.netAmount;
      } else {
        bankSales += tx.netAmount;
      }
    } else if (tx.type === 'expense') {
      totalExpenses += tx.grossAmount;
      if (tx.outflowMethod === 'cash_drawer') {
        cashExpenses += tx.grossAmount;
      } else {
        bankExpenses += tx.grossAmount;
      }
    }
  }

  const netOperatingCashFlow = netRevenue - totalExpenses;
  const operatingMargin = netRevenue > 0 ? (netOperatingCashFlow / netRevenue) * 100 : 0;
  const ivaSummary = calculateIVASummary(periodTransactions);
  const expectedCashDrawer = startingCashDrawer + cashSales - cashExpenses;

  return {
    grossRevenue: applyCurrencyRules(grossRevenue),
    netRevenue: applyCurrencyRules(netRevenue),
    processingFees: applyCurrencyRules(processingFees),
    totalExpenses: applyCurrencyRules(totalExpenses),
    cashSales: applyCurrencyRules(cashSales),
    cashExpenses: applyCurrencyRules(cashExpenses),
    bankSales: applyCurrencyRules(bankSales),
    bankExpenses: applyCurrencyRules(bankExpenses),
    netOperatingCashFlow: applyCurrencyRules(netOperatingCashFlow),
    operatingMargin: Number(operatingMargin.toFixed(1)),
    expectedCashDrawer: applyCurrencyRules(expectedCashDrawer),
    ivaSummary,
    count: periodTransactions.length,
    incomeCount: periodTransactions.filter(t => t.type === 'income').length,
    expenseCount: periodTransactions.filter(t => t.type === 'expense').length,
  };
}

/**
 * Returns today's date in local client timezone as YYYY-MM-DD (never UTC offset issues)
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns local time as HH:MM
 */
export function getLocalTimeString(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

