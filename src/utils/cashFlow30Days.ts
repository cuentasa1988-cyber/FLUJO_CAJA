import { Payable, Receivable, Transaction } from '../types';
import { getLocalDateString } from './financial';

export interface DayForecastItem {
  id: string;
  name: string;
  concept: string;
  amount: number;
  type: 'receivable' | 'payable' | 'avg_sales';
  docNumber?: string;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  dayIndex: number; // 0 to 29
  dayName: string; // Lun, Mar, etc.
  formattedDate: string; // 08 Sep
  openingBalance: number;
  scheduledReceivables: DayForecastItem[];
  scheduledPayables: DayForecastItem[];
  totalReceivables: number;
  estimatedSalesAvg: number;
  totalInflows: number;
  totalPayables: number;
  totalOutflows: number;
  netFlow: number;
  closingBalance: number;
  isDeficit: boolean;
  hasActivity: boolean;
}

export interface WeekMilestone {
  weekNumber: number;
  label: string;
  dateRange: string;
  startBalance: number;
  inflows: number;
  outflows: number;
  netFlow: number;
  endBalance: number;
  status: 'healthy' | 'tight' | 'deficit';
  receivablesCount: number;
  payablesCount: number;
}

export interface CashFlow30DayResult {
  days: DayForecast[];
  weeks: WeekMilestone[];
  daysAhead: number;
  startingTotalLiquidity: number;
  startingBank: number;
  startingCashDrawer: number;
  totalReceivables30Days: number;
  totalPayables30Days: number;
  projectedFinalBalance: number;
  net30DayChange: number;
  lowestProjectedBalance: number;
  lowestBalanceDate: string | null;
  hasDeficitRisk: boolean;
  deficitDaysCount: number;
  firstDeficitDate: string | null;
  historicalDailySalesAvg: number;
  salesLookbackDaysCount: number;
}

export interface CashFlowOptions {
  startDate?: string;
  daysAhead?: number;
  includeHistoricalSalesAverage?: boolean;
  salesLookbackDays?: number;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Calculates the exact 30-day cash flow projection grounded strictly in real data.
 */
export function calculate30DayForecast(
  startingBank: number,
  startingCashDrawer: number,
  payables: Payable[],
  receivables: Receivable[],
  transactions: Transaction[],
  options: CashFlowOptions = {}
): CashFlow30DayResult {
  const daysAhead = options.daysAhead || 30;
  const includeSalesAvg = options.includeHistoricalSalesAverage || false;
  const lookbackDays = options.salesLookbackDays || 14;

  const startBaseDate = options.startDate 
    ? new Date(options.startDate + 'T12:00:00') 
    : new Date();
  
  const startingTotalLiquidity = startingBank + startingCashDrawer;

  // 1. Compute REAL historical average daily sales from the transactions ledger (last 14 or 30 days)
  let historicalDailySalesAvg = 0;
  let salesLookbackDaysCount = 0;
  
  if (transactions.length > 0) {
    const todayMillis = startBaseDate.getTime();
    const lookbackThresholdMillis = todayMillis - (lookbackDays * 24 * 60 * 60 * 1000);
    
    // Filter real income transactions within the lookback window
    const recentIncomes = transactions.filter(t => {
      if (t.type !== 'income') return false;
      const txDate = new Date(t.date + 'T12:00:00').getTime();
      return txDate >= lookbackThresholdMillis && txDate <= todayMillis;
    });

    const totalRecentIncome = recentIncomes.reduce((acc, t) => acc + (t.netAmount || t.grossAmount), 0);
    salesLookbackDaysCount = lookbackDays;
    historicalDailySalesAvg = Math.round(totalRecentIncome / lookbackDays);
  }

  // 2. Filter active receivables and payables that have pending amounts
  const activeReceivables = receivables.filter(r => r.remainingAmount > 0 && r.status !== 'collected');
  const activePayables = payables.filter(p => p.remainingAmount > 0 && p.status !== 'paid');

  // 3. Build 30-day projection day by day
  const days: DayForecast[] = [];
  let currentBalance = startingTotalLiquidity;

  let totalReceivables30Days = 0;
  let totalPayables30Days = 0;
  let lowestProjectedBalance = startingTotalLiquidity;
  let lowestBalanceDate: string | null = null;
  let deficitDaysCount = 0;
  let firstDeficitDate: string | null = null;

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(startBaseDate);
    d.setDate(d.getDate() + i);
    const dateStr = getLocalDateString(d);
    const dayOfWeek = DAY_NAMES[d.getDay()];
    const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`;

    const openingBalance = currentBalance;

    // Find receivables due on this date (or overdue items placed on Day 0)
    const matchingReceivables = activeReceivables.filter(r => {
      if (i === 0) {
        // Day 0 captures today and any past overdue items that haven't been collected
        return r.dueDate <= dateStr;
      }
      return r.dueDate === dateStr;
    });

    const scheduledReceivables: DayForecastItem[] = matchingReceivables.map(r => ({
      id: r.id,
      name: r.clientName,
      concept: r.concept,
      amount: r.remainingAmount,
      type: 'receivable',
      docNumber: r.docNumber,
    }));

    const dayReceivablesSum = scheduledReceivables.reduce((acc, item) => acc + item.amount, 0);
    totalReceivables30Days += dayReceivablesSum;

    // Find payables due on this date (or overdue items placed on Day 0)
    const matchingPayables = activePayables.filter(p => {
      if (i === 0) {
        // Day 0 captures today and any past overdue bills
        return p.dueDate <= dateStr;
      }
      return p.dueDate === dateStr;
    });

    const scheduledPayables: DayForecastItem[] = matchingPayables.map(p => ({
      id: p.id,
      name: p.vendor,
      concept: p.concept,
      amount: p.remainingAmount,
      type: 'payable',
    }));

    const dayPayablesSum = scheduledPayables.reduce((acc, item) => acc + item.amount, 0);
    totalPayables30Days += dayPayablesSum;

    // Estimated daily sales (if opted in by user)
    const estimatedSalesAvg = includeSalesAvg ? historicalDailySalesAvg : 0;
    const totalInflows = dayReceivablesSum + estimatedSalesAvg;
    const totalOutflows = dayPayablesSum;
    const netFlow = totalInflows - totalOutflows;

    const closingBalance = openingBalance + netFlow;
    currentBalance = closingBalance;

    const isDeficit = closingBalance < 0;
    if (isDeficit) {
      deficitDaysCount++;
      if (!firstDeficitDate) {
        firstDeficitDate = dateStr;
      }
    }

    if (closingBalance < lowestProjectedBalance) {
      lowestProjectedBalance = closingBalance;
      lowestBalanceDate = dateStr;
    }

    days.push({
      date: dateStr,
      dayIndex: i,
      dayName: dayOfWeek,
      formattedDate,
      openingBalance,
      scheduledReceivables,
      scheduledPayables,
      totalReceivables: dayReceivablesSum,
      estimatedSalesAvg,
      totalInflows,
      totalPayables: dayPayablesSum,
      totalOutflows,
      netFlow,
      closingBalance,
      isDeficit,
      hasActivity: scheduledReceivables.length > 0 || scheduledPayables.length > 0,
    });
  }

  // 4. Build Weekly Milestones dynamically based on daysAhead (7-day intervals)
  const weeks: WeekMilestone[] = [];
  const totalWeeks = Math.ceil(days.length / 7);

  for (let w = 0; w < totalWeeks; w++) {
    const startIdx = w * 7;
    const endIdx = Math.min(startIdx + 6, days.length - 1);
    if (startIdx >= days.length) break;

    const weekDays = days.slice(startIdx, endIdx + 1);
    if (weekDays.length === 0) continue;

    const startBalance = weekDays[0].openingBalance;
    const endBalance = weekDays[weekDays.length - 1].closingBalance;
    const inflows = weekDays.reduce((acc, d) => acc + d.totalInflows, 0);
    const outflows = weekDays.reduce((acc, d) => acc + d.totalOutflows, 0);
    const netFlow = inflows - outflows;

    const receivablesCount = weekDays.reduce((acc, d) => acc + d.scheduledReceivables.length, 0);
    const payablesCount = weekDays.reduce((acc, d) => acc + d.scheduledPayables.length, 0);

    const minDayInWeek = Math.min(...weekDays.map(d => d.closingBalance));

    let status: 'healthy' | 'tight' | 'deficit' = 'healthy';
    if (minDayInWeek < 0) {
      status = 'deficit';
    } else if (minDayInWeek < startingTotalLiquidity * 0.2) {
      status = 'tight';
    }

    const firstDate = weekDays[0].formattedDate;
    const lastDate = weekDays[weekDays.length - 1].formattedDate;

    weeks.push({
      weekNumber: w + 1,
      label: `Semana ${w + 1} (Días ${startIdx + 1} - ${endIdx + 1})`,
      dateRange: `${firstDate} - ${lastDate}`,
      startBalance,
      inflows,
      outflows,
      netFlow,
      endBalance,
      status,
      receivablesCount,
      payablesCount,
    });
  }

  const projectedFinalBalance = days.length > 0 ? days[days.length - 1].closingBalance : startingTotalLiquidity;
  const net30DayChange = projectedFinalBalance - startingTotalLiquidity;
  const hasDeficitRisk = lowestProjectedBalance < 0;

  return {
    days,
    weeks,
    daysAhead,
    startingTotalLiquidity,
    startingBank,
    startingCashDrawer,
    totalReceivables30Days,
    totalPayables30Days,
    projectedFinalBalance,
    net30DayChange,
    lowestProjectedBalance,
    lowestBalanceDate,
    hasDeficitRisk,
    deficitDaysCount,
    firstDeficitDate,
    historicalDailySalesAvg,
    salesLookbackDaysCount,
  };
}
