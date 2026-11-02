import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Cell,
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  PlusCircle,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  CreditCard,
  Building2,
  Receipt,
  FileSpreadsheet,
  Info,
  BarChart3,
  Wallet,
  Activity,
  X
} from 'lucide-react';
import { 
  AppSettings, 
  Payable, 
  Receivable,
  Transaction, 
  TabType, 
  ProjectionScenario,
  ExpenseCategory,
  PaymentChannel,
  DatePeriodFilter
} from '../../types';
import { 
  calculateCurrentLiquidity, 
  calculatePocketsActualVsTarget, 
  calculatePayablesMetrics,
  formatCurrency, 
  generateProjections,
  calculateIVASummary
} from '../../utils/financial';
import { getCurrentMonthString, formatMonthLabel, isDateInPeriod, getPeriodLabel, getPresetPeriod } from '../../utils/dateFilter';
import { PeriodFilterBar } from '../common/PeriodFilterBar';

interface DashboardViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  payables: Payable[];
  receivables?: Receivable[];
  scenario: ProjectionScenario;
  onNavigate: (tab: TabType) => void;
  onOpenF29Modal?: () => void;
  periodFilter?: DatePeriodFilter;
  onChangePeriodFilter?: (filter: DatePeriodFilter) => void;
  onResetDemoData?: () => void;
  onOpenCloudAuth?: () => void;
  currentUser?: any;
}

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  raw_materials: 'Materia Prima / Insumos',
  packaging: 'Empaques y Envoltorios',
  shipping: 'Fletes y Despachos',
  rent: 'Arriendo / Local',
  utilities: 'Luz, Agua, Gas, Internet',
  payroll_daily: 'Sueldos y Honorarios',
  software_services: 'Software y Plataformas',
  accounting_legal: 'Contabilidad y Legal',
  minor_expenses: 'Gastos Menores / Varios',
  marketing: 'Publicidad y Marketing',
  other_expense: 'Otros Gastos',
  taxes_sii: 'Impuestos SII (F29/Renta)',
  taxes_previred: 'Leyes Sociales (Previred)',
  capex_machinery: 'Maquinaria / Inversión',
  owner_draw: 'Sueldo / Retiro del Dueño',
  profit_distribution: 'Distribución de Ganancia',
  tax_reserve: 'Reserva para Impuestos',
};

const PAYMENT_LABELS: Record<PaymentChannel, string> = {
  cash: 'Efectivo',
  debit_card: 'Tarjeta Débito',
  prepaid_card: 'Tarjeta Prepago',
  credit_card: 'Tarjeta Crédito',
  delivery_app: 'App Delivery',
  bank_transfer: 'Transferencia',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  transactions,
  payables,
  receivables = [],
  scenario,
  onNavigate,
  onOpenF29Modal,
  periodFilter,
  onChangePeriodFilter,
  onResetDemoData,
  onOpenCloudAuth,
  currentUser,
}) => {
  const currentMonthStr = getCurrentMonthString();
  const { bank, cashDrawer, totalLiquidity } = calculateCurrentLiquidity(settings, transactions, payables);

  const [isCloudNoticeDismissed, setIsCloudNoticeDismissed] = useState<boolean>(() => {
    return localStorage.getItem('dismissed_zero_cloud_banner_v1') === 'true';
  });

  const handleDismissCloudNotice = () => {
    setIsCloudNoticeDismissed(true);
    localStorage.setItem('dismissed_zero_cloud_banner_v1', 'true');
  };

  // Month-specific calculations for active month (F29 is strictly monthly per SII)
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonthStr));
  }, [transactions, currentMonthStr]);
  const ivaSummary = useMemo(() => calculateIVASummary(currentMonthTransactions), [currentMonthTransactions]);

  // Active period transactions (filtered by periodFilter if provided, else fallback to current month)
  const activePeriodTransactions = useMemo(() => {
    if (periodFilter) {
      return transactions.filter(t => isDateInPeriod(t.date, periodFilter));
    }
    return currentMonthTransactions;
  }, [transactions, periodFilter, currentMonthTransactions]);

  // 4 Pockets Profit First calculation on active period (100% in sync with DistributionView)
  const pockets = useMemo(() => {
    return calculatePocketsActualVsTarget(activePeriodTransactions, settings.pocketConfig);
  }, [activePeriodTransactions, settings.pocketConfig]);

  const payablesMetrics = calculatePayablesMetrics(payables, totalLiquidity);
  const projections = generateProjections(scenario, payables, totalLiquidity, transactions);

  const monthNetIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.netAmount, 0);
  const monthGrossIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.grossAmount, 0);
  const monthExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.grossAmount, 0);
  const monthNetProfit = monthNetIncome - monthExpenses;
  const monthMargin = monthNetIncome > 0 ? (monthNetProfit / monthNetIncome) * 100 : 0;

  // Clasificación estándar: Costos Directos (CD) vs Gastos Operativos (GO)
  const isDirectCost = (cat?: ExpenseCategory) => {
    return cat === 'raw_materials' || cat === 'packaging' || cat === 'shipping';
  };

  // 1. Ingresos Totales (IT): Suma de todas las ventas del período descontando comisiones POS
  const itCurrent = monthNetIncome;

  // 2. Costos Directos (CD): Materia Prima, Insumos y Envases
  const cdCurrent = currentMonthTransactions
    .filter(t => t.type === 'expense' && isDirectCost(t.category))
    .reduce((acc, t) => acc + t.grossAmount, 0);

  // 3. Margen Bruto (MB): MB = IT - CD
  const mbCurrent = itCurrent - cdCurrent;

  // 4. Gastos Operativos (GO): Costos Fijos, Arriendo, Servicios Básicos, Sueldos, Software y OPEX
  const goCurrent = currentMonthTransactions
    .filter(t => t.type === 'expense' && !isDirectCost(t.category) && t.category !== 'taxes_sii' && t.category !== 'taxes_previred' && t.category !== 'capex_machinery' && t.category !== 'owner_draw' && t.category !== 'profit_distribution' && t.category !== 'tax_reserve')
    .reduce((acc, t) => acc + t.grossAmount, 0);

  // 5. Utilidad Operativa (UO): UO = MB - GO = IT - (CD + GO)
  const uoCurrent = mbCurrent - goCurrent;

  // 6. Margen Operativo Real (%): (UO / IT) * 100 si IT > 0, sino 0%
  const operatingMarginPctCurrent = itCurrent > 0 ? (uoCurrent / itCurrent) * 100 : 0;

  // Cálculo del Mes Anterior para Comparativa vs Mes Anterior
  const [cYear, cMonth] = currentMonthStr.split('-').map(Number);
  const prevDate = new Date(cYear, cMonth - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthTransactions = transactions.filter(t => t.date.startsWith(prevMonthStr));

  const itPrev = prevMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.netAmount, 0);

  const cdPrev = prevMonthTransactions
    .filter(t => t.type === 'expense' && isDirectCost(t.category))
    .reduce((acc, t) => acc + t.grossAmount, 0);

  const goPrev = prevMonthTransactions
    .filter(t => t.type === 'expense' && !isDirectCost(t.category) && t.category !== 'taxes_sii' && t.category !== 'taxes_previred' && t.category !== 'capex_machinery' && t.category !== 'owner_draw' && t.category !== 'profit_distribution' && t.category !== 'tax_reserve')
    .reduce((acc, t) => acc + t.grossAmount, 0);

  const uoPrev = (itPrev - cdPrev) - goPrev;
  const hasPrevData = itPrev > 0 || (cdPrev + goPrev) > 0;
  const operatingMarginPctPrev = itPrev > 0 ? (uoPrev / itPrev) * 100 : 0;

  // Comparativas porcentuales
  const diffVsPrevMonth = operatingMarginPctCurrent - operatingMarginPctPrev;
  const targetOperatingMargin = settings.targetOperatingMarginPct !== undefined ? settings.targetOperatingMarginPct : 25;
  const diffVsTarget = operatingMarginPctCurrent - targetOperatingMargin;

  // Global transactions totals
  const totalNetIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.netAmount, 0);
  const hasTransactions = transactions.length > 0;

  // Upcoming payables (filtered and sorted by due date)
  const sortedPendingPayables = useMemo(() => {
    return [...payables]
      .filter(p => p.status !== 'paid' && p.remainingAmount > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payables]);
  const upcomingPayables = sortedPendingPayables.slice(0, 5);

  // Upcoming receivables (filtered and sorted by due date)
  const sortedPendingReceivables = useMemo(() => {
    return [...(receivables || [])]
      .filter(r => r.status !== 'collected' && r.remainingAmount > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [receivables]);
  const upcomingReceivables = sortedPendingReceivables.slice(0, 5);
  const totalPendingReceivablesAmount = sortedPendingReceivables.reduce((sum, r) => sum + r.remainingAmount, 0);

  // Tab state for commitments (Payables vs Receivables)
  const [commitmentsTab, setCommitmentsTab] = useState<'payables' | 'receivables'>('payables');

  // Recent transactions (last 5)
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime())
    .slice(0, 5);

  // Tab state for the operational performance chart
  const [operationalChartTab, setOperationalChartTab] = useState<'daily_flow' | 'payment_methods'>('daily_flow');
  const [dailyChartDisplayMode, setDailyChartDisplayMode] = useState<'comparison' | 'net_flow'>('comparison');
  const [showChartGuide, setShowChartGuide] = useState<boolean>(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null);

  // Daily Flow Data (Ventas vs Egresos por día real del período activo)
  const dailyFlowData = useMemo(() => {
    const txs = activePeriodTransactions;
    if (txs.length === 0) return [];

    const dateMap = new Map<string, { 
      date: string; 
      label: string; 
      fullDateLabel: string;
      ingresos: number; 
      ivaDebito: number;
      egresos: number; 
      egresosGrafico: number;
      flujoCajaDia: number; 
      saldoAcumulado: number;
      txCount: number;
      incomeCount: number;
      expenseCount: number;
      incomesList: { concept: string; amount: number; method?: string }[];
      expensesList: { concept: string; amount: number; category?: string }[];
    }>();

    for (const tx of txs) {
      if (!dateMap.has(tx.date)) {
        const parts = tx.date.split('-');
        const y = parts[0] ? parseInt(parts[0], 10) : 2026;
        const m = parts[1] ? parseInt(parts[1], 10) : 1;
        const d = parts[2] ? parseInt(parts[2], 10) : 1;
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fullMonthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const label = `${d} ${monthNames[m - 1] || ''}`;
        const fullDateLabel = `${d} de ${fullMonthNames[m - 1] || ''} ${y}`;
        
        dateMap.set(tx.date, { 
          date: tx.date, 
          label, 
          fullDateLabel,
          ingresos: 0, 
          ivaDebito: 0,
          egresos: 0, 
          egresosGrafico: 0,
          flujoCajaDia: 0, 
          saldoAcumulado: 0,
          txCount: 0,
          incomeCount: 0,
          expenseCount: 0,
          incomesList: [],
          expensesList: [],
        });
      }
      const entry = dateMap.get(tx.date)!;
      entry.txCount += 1;
      if (tx.type === 'income') {
        entry.ingresos += tx.netAmount;
        entry.ivaDebito += (tx.ivaAmount || 0);
        entry.incomeCount += 1;
        entry.incomesList.push({ concept: tx.concept, amount: tx.netAmount, method: tx.paymentMethod });
      } else if (tx.type === 'expense') {
        entry.egresos += tx.grossAmount;
        entry.expenseCount += 1;
        entry.expensesList.push({ concept: tx.concept, amount: tx.grossAmount, category: tx.category });
      }
    }

    const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = (settings.startingBankBalance || 0) + (settings.startingCashDrawer || 0);
    sorted.forEach(item => {
      item.egresosGrafico = item.egresos > 0 ? -item.egresos : 0;
      item.flujoCajaDia = item.ingresos - item.egresos;
      runningBalance += item.flujoCajaDia;
      item.saldoAcumulado = runningBalance;
    });

    return sorted;
  }, [activePeriodTransactions]);

  // Dynamic Y-axis domain ensuring proper scale depending on comparison vs net_flow mode
  const dailyFlowYDomain = useMemo(() => {
    if (dailyFlowData.length === 0) return [0, 1000];
    
    if (dailyChartDisplayMode === 'comparison') {
      let maxVal = 0;
      dailyFlowData.forEach(d => {
        maxVal = Math.max(maxVal, d.ingresos, d.egresos);
      });
      if (maxVal === 0) return [0, 1000];
      const roundStep = maxVal > 500000 ? 100000 : maxVal > 100000 ? 50000 : 10000;
      const roundedMax = Math.ceil((maxVal * 1.2) / roundStep) * roundStep;
      return [0, roundedMax];
    } else {
      let min = 0;
      let max = 0;
      dailyFlowData.forEach(d => {
        min = Math.min(min, d.flujoCajaDia, d.saldoAcumulado);
        max = Math.max(max, d.flujoCajaDia, d.saldoAcumulado);
      });
      if (min === 0 && max === 0) return [-1000, 1000];
      const peak = Math.max(Math.abs(min), Math.abs(max));
      const roundStep = peak > 500000 ? 100000 : peak > 100000 ? 50000 : 10000;
      const roundedPeak = Math.ceil((peak * 1.25) / roundStep) * roundStep;
      return [-roundedPeak, roundedPeak];
    }
  }, [dailyFlowData, dailyChartDisplayMode]);

  // Operational metrics for the period
  const operationalMetrics = useMemo(() => {
    let bestDay = { date: '', label: '', amount: 0 };
    let totalIncome = 0;
    let daysWithSales = 0;
    let totalExpenses = 0;

    dailyFlowData.forEach(day => {
      if (day.ingresos > bestDay.amount) {
        bestDay = { date: day.date, label: day.label, amount: day.ingresos };
      }
      if (day.ingresos > 0) {
        daysWithSales += 1;
        totalIncome += day.ingresos;
      }
      totalExpenses += day.egresos;
    });

    const avgDailySales = daysWithSales > 0 ? Math.round(totalIncome / daysWithSales) : 0;
    const netTotalPeriod = totalIncome - totalExpenses;

    return {
      bestDay,
      avgDailySales,
      daysWithSales,
      totalIncome,
      totalExpenses,
      netTotalPeriod,
    };
  }, [dailyFlowData]);

  // Payment Methods Breakdown Data
  const paymentMethodsData = useMemo(() => {
    const incomes = activePeriodTransactions.filter(t => t.type === 'income');
    const channelMap = new Map<PaymentChannel, { channel: PaymentChannel; label: string; gross: number; fees: number; net: number; count: number }>();

    for (const tx of incomes) {
      const channel: PaymentChannel = tx.paymentMethod || 'cash';
      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          channel,
          label: PAYMENT_LABELS[channel] || channel,
          gross: 0,
          fees: 0,
          net: 0,
          count: 0,
        });
      }
      const entry = channelMap.get(channel)!;
      entry.gross += tx.grossAmount;
      entry.fees += (tx.feeAmount || 0);
      entry.net += tx.netAmount;
      entry.count += 1;
    }

    const totalNet = incomes.reduce((sum, t) => sum + t.netAmount, 0);

    return Array.from(channelMap.values())
      .map(item => ({
        ...item,
        pct: totalNet > 0 ? Math.round((item.net / totalNet) * 100) : 0,
      }))
      .sort((a, b) => b.net - a.net);
  }, [activePeriodTransactions]);

  // Helper for due date badge
  const getDueBadge = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr + 'T00:00:00');
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Vencido hace ${Math.abs(diffDays)}d`, color: 'bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]' };
    }
    if (diffDays === 0) {
      return { text: 'Vence Hoy', color: 'bg-[#FEF3C7] text-[#D97706] border-[#FCD34D]' };
    }
    if (diffDays <= 3) {
      return { text: `En ${diffDays} días`, color: 'bg-[#FEF9C3] text-[#CA8A04] border-[#FDE047]' };
    }
    return { text: `En ${diffDays} días`, color: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]' };
  };

  // PPM estimation (1% on net sales for Régimen ProPyme según Art. 84 LIR - SII)
  const estimatedPpm = ivaSummary.estimatedPpm;

  // Impuestos ya pagados o provisionados en el mes
  const taxesPaidInCurrentMonth = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'expense' && (
        t.category === 'taxes_sii' || 
        t.category === 'tax_reserve' || 
        (t.concept && (t.concept.toLowerCase().includes('f29') || t.concept.toLowerCase().includes('impuesto') || t.concept.toLowerCase().includes('sii') || t.concept.toLowerCase().includes('previred')))
      ))
      .reduce((sum, t) => sum + t.grossAmount, 0);
  }, [currentMonthTransactions]);

  const totalEstimatedF29 = (ivaSummary.ivaAPagar || 0) + (estimatedPpm || 0);
  const isF29Covered = totalEstimatedF29 > 0 && taxesPaidInCurrentMonth >= totalEstimatedF29;
  const pendingF29 = Math.max(0, totalEstimatedF29 - taxesPaidInCurrentMonth);

  return (
    <div id="dashboard-view-root" className="space-y-6">
      {/* Unified Period Filter Bar */}
      {periodFilter && onChangePeriodFilter && (
        <PeriodFilterBar
          filter={periodFilter}
          onChangeFilter={onChangePeriodFilter}
        />
      )}

      {/* Notice when current period filter has 0 items but database has items */}
      {transactions.length > 0 && activePeriodTransactions.length === 0 && onChangePeriodFilter && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-[#1E40AF]">
            <Info className="w-5 h-5 shrink-0 text-[#2563EB]" />
            <div>
              <p className="font-bold text-sm">
                Hay {transactions.length} movimientos guardados en tu historial, pero ninguno coincide con el filtro actual ({periodFilter ? getPeriodLabel(periodFilter) : ''}).
              </p>
              <p className="text-[#3B82F6] mt-0.5">
                Tus datos no están borrados; están registrados en otras fechas del historial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangePeriodFilter(getPresetPeriod('all'))}
            className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-md shadow-xs shrink-0 cursor-pointer transition-colors"
          >
            Ver Todo el Histórico
          </button>
        </div>
      )}

      {/* Notice when database has 0 items */}
      {transactions.length === 0 && !isCloudNoticeDismissed && (
        <div className="relative bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs shadow-xs">
          <button
            type="button"
            onClick={handleDismissCloudNotice}
            className="absolute top-3 right-3 text-[#92400E]/70 hover:text-[#92400E] p-1.5 rounded-lg hover:bg-[#FDE68A]/70 transition-colors cursor-pointer"
            title="Cerrar este aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 text-[#92400E] pr-7">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#D97706] mt-0.5" />
            <div>
              {currentUser ? (
                <>
                  <p className="font-bold text-sm text-[#1E293B] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    ¡SÍ, ESTÁS CONECTADO CORRECTAMENTE!
                  </p>
                  <p className="text-[#475569] mt-1.5 leading-relaxed">
                    Estás en línea con tu cuenta de Google: <strong className="text-[#0F172A]">{currentUser.email}</strong>. <br/>
                    Sin embargo, tu espacio en la nube actualmente tiene <strong className="text-[#92400E]">0 movimientos</strong> guardados. <br/>
                    <span className="text-[#64748B] mt-1 block">
                      • Si anteriormente cargaste movimientos en tu navegador sin iniciar sesión, haz clic en el botón blanco <strong>"Conectar Nube"</strong> y pulsa el botón naranja <strong>"Subir mis datos actuales a la nube"</strong> para respaldarlos.<br/>
                      • Si iniciaste sesión anteriormente con otra cuenta de Google distinta, haz clic en "Conectar Nube" y luego en <strong>"Cerrar Sesión"</strong> abajo a la derecha, para ingresar con tu cuenta correcta.
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-sm text-[#78350F]">
                    ¿Tenías datos guardados de varios días y no aparecen en pantalla?
                  </p>
                  <p className="text-[#92400E] mt-1 leading-relaxed">
                    Si tenías una cuenta en la Nube con Google, tu sesión puede haberse desconectado temporalmente. Haz clic en el botón <strong>"Conectar Nube"</strong> e ingresa con tu correo para que Firestore recupere todos tus movimientos de inmediato. También puedes importar un respaldo desde Configuración si tienes una copia guardada.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {onOpenCloudAuth && (
              <button
                type="button"
                onClick={onOpenCloudAuth}
                className="flex-1 sm:flex-none px-4 py-2 bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#0F172A] font-bold rounded-lg shadow-xs cursor-pointer transition-colors text-center text-xs"
              >
                Conectar Nube
              </button>
            )}
            <button
              type="button"
              onClick={handleDismissCloudNotice}
              className="px-3.5 py-2 bg-[#FDE68A]/70 hover:bg-[#FDE68A] text-[#92400E] font-bold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Entendido / Ocultar
            </button>
          </div>
        </div>
      )}

      {/* View Header */}
      <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Panel Principal de Control
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Monitoreo en tiempo real del flujo de caja, liquidez bancaria, compromisos y balance F29
            </p>
          </div>
          {periodFilter && (
            <div className="bg-[#F8FAFC] border border-[#CBD5E1] px-3.5 py-2 rounded-md text-xs font-semibold text-[#0F172A] flex items-center gap-2">
              <span className="text-[#64748B] font-normal">Período en análisis:</span>
              <span className="text-[#006C49] font-bold">{getPeriodLabel(periodFilter)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Available Liquidity */}
        <div 
          id="kpi-available-liquidity"
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs hover:border-[#94A3B8] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              LIQUIDEZ DISPONIBLE
            </span>
            <span className="p-1.5 bg-[#DCFCE7] text-[#006C49] rounded-md">
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] font-mono-num mb-1.5">
            {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}
          </div>
          <div className="text-xs text-[#475569] font-medium flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
            <span>Banco: <strong className="text-[#0F172A]">{formatCurrency(bank, settings.currencySymbol, 0)}</strong></span>
            <span>•</span>
            <span>Caja: <strong className="text-[#0F172A]">{formatCurrency(cashDrawer, settings.currencySymbol, 0)}</strong></span>
          </div>
        </div>

        {/* 2. Payables Commitments (30 Days) */}
        <div 
          id="kpi-commitments-30d"
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs hover:border-[#94A3B8] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              PAGOS PRÓXIMOS (30 DÍAS)
            </span>
            <span className={`p-1.5 rounded-md ${payablesMetrics.isFullyFunded ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] font-mono-num mb-1.5">
            {formatCurrency(payablesMetrics.dueIn30Days, settings.currencySymbol, 0)}
          </div>
          <div className="text-xs font-medium pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
            {payablesMetrics.dueIn30Days === 0 ? (
              <span className="text-[#006C49] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sin compromisos inmediatos</span>
              </span>
            ) : payablesMetrics.isFullyFunded ? (
              <span className="text-[#006C49] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% cubierto con caja</span>
              </span>
            ) : (
              <span className="text-[#DC2626] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Déficit de liquidez</span>
              </span>
            )}
            <span className="text-[11px] text-[#64748B]">Total: {sortedPendingPayables.length} cuotas</span>
          </div>
        </div>

        {/* 3. Margen Operativo Real (Current Month) */}
        <div 
          id="kpi-operating-margin"
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs hover:border-[#94A3B8] transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  MARGEN OPERATIVO REAL
                </span>
                <span className="text-[10px] text-[#94A3B8] font-normal">
                  ({formatMonthLabel(currentMonthStr)})
                </span>
              </div>
              <span className={`p-1.5 rounded-md ${operatingMarginPctCurrent >= 0 ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                {operatingMarginPctCurrent >= 0 ? (
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <TrendingDown className="w-4 h-4 stroke-[2.5]" />
                )}
              </span>
            </div>

            {/* Número Principal: Margen Operativo Porcentual */}
            <div className="flex items-baseline gap-2 mb-1.5">
              <div className={`text-3xl font-extrabold font-mono-num tracking-tight ${
                operatingMarginPctCurrent >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
              }`}>
                {operatingMarginPctCurrent >= 0 ? '+' : ''}{operatingMarginPctCurrent.toFixed(1)}%
              </div>
              <span className={`text-[11px] font-semibold ${
                operatingMarginPctCurrent >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
              }`}>
                {operatingMarginPctCurrent >= 0 ? 'Rentabilidad' : 'Déficit'}
              </span>
            </div>

            {/* Utilidad Operativa en Pesos ($) */}
            <div className="text-xs text-[#475569] font-medium flex items-center justify-between py-1 border-t border-[#F1F5F9]">
              <span className="text-[#64748B]">Utilidad Op. (UO):</span>
              <strong className={`font-mono-num ${uoCurrent >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                {uoCurrent >= 0 ? '+' : ''}{formatCurrency(uoCurrent, settings.currencySymbol, 0)}
              </strong>
            </div>

            {/* Desglose transparente: Ventas - Insumos - Fijos */}
            <div className="text-[11px] text-[#475569] font-medium flex items-center justify-between py-1.5 px-2 bg-[#F8FAFC] rounded border border-[#E2E8F0] my-1.5">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#64748B]">Ventas</span>
                <span className="text-[#006C49] font-mono-num font-semibold">+{formatCurrency(itCurrent, settings.currencySymbol, 0)}</span>
              </div>
              <span className="text-[#CBD5E1] font-bold">−</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#64748B]">Insumos</span>
                <span className="text-[#DC2626] font-mono-num font-semibold">-{formatCurrency(cdCurrent, settings.currencySymbol, 0)}</span>
              </div>
              <span className="text-[#CBD5E1] font-bold">−</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#64748B]">Fijos</span>
                <span className="text-[#64748B] font-mono-num font-semibold">-{formatCurrency(goCurrent, settings.currencySymbol, 0)}</span>
              </div>
            </div>
          </div>

          {/* Comparativas al pie: vs Mes Anterior & vs Meta */}
          <div className="text-xs font-medium pt-2 border-t border-[#F1F5F9] flex flex-col gap-0.5 mt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748B]">vs Mes Anterior:</span>
              {hasPrevData ? (
                <span className={`font-semibold font-mono-num ${
                  diffVsPrevMonth >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
                }`}>
                  {diffVsPrevMonth >= 0 ? '+' : ''}{diffVsPrevMonth.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[#94A3B8] font-normal italic">
                  Primer mes registrado
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748B]">vs Meta ({targetOperatingMargin.toFixed(1)}%):</span>
              <span className={`font-semibold font-mono-num ${
                diffVsTarget >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
              }`}>
                {diffVsTarget >= 0 ? '+' : ''}{diffVsTarget.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 4. Tax Forecast (F29 SII) */}
        <div 
          id="kpi-f29-forecast"
          onClick={onOpenF29Modal}
          className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs hover:border-[#006C49] transition-all cursor-pointer group"
          title="Haz clic para ver el desglose y liquidación del Formulario 29"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#64748B] group-hover:text-[#006C49] uppercase tracking-wider transition-colors">
              ESTIMADO F29 (IVA MES)
            </span>
            <span className={`p-1.5 rounded-md ${isF29Covered ? 'bg-[#DCFCE7] text-[#006C49]' : ivaSummary.remanente > 0 ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEF3C7] text-[#D97706]'}`}>
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className={`text-2xl font-bold font-mono-num mb-1.5 ${isF29Covered ? 'text-[#006C49]' : ivaSummary.remanente > 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
            {isF29Covered 
              ? '$0' 
              : ivaSummary.remanente > 0 
                ? `+${formatCurrency(ivaSummary.remanente, settings.currencySymbol, 0)}` 
                : formatCurrency(pendingF29 > 0 ? pendingF29 : ivaSummary.ivaAPagar, settings.currencySymbol, 0)}
          </div>
          <div className="text-xs font-medium pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
            <span className={isF29Covered ? 'text-[#006C49] font-semibold' : ivaSummary.remanente > 0 ? 'text-[#006C49]' : 'text-[#D97706]'}>
              {isF29Covered ? '✓ Cubierto en libro diario' : ivaSummary.remanente > 0 ? 'Remanente a favor' : 'IVA a pagar al SII'}
            </span>
            <span className="text-[11px] text-[#006C49] group-hover:underline font-bold flex items-center gap-0.5">
              <span>{isF29Covered ? 'Ver Detalle' : 'Liquidar F29'}</span>
              <ArrowRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Cash Flow Projections (12M) + 4 Pockets Profit First Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Operational Performance Chart: Daily Flow (Ventas vs Egresos) & Payment Methods */}
        <div className="lg:col-span-8 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 pb-3 border-b border-[#F1F5F9]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                    {operationalChartTab === 'daily_flow' ? 'Flujo Operativo Real (Día a Día)' : 'Recaudación por Medio de Pago'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowChartGuide(!showChartGuide)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] hover:text-[#0369A1] hover:underline cursor-pointer ml-1"
                    title="Ver explicación de este gráfico"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{showChartGuide ? 'Ocultar ayuda' : '¿Cómo leer este gráfico?'}</span>
                  </button>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {operationalChartTab === 'daily_flow' 
                    ? 'Compara cuánto dinero entró (ventas) vs cuánto salió (gastos) en cada día del período seleccionado' 
                    : 'Desglose de recaudación neta, comisiones y volumen según canal de cobro'}
                </p>
              </div>

              {/* View Selector Tabs & Mode Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {operationalChartTab === 'daily_flow' && (
                  <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] mr-1">
                    <button
                      type="button"
                      onClick={() => setDailyChartDisplayMode('comparison')}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                        dailyChartDisplayMode === 'comparison'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                      title="Comparar barras de Ingresos vs Egresos lado a lado desde $0"
                    >
                      Ingresos vs Gastos
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyChartDisplayMode('net_flow')}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                        dailyChartDisplayMode === 'net_flow'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                      title="Ver Ganancia o Pérdida neta de cada día (+ / -)"
                    >
                      Flujo Neto (+/-)
                    </button>
                  </div>
                )}

                <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setOperationalChartTab('daily_flow')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      operationalChartTab === 'daily_flow'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-[#006C49]" />
                    <span>Flujo Diario</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationalChartTab('payment_methods')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      operationalChartTab === 'payment_methods'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Medios de Pago</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory Guide Banner (Toggleable) */}
            {showChartGuide && operationalChartTab === 'daily_flow' && (
              <div className="mb-3 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-xs text-[#166534] space-y-1.5 animate-fadeIn">
                <div className="font-bold flex items-center gap-1.5 text-[#15803D]">
                  <Info className="w-4 h-4" />
                  <span>Guía rápida: ¿Cómo leer este gráfico?</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2 bg-white rounded border border-[#DCFCE7]">
                    <div className="font-bold text-[#059669] flex items-center gap-1 mb-0.5">
                      <span className="w-2.5 h-2.5 bg-[#059669] rounded-xs inline-block"></span>
                      {dailyChartDisplayMode === 'comparison' ? 'Barras Verdes (Ingresos)' : 'Verde hacia arriba (Flujo Positivo +)'}
                    </div>
                    <p className="text-[#334155]">
                      {dailyChartDisplayMode === 'comparison' 
                        ? 'Total cobrado en ventas ese día (boletas, facturas, tarjetas, efectivo).'
                        : 'El día terminó con más cobros que gastos (saldo a favor).'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded border border-[#FEE2E2]">
                    <div className="font-bold text-[#DC2626] flex items-center gap-1 mb-0.5">
                      <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-xs inline-block"></span>
                      {dailyChartDisplayMode === 'comparison' ? 'Barras Rojas (Egresos)' : 'Rojo hacia abajo (Flujo Negativo -)'}
                    </div>
                    <p className="text-[#334155]">
                      {dailyChartDisplayMode === 'comparison' 
                        ? 'Total de gastos pagados ese día (proveedores, arriendos, sueldos).'
                        : 'El día terminó con más gastos pagados que ventas cobradas.'}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded border border-[#DBEAFE]">
                    <div className="font-bold text-[#2563EB] flex items-center gap-1 mb-0.5">
                      <span className="w-2.5 h-1 bg-[#2563EB] rounded-full inline-block"></span>
                      Línea Azul (Balance Acumulado)
                    </div>
                    <p className="text-[#334155]">Muestra la suma acumulada de ingresos menos gastos a medida que avanzan los días del mes.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Chart Legend (Visible above chart) */}
            {operationalChartTab === 'daily_flow' && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-xs">
                <div className="flex items-center gap-2.5 font-semibold flex-wrap">
                  {dailyChartDisplayMode === 'comparison' ? (
                    <>
                      <div className="flex items-center gap-1.5 bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                        <span className="w-2.5 h-2.5 bg-[#059669] rounded-xs inline-block"></span>
                        <span className="text-[#065F46]">Ingresos (Ventas Cobradas)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FEE2E2]">
                        <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-xs inline-block"></span>
                        <span className="text-[#991B1B]">Egresos (Gastos Pagados)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                        <span className="w-2.5 h-2.5 bg-[#059669] rounded-xs inline-block"></span>
                        <span className="text-[#065F46]">Flujo Positivo (+)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FEE2E2]">
                        <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-xs inline-block"></span>
                        <span className="text-[#991B1B]">Flujo Negativo (-)</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-1.5 bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                    <span className="w-3 h-1 bg-[#2563EB] rounded-full inline-block"></span>
                    <span className="text-[#1E40AF]">Balance Acumulado</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#64748B]">
                  Mostrando <strong className="text-[#0F172A]">{dailyFlowData.length}</strong> días con actividad
                </div>
              </div>
            )}

            {/* TAB 1: Daily Flow (Ventas vs Egresos) */}
            {operationalChartTab === 'daily_flow' && (
              <div className="h-64 w-full pt-1">
                {dailyFlowData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <Activity className="w-8 h-8 text-[#94A3B8] mb-2" />
                    <p className="text-sm font-semibold text-[#334155]">No hay movimientos registrados en este período</p>
                    <p className="text-xs text-[#64748B] mt-1">Registra ventas o egresos en el Libro Diario para visualizar el flujo diario en tiempo real.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart 
                      data={dailyFlowData} 
                      margin={{ top: 12, right: 12, left: -10, bottom: 4 }}
                      onClick={(e: any) => {
                        if (e && e.activePayload && e.activePayload[0]) {
                          const date = e.activePayload[0].payload.date;
                          setSelectedDayDetail(selectedDayDetail === date ? null : date);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} 
                        axisLine={{ stroke: '#CBD5E1' }}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={dailyFlowYDomain}
                        tick={{ fill: '#94A3B8', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val: number) => {
                          if (val === 0) return '$0';
                          const abs = Math.abs(val);
                          const prefix = val < 0 ? '-$' : '$';
                          if (abs >= 1000000) return `${prefix}${(abs / 1000000).toFixed(1)}M`;
                          if (abs >= 1000) return `${prefix}${Math.round(abs / 1000)}k`;
                          return `${prefix}${abs}`;
                        }}
                      />
                      {dailyChartDisplayMode === 'net_flow' && (
                        <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" />
                      )}
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            return (
                              <div className="bg-[#0F172A] text-white p-3.5 rounded-xl shadow-2xl border border-[#334155] text-xs space-y-2 min-w-[260px] z-50">
                                <div className="font-bold text-slate-100 border-b border-[#334155] pb-1.5 flex justify-between items-center">
                                  <div>
                                    <p className="text-white font-bold">{item.fullDateLabel || item.label}</p>
                                    <span className="text-[10px] text-[#94A3B8]">Resumen del día</span>
                                  </div>
                                  <span className="text-[10px] bg-[#334155] text-[#E2E8F0] px-2 py-0.5 rounded font-mono">
                                    {item.txCount} mov.
                                  </span>
                                </div>
                                
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[#E2E8F0]">
                                    <span className="flex items-center gap-1.5 text-[#86EFAC]">
                                      <span className="w-2.5 h-2.5 bg-[#059669] rounded-xs inline-block"></span>
                                      Ventas Cobradas (Ingresos):
                                    </span>
                                    <span className="font-bold text-[#86EFAC] font-mono-num">
                                      +{formatCurrency(item.ingresos, settings.currencySymbol, 0)}
                                    </span>
                                  </div>

                                  {item.ivaDebito > 0 && (
                                    <div className="flex justify-between items-center text-[#94A3B8] text-[11px] pl-3.5">
                                      <span>↳ IVA en ventas (al SII):</span>
                                      <span className="text-[#FCA5A5] font-mono-num">
                                        {formatCurrency(item.ivaDebito, settings.currencySymbol, 0)}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center text-[#E2E8F0]">
                                    <span className="flex items-center gap-1.5 text-[#FCA5A5]">
                                      <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-xs inline-block"></span>
                                      Gastos Pagados (Egresos):
                                    </span>
                                    <span className="font-bold text-[#FCA5A5] font-mono-num">
                                      -{formatCurrency(item.egresos, settings.currencySymbol, 0)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center pt-1.5 border-t border-[#334155]">
                                  <span className="text-slate-300 font-medium">Resultado Neto del Día:</span>
                                  <span className={`font-bold font-mono-num text-sm ${item.flujoCajaDia >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                                    {item.flujoCajaDia >= 0 ? '+' : ''}{formatCurrency(item.flujoCajaDia, settings.currencySymbol, 0)}
                                  </span>
                                </div>

                                <div className="pt-2 border-t border-[#334155] bg-[#1E293B]/90 -mx-3.5 px-3.5 py-2 -mb-2 rounded-b-xl">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#93C5FD] font-semibold">Balance acumulado hasta hoy:</span>
                                    <span className={`font-bold font-mono-num ${item.saldoAcumulado >= 0 ? 'text-[#60A5FA]' : 'text-[#F87171]'}`}>
                                      {item.saldoAcumulado >= 0 ? '+' : ''}{formatCurrency(item.saldoAcumulado, settings.currencySymbol, 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {dailyChartDisplayMode === 'comparison' ? (
                        <>
                          <Bar 
                            dataKey="ingresos" 
                            name="Ingresos (Ventas)" 
                            fill="#059669" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={24} 
                          />
                          <Bar 
                            dataKey="egresos" 
                            name="Egresos (Gastos)" 
                            fill="#DC2626" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={24} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="saldoAcumulado" 
                            name="Saldo Acumulado" 
                            stroke="#2563EB" 
                            strokeWidth={2.5} 
                            dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                            activeDot={{ r: 5.5, fill: '#1D4ED8', stroke: '#FFFFFF' }}
                          />
                        </>
                      ) : (
                        <>
                          <Bar 
                            dataKey="flujoCajaDia" 
                            name="Flujo Neto del Día" 
                            radius={[4, 4, 4, 4]} 
                            maxBarSize={28} 
                          >
                            {dailyFlowData.map((entry, index) => (
                              <Cell 
                                key={`net-cell-${index}`} 
                                fill={entry.flujoCajaDia >= 0 ? '#059669' : '#DC2626'} 
                              />
                            ))}
                          </Bar>
                          <Line 
                            type="monotone" 
                            dataKey="saldoAcumulado" 
                            name="Saldo Acumulado" 
                            stroke="#2563EB" 
                            strokeWidth={2.5} 
                            dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                            activeDot={{ r: 5.5, fill: '#1D4ED8', stroke: '#FFFFFF' }}
                          />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Interactive Day Inspector (Click to expand day's transactions) */}
            {operationalChartTab === 'daily_flow' && dailyFlowData.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-[#F1F5F9]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                    Detalle Rápido por Día (Haz clic en un día para ver sus ventas y gastos):
                  </span>
                  {selectedDayDetail && (
                    <button
                      type="button"
                      onClick={() => setSelectedDayDetail(null)}
                      className="text-[11px] text-[#2563EB] hover:underline font-semibold cursor-pointer"
                    >
                      Cerrar detalle
                    </button>
                  )}
                </div>

                {/* Horizontal scrollable day chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {dailyFlowData.map(d => {
                    const isSelected = selectedDayDetail === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setSelectedDayDetail(isSelected ? null : d.date)}
                        className={`px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                          isSelected 
                            ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                            : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#334155] border-[#E2E8F0]'
                        }`}
                      >
                        <span className="font-bold">{d.label}</span>
                        <div className="flex items-center gap-1 text-[11px] font-mono">
                          {d.ingresos > 0 && (
                            <span className={isSelected ? 'text-[#86EFAC]' : 'text-[#059669]'}>
                              +{formatCurrency(d.ingresos, settings.currencySymbol, 0)}
                            </span>
                          )}
                          {d.egresos > 0 && (
                            <span className={isSelected ? 'text-[#FCA5A5]' : 'text-[#DC2626]'}>
                              -{formatCurrency(d.egresos, settings.currencySymbol, 0)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Expanded Day Details Box */}
                {selectedDayDetail && (
                  (() => {
                    const dayObj = dailyFlowData.find(d => d.date === selectedDayDetail);
                    if (!dayObj) return null;
                    return (
                      <div className="mt-2 p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs space-y-2 animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
                          <div>
                            <h4 className="font-bold text-[#0F172A] text-sm">{dayObj.fullDateLabel}</h4>
                            <p className="text-[#64748B] text-[11px]">
                              Total {dayObj.txCount} movimientos registrados ({dayObj.incomeCount} ingresos, {dayObj.expenseCount} egresos)
                            </p>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-[#059669] font-bold">
                              Ingresos: +{formatCurrency(dayObj.ingresos, settings.currencySymbol, 0)}
                            </span>
                            <span className="text-[#DC2626] font-bold">
                              Egresos: -{formatCurrency(dayObj.egresos, settings.currencySymbol, 0)}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-bold ${dayObj.flujoCajaDia >= 0 ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                              Neto: {dayObj.flujoCajaDia >= 0 ? '+' : ''}{formatCurrency(dayObj.flujoCajaDia, settings.currencySymbol, 0)}
                            </span>
                          </div>
                        </div>

                        {/* List of items in that day */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Incomes */}
                          <div>
                            <p className="font-bold text-[#059669] mb-1 flex items-center gap-1">
                              <span>🟢 Ventas e Ingresos ({dayObj.incomeCount})</span>
                            </p>
                            {dayObj.incomesList.length === 0 ? (
                              <p className="text-[#94A3B8] italic text-[11px]">Sin ventas en esta fecha</p>
                            ) : (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {dayObj.incomesList.map((inc, i) => (
                                  <div key={i} className="flex justify-between items-center p-1.5 bg-white rounded border border-[#E2E8F0]">
                                    <span className="text-[#334155] truncate max-w-[180px]">{inc.concept || 'Venta'}</span>
                                    <span className="font-bold text-[#059669] font-mono">+{formatCurrency(inc.amount, settings.currencySymbol, 0)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Expenses */}
                          <div>
                            <p className="font-bold text-[#DC2626] mb-1 flex items-center gap-1">
                              <span>🔴 Gastos y Pagos ({dayObj.expenseCount})</span>
                            </p>
                            {dayObj.expensesList.length === 0 ? (
                              <p className="text-[#94A3B8] italic text-[11px]">Sin gastos en esta fecha</p>
                            ) : (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {dayObj.expensesList.map((exp, i) => (
                                  <div key={i} className="flex justify-between items-center p-1.5 bg-white rounded border border-[#E2E8F0]">
                                    <span className="text-[#334155] truncate max-w-[180px]">{exp.concept || 'Gasto'}</span>
                                    <span className="font-bold text-[#DC2626] font-mono">-{formatCurrency(exp.amount, settings.currencySymbol, 0)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* TAB 2: Recaudación por Medios de Pago */}
            {operationalChartTab === 'payment_methods' && (
              <div className="h-64 w-full overflow-y-auto pr-1 space-y-3 pt-1">
                {paymentMethodsData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <CreditCard className="w-8 h-8 text-[#94A3B8] mb-2" />
                    <p className="text-sm font-semibold text-[#334155]">Sin ventas registradas en este período</p>
                    <p className="text-xs text-[#64748B] mt-1">Registra cobros con tarjeta, efectivo o transferencias para analizar tus canales.</p>
                  </div>
                ) : (
                  paymentMethodsData.map(channel => (
                    <div key={channel.channel} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-colors">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#0F172A]">{channel.label}</span>
                          <span className="text-[10px] text-[#64748B] bg-white border border-[#E2E8F0] px-1.5 py-0.2 rounded font-medium">
                            {channel.count} {channel.count === 1 ? 'venta' : 'ventas'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs font-mono-num text-[#006C49]">
                            {formatCurrency(channel.net, settings.currencySymbol, 0)}
                          </span>
                          <span className="text-[11px] font-bold text-[#64748B] ml-1.5">
                            ({channel.pct}%)
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#006C49] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.max(4, channel.pct)}%` }}
                        />
                      </div>

                      {/* Fees / Pasarela breakdown */}
                      <div className="flex justify-between items-center text-[10px] text-[#64748B] mt-1.5 pt-1 border-t border-[#F1F5F9]">
                        <span>Bruto cobrado: <strong className="text-[#334155]">{formatCurrency(channel.gross, settings.currencySymbol, 0)}</strong></span>
                        <span>Comisión pasarela: <strong className={channel.fees > 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}>{channel.fees > 0 ? `-${formatCurrency(channel.fees, settings.currencySymbol, 0)}` : '$0'}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bottom Operational Summary Bar */}
          <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#475569]">
              <Target className="w-4 h-4 text-[#2563EB]" />
              <span>
                Mejor Día de Ventas: <strong>{operationalMetrics.bestDay.amount > 0 ? `${operationalMetrics.bestDay.label} (${formatCurrency(operationalMetrics.bestDay.amount, settings.currencySymbol, 0)})` : 'Sin ventas aún'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[#475569]">
              <Activity className="w-4 h-4 text-[#006C49]" />
              <span>
                Promedio de Ventas: <strong>{formatCurrency(operationalMetrics.avgDailySales, settings.currencySymbol, 0)}/día con actividad</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('registry')}
                className="text-xs font-bold text-[#0F172A] hover:text-[#006C49] flex items-center gap-1 cursor-pointer transition-colors"
                title="Ir al Libro Diario para ver y exportar todas las transacciones"
              >
                <span>Ver Libro Diario</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <span className="text-[#CBD5E1] hidden sm:inline">•</span>

              <button
                id="btn-view-cashflow-30"
                type="button"
                onClick={() => onNavigate('cashflow30')}
                className="text-xs font-semibold text-[#64748B] hover:text-[#0284C7] hover:underline cursor-pointer transition-colors"
                title="Crédito y Cobranza (Flujo 30/60/90 Días)"
              >
                <span>Crédito y Cobranza</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Pockets Profit First Allocation Card */}
        <div className="lg:col-span-4 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                Distribución 4 Bolsillos
              </h3>
              <span className="text-[10px] font-semibold text-[#475569] bg-[#F1F5F9] border border-[#CBD5E1] px-2 py-0.5 rounded">
                {periodFilter ? getPeriodLabel(periodFilter) : formatMonthLabel(currentMonthStr)}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mb-4">
              Asignación teórica vs. gasto real ejecutado sobre ingresos del período
            </p>

            {/* Pockets List with Actual Money Amounts */}
            <div className="space-y-3.5">
              {/* 1. Profit / Vault (5%) */}
              <div className="bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-[#0F172A]">GANANCIA / FONDO ({settings.pocketConfig.profit}%)</span>
                  <span className="text-[#006C49] font-mono-num">
                    {formatCurrency(pockets.theoretical.profit, settings.currencySymbol, 0)}
                  </span>
                </div>
                <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden mb-1">
                  <div 
                    className="bg-[#006C49] h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (pockets.percentages.profit / settings.pocketConfig.profit) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>Ejecutado: {formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)}</span>
                  <span className="font-semibold text-[#006C49]">{pockets.percentages.profit}%</span>
                </div>
              </div>

              {/* 2. Taxes (20%) */}
              <div className="bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-[#0F172A]">IMPUESTOS / IVA ({settings.pocketConfig.taxes}%)</span>
                  <span className="text-[#D97706] font-mono-num">
                    {formatCurrency(pockets.theoretical.taxes, settings.currencySymbol, 0)}
                  </span>
                </div>
                <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden mb-1">
                  <div 
                    className="bg-[#D97706] h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (pockets.percentages.taxes / settings.pocketConfig.taxes) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>Pagado: {formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)}</span>
                  <span className="font-semibold text-[#D97706]">{pockets.percentages.taxes}%</span>
                </div>
              </div>

              {/* 3. Owner's Pay (20%) */}
              <div className="bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-[#0F172A]">SUELDO DEL DUEÑO ({settings.pocketConfig.ownerPay}%)</span>
                  <span className="text-[#2563EB] font-mono-num">
                    {formatCurrency(pockets.theoretical.owner, settings.currencySymbol, 0)}
                  </span>
                </div>
                <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden mb-1">
                  <div 
                    className="bg-[#2563EB] h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (pockets.percentages.owner / settings.pocketConfig.ownerPay) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>Retirado: {formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)}</span>
                  <span className="font-semibold text-[#2563EB]">{pockets.percentages.owner}%</span>
                </div>
              </div>

              {/* 4. OpEx (55%) */}
              <div className="bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-[#0F172A]">COSTOS OPERATIVOS ({settings.pocketConfig.opEx}%)</span>
                  <span className="text-[#0F172A] font-mono-num">
                    {formatCurrency(pockets.theoretical.opEx, settings.currencySymbol, 0)}
                  </span>
                </div>
                <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden mb-1">
                  <div 
                    className={`h-1.5 rounded-full ${pockets.percentages.opEx > settings.pocketConfig.opEx ? 'bg-[#DC2626]' : 'bg-[#0F172A]'}`}
                    style={{ width: `${Math.min(100, (pockets.percentages.opEx / settings.pocketConfig.opEx) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>Gastado: {formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)}</span>
                  <span className={`font-semibold ${pockets.percentages.opEx > settings.pocketConfig.opEx ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                    {pockets.percentages.opEx}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            id="btn-nav-distribution"
            type="button"
            onClick={() => onNavigate('distribution')}
            className="w-full mt-4 py-2 px-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Ver Calculadora de Distribución</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Grid: 3 Clean Operational Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Próximos Vencimientos y Cuentas por Pagar / Cobrar */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-1.5 p-0.5 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setCommitmentsTab('payables')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    commitmentsTab === 'payables'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Por Pagar ({sortedPendingPayables.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommitmentsTab('receivables')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    commitmentsTab === 'receivables'
                      ? 'bg-white text-[#0284C7] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0284C7]'
                  }`}
                >
                  Por Cobrar ({sortedPendingReceivables.length})
                </button>
              </div>

              {commitmentsTab === 'payables' ? (
                <button
                  id="btn-nav-payables-all"
                  type="button"
                  onClick={() => onNavigate('payables')}
                  className="text-xs text-[#006C49] hover:underline font-bold cursor-pointer"
                >
                  Ver Todas
                </button>
              ) : (
                <button
                  id="btn-nav-receivables-all"
                  type="button"
                  onClick={() => onNavigate('cashflow30')}
                  className="text-xs text-[#0284C7] hover:underline font-bold cursor-pointer"
                >
                  Gestionar
                </button>
              )}
            </div>

            {commitmentsTab === 'payables' ? (
              <div className="divide-y divide-[#F1F5F9] mt-2">
                {upcomingPayables.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#94A3B8]">
                    <CheckCircle2 className="w-6 h-6 text-[#006C49] mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-[#0F172A]">¡Sin cuentas pendientes!</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">Todas tus compras y facturas están al día.</p>
                  </div>
                ) : (
                  upcomingPayables.map((p) => {
                    const badge = getDueBadge(p.dueDate);
                    return (
                      <div key={p.id} className="py-2.5 flex items-center justify-between hover:bg-[#F8FAFC] px-1 rounded transition-colors">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[#0F172A]">
                            {p.vendor}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                              {badge.text}
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              {p.concept}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#0F172A] font-mono-num">
                            {formatCurrency(p.remainingAmount, settings.currencySymbol, 0)}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">
                            Cuota {p.currentInstallment}/{p.installmentCount}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9] mt-2">
                {upcomingReceivables.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#94A3B8]">
                    <CheckCircle2 className="w-6 h-6 text-[#0284C7] mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-[#0F172A]">¡Sin cobros pendientes!</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">Todos tus clientes tienen su saldo al día.</p>
                  </div>
                ) : (
                  upcomingReceivables.map((r) => {
                    const badge = getDueBadge(r.dueDate);
                    return (
                      <div key={r.id} className="py-2.5 flex items-center justify-between hover:bg-[#F8FAFC] px-1 rounded transition-colors">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[#0F172A]">
                            {r.clientName}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                              {badge.text}
                            </span>
                            <span className="text-[11px] text-[#64748B] truncate max-w-[140px]">
                              {r.concept}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#0284C7] font-mono-num">
                            {formatCurrency(r.remainingAmount, settings.currencySymbol, 0)}
                          </div>
                          {r.docNumber && (
                            <div className="text-[10px] text-[#94A3B8]">
                              Doc: {r.docNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
            <span>{commitmentsTab === 'payables' ? 'Total por pagar:' : 'Total por cobrar:'}</span>
            <span className={`font-bold font-mono-num ${commitmentsTab === 'payables' ? 'text-[#0F172A]' : 'text-[#0284C7]'}`}>
              {formatCurrency(
                commitmentsTab === 'payables' ? payablesMetrics.totalOutstanding : totalPendingReceivablesAmount,
                settings.currencySymbol,
                0
              )}
            </span>
          </div>
        </div>

        {/* Col 2: Resumen Tributario F29 (SII) */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1 pb-3 border-b border-[#F1F5F9]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                    Balance Tributario F29 (SII)
                  </h3>
                  {isF29Covered && (
                    <span className="text-[10px] font-bold bg-[#DCFCE7] text-[#006C49] border border-[#86EFAC] px-1.5 py-0.5 rounded">
                      ✓ Cubierto
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Período: {formatMonthLabel(currentMonthStr)} • Vence: 20 del próximo mes
                </p>
              </div>
              {onOpenF29Modal && (
                <button
                  type="button"
                  onClick={onOpenF29Modal}
                  className="text-xs bg-[#0F172A] hover:bg-[#1E293B] text-white px-2.5 py-1 rounded font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                >
                  <span>{isF29Covered ? 'Ver F29' : 'Liquidar F29'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-2.5 text-xs mt-3">
              <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">(+) IVA Débito (Ventas con Boleta/Factura)</span>
                <span className="font-bold text-[#0F172A] font-mono-num">
                  {formatCurrency(ivaSummary.ivaDebito, settings.currencySymbol, 0)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">(-) IVA Crédito (Compras con Factura)</span>
                <span className="font-bold text-[#006C49] font-mono-num">
                  - {formatCurrency(ivaSummary.ivaCredito, settings.currencySymbol, 0)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                <span className="font-bold text-[#0F172A]">
                  {ivaSummary.ivaAPagar > 0 ? '(=) IVA Neto Determinado' : '(=) Remanente a Favor'}
                </span>
                <span className={`font-bold font-mono-num text-sm ${ivaSummary.ivaAPagar > 0 ? 'text-[#DC2626]' : 'text-[#006C49]'}`}>
                  {formatCurrency(ivaSummary.ivaAPagar > 0 ? ivaSummary.ivaAPagar : ivaSummary.remanente, settings.currencySymbol, 0)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9] text-[11px] text-[#64748B]">
                <span>(+) PPM Estimado (1% s/Venta Neta):</span>
                <span className="font-semibold text-[#0F172A] font-mono-num">
                  {formatCurrency(estimatedPpm, settings.currencySymbol, 0)}
                </span>
              </div>

              {taxesPaidInCurrentMonth > 0 && (
                <>
                  <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9] text-[11px] text-[#006C49]">
                    <span className="font-medium">(-) Impuestos Pagados / Provisionados:</span>
                    <span className="font-bold font-mono-num">
                      - {formatCurrency(taxesPaidInCurrentMonth, settings.currencySymbol, 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-[#0F172A]">
                      Saldo Pendiente F29:
                    </span>
                    <span className={`font-bold font-mono-num text-sm ${pendingF29 > 0 ? 'text-[#DC2626]' : 'text-[#006C49]'}`}>
                      {pendingF29 > 0 ? formatCurrency(pendingF29, settings.currencySymbol, 0) : '$0 (Al día / Cubierto)'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#64748B] flex-shrink-0 mt-0.5" />
              <p>El valor oficial se concilia en el Registro de Compras y Ventas del SII antes del día 20.</p>
            </div>
          </div>
        </div>

        {/* Col 3: Movimientos Recientes con Detalle Transparente */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1 pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Movimientos Recientes
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Últimos cobros, compras y retiros registrados
                </p>
              </div>
              <button
                id="btn-nav-registry-all"
                type="button"
                onClick={() => onNavigate('registry')}
                className="text-xs text-[#006C49] hover:underline font-bold cursor-pointer"
              >
                Ver Todos
              </button>
            </div>

            <div className="space-y-2 mt-2">
              {recentTransactions.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#94A3B8]">
                  <p>Aún no hay transacciones registradas.</p>
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const categoryLabel = tx.category ? CATEGORY_NAMES[tx.category] || tx.category : 'Venta';
                  const paymentLabel = tx.paymentMethod ? PAYMENT_LABELS[tx.paymentMethod] : (tx.outflowMethod === 'cash_drawer' ? 'Caja Gaveta' : 'Banco');

                  return (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-[#F8FAFC] transition-colors border border-transparent hover:border-[#E2E8F0]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIncome ? 'bg-[#DCFCE7] text-[#006C49]' : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}>
                          {isIncome ? (
                            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#0F172A] truncate max-w-[140px]">
                            {tx.concept}
                          </div>
                          <div className="text-[10px] text-[#64748B] flex items-center gap-1">
                            <span>{paymentLabel}</span>
                            <span>•</span>
                            <span>{tx.date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-xs font-bold font-mono-num ${
                          isIncome ? 'text-[#006C49]' : 'text-[#DC2626]'
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(isIncome ? tx.netAmount : tx.grossAmount, settings.currencySymbol, 0)}
                        </div>
                        <div className="text-[10px] text-[#64748B]">
                          {tx.docType === 'factura' ? 'Factura' : tx.docType === 'boleta' ? 'Boleta' : isIncome ? 'Venta' : 'Egreso'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            id="btn-nav-registry-cta"
            type="button"
            onClick={() => onNavigate('registry')}
            className="w-full mt-4 py-2 px-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-md text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Ir al Arqueo y Registro Diario</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
