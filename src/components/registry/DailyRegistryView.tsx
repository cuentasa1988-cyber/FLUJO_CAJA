import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Search, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Calendar,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Pencil,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Check,
  FileText,
  CreditCard,
  Building2,
  Landmark,
  CalendarDays,
  Coins,
  UserPlus,
  UserMinus,
  Percent,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { 
  AppSettings, 
  CashDenominations, 
  DailyClosure, 
  ExpenseCategory, 
  OutflowMethod, 
  PaymentChannel, 
  Payable,
  Transaction,
  DatePeriodFilter 
} from '../../types';
import { 
  calculateDailyMetrics, 
  calculatePaymentFee, 
  calculatePocketAllocation, 
  calculatePeriodTransactionsMetrics,
  calculateCurrentLiquidity,
  formatCurrency 
} from '../../utils/financial';
import { 
  getDefaultPeriodFilter, 
  isDateInPeriod, 
  getPeriodLabel,
  getTodayString,
  getPresetPeriod
} from '../../utils/dateFilter';
import { PeriodFilterBar } from '../common/PeriodFilterBar';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { NewTransactionModal } from '../modals/NewTransactionModal';

interface DailyRegistryViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  closures: DailyClosure[];
  onAddTransaction: (tx: Transaction) => void;
  onUpdateTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onSaveClosure: (closure: DailyClosure) => void;
  onDeleteClosure?: (id: string) => void;
  onClearClosures?: () => void;
  onCleanDuplicateClosures?: () => void;
  onAddPayable?: (p: Payable) => void;
  onOpenF29Modal?: (month?: string) => void;
  periodFilter?: DatePeriodFilter;
  onChangePeriodFilter?: (filter: DatePeriodFilter) => void;
  onResetDemoData?: () => void;
  onOpenCloudAuth?: () => void;
  currentUser?: any;
}

export const DailyRegistryView: React.FC<DailyRegistryViewProps> = ({
  settings,
  transactions,
  closures,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onSaveClosure,
  onDeleteClosure,
  onClearClosures,
  onCleanDuplicateClosures,
  onAddPayable,
  onOpenF29Modal,
  periodFilter: propPeriodFilter,
  onChangePeriodFilter: propOnChangePeriodFilter,
  onResetDemoData,
  onOpenCloudAuth,
  currentUser,
}) => {
  // Period filter state
  const [localPeriodFilter, setLocalPeriodFilter] = useState<DatePeriodFilter>(() => {
    // Start with today mode for daily operations, or month
    const today = getTodayString();
    return {
      mode: 'day',
      selectedDate: today,
      startDate: today,
      endDate: today,
      selectedMonth: today.substring(0, 7),
      startMonth: today.substring(0, 7),
      endMonth: today.substring(0, 7),
    };
  });

  const periodFilter = propPeriodFilter || localPeriodFilter;
  const setPeriodFilter = propOnChangePeriodFilter || setLocalPeriodFilter;

  // Modal states
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isNewTxOpen, setIsNewTxOpen] = useState<boolean>(false);
  const [newTxType, setNewTxType] = useState<'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal' | 'payable'>('income');

  const [currentShift, setCurrentShift] = useState<string>('Turno Mañana');
  const [isCashDrawerCollapsed, setIsCashDrawerCollapsed] = useState<boolean>(false);

  // Tab filter: 'all' | 'income' | 'expense' | 'partners'
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'income' | 'expense' | 'partners'>('all');
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'movements' | 'audits'>('movements');
  const [closureSuccessMsg, setClosureSuccessMsg] = useState<string | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState<boolean>(false);
  const [showPriorCashDetails, setShowPriorCashDetails] = useState<boolean>(false);

  const [isCloudNoticeDismissed, setIsCloudNoticeDismissed] = useState<boolean>(() => {
    return localStorage.getItem('dismissed_zero_cloud_banner_v1') === 'true';
  });

  const handleDismissCloudNotice = () => {
    setIsCloudNoticeDismissed(true);
    localStorage.setItem('dismissed_zero_cloud_banner_v1', 'true');
  };

  // Physical Cash drawer denomination state for reconciliation
  const [denominations, setDenominations] = useState<CashDenominations>({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0, coins: 0,
    b20000: 0, b10000: 0, b5000: 0, b2000: 0, b1000: 0, c500: 0, c100: 0, c50: 0, c10: 0
  });

  const handleResetDenominations = () => {
    setDenominations({
      b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0, coins: 0,
      b20000: 0, b10000: 0, b5000: 0, b2000: 0, b1000: 0, c500: 0, c100: 0, c50: 0, c10: 0
    });
  };

  const handleAutoFillExpectedCash = (targetAmount: number) => {
    const target = Math.max(0, Math.round(targetAmount));
    if (settings.currency === 'CLP') {
      let rem = target;
      const b20k = Math.floor(rem / 20000); rem %= 20000;
      const b10k = Math.floor(rem / 10000); rem %= 10000;
      const b5k = Math.floor(rem / 5000); rem %= 5000;
      const b2k = Math.floor(rem / 2000); rem %= 2000;
      const b1k = Math.floor(rem / 1000); rem %= 1000;
      const c500 = Math.floor(rem / 500); rem %= 500;
      const c100 = Math.floor(rem / 100); rem %= 100;
      const c50 = Math.floor(rem / 50); rem %= 50;
      const c10 = Math.floor(rem / 10); rem %= 10;
      setDenominations({
        b20000: b20k,
        b10000: b10k,
        b5000: b5k,
        b2000: b2k,
        b1000: b1k,
        c500,
        c100,
        c50,
        c10,
        coins: rem,
        b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0
      });
    } else {
      let rem = target;
      const b100 = Math.floor(rem / 100); rem %= 100;
      const b50 = Math.floor(rem / 50); rem %= 50;
      const b20 = Math.floor(rem / 20); rem %= 20;
      const b10 = Math.floor(rem / 10); rem %= 10;
      const b5 = Math.floor(rem / 5); rem %= 5;
      const b1 = Math.floor(rem); rem -= b1;
      setDenominations({
        b100, b50, b20, b10, b5, b1,
        coins: Number(rem.toFixed(2)),
        b20000: 0, b10000: 0, b5000: 0, b2000: 0, b1000: 0, c500: 0, c100: 0, c50: 0, c10: 0
      });
    }
  };

  useEffect(() => {
    if (transactions.length === 0) {
      setDenominations({
        b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0, coins: 0,
        b20000: 0, b10000: 0, b5000: 0, b2000: 0, b1000: 0, c500: 0, c100: 0, c50: 0, c10: 0
      });
    }
  }, [transactions.length]);

  // Filter all transactions by active period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => isDateInPeriod(t.date, periodFilter));
  }, [transactions, periodFilter]);

  // Compute period metrics
  const periodMetrics = useMemo(() => {
    return calculatePeriodTransactionsMetrics(periodTransactions, settings.startingCashDrawer);
  }, [periodTransactions, settings.startingCashDrawer]);

  // Real-time Liquidity (Bank account and Cash Drawer)
  const { bank, cashDrawer, totalLiquidity } = useMemo(() => {
    return calculateCurrentLiquidity(settings, transactions, []);
  }, [settings, transactions]);

  // Daily Metrics for single-day cash count (used when mode === 'day')
  const activeDayDate = periodFilter.mode === 'day' ? periodFilter.selectedDate : getTodayString();

  // Opening cash for activeDayDate: considers startingCashDrawer + all previous cash movements
  const dayOpeningCash = useMemo(() => {
    let cash = settings.startingCashDrawer;
    for (const tx of transactions) {
      if (tx.date < activeDayDate) {
        if (tx.type === 'income' && tx.paymentMethod === 'cash') {
          cash += tx.netAmount;
        } else if (tx.type === 'expense' && tx.outflowMethod === 'cash_drawer') {
          cash -= tx.grossAmount;
        } else if (tx.type === 'capital_contribution' && (tx.paymentMethod === 'cash' || tx.outflowMethod === 'cash_drawer')) {
          cash += (tx.netAmount || tx.grossAmount);
        } else if (tx.type === 'partner_withdrawal' && (tx.outflowMethod === 'cash_drawer' || tx.paymentMethod === 'cash')) {
          cash -= tx.grossAmount;
        }
      }
    }
    return Math.max(0, cash);
  }, [settings.startingCashDrawer, transactions, activeDayDate]);

  const dailyMetrics = useMemo(() => {
    return calculateDailyMetrics(activeDayDate, transactions, dayOpeningCash);
  }, [activeDayDate, transactions, dayOpeningCash]);

  // Prior cash movements before activeDayDate that affected opening cash
  const priorCashMovements = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.date >= activeDayDate) return false;
      if (tx.type === 'income' && tx.paymentMethod === 'cash') return true;
      if (tx.type === 'expense' && tx.outflowMethod === 'cash_drawer') return true;
      if (tx.type === 'capital_contribution' && (tx.paymentMethod === 'cash' || tx.outflowMethod === 'cash_drawer')) return true;
      if (tx.type === 'partner_withdrawal' && (tx.outflowMethod === 'cash_drawer' || tx.paymentMethod === 'cash')) return true;
      return false;
    });
  }, [transactions, activeDayDate]);

  const priorCashChange = dayOpeningCash - settings.startingCashDrawer;

  // Physical Cash Counted Total for Day Reconciliation
  const countedCash = settings.currency === 'CLP' 
    ? (
      ((denominations.b20000 || 0) * 20000) +
      ((denominations.b10000 || 0) * 10000) +
      ((denominations.b5000 || 0) * 5000) +
      ((denominations.b2000 || 0) * 2000) +
      ((denominations.b1000 || 0) * 1000) +
      ((denominations.c500 || 0) * 500) +
      ((denominations.c100 || 0) * 100) +
      ((denominations.c50 || 0) * 50) +
      ((denominations.c10 || 0) * 10) +
      (Number(denominations.coins) || 0)
    )
    : (
      ((denominations.b100 || 0) * 100) +
      ((denominations.b50 || 0) * 50) +
      ((denominations.b20 || 0) * 20) +
      ((denominations.b10 || 0) * 10) +
      ((denominations.b5 || 0) * 5) +
      ((denominations.b1 || 0) * 1) +
      (Number(denominations.coins) || 0)
    );

  const variance = countedCash - dailyMetrics.expectedCashDrawer;

  // Closures filtered by period
  const periodClosures = useMemo(() => {
    return closures.filter(c => isDateInPeriod(c.date, periodFilter));
  }, [closures, periodFilter]);

  // Check if there are duplicate closures (same date and shift)
  const duplicateClosuresCount = useMemo(() => {
    const keys = new Set<string>();
    let duplicates = 0;
    periodClosures.forEach(c => {
      const key = `${c.date}-${c.shift}`;
      if (keys.has(key)) {
        duplicates++;
      } else {
        keys.add(key);
      }
    });
    return duplicates;
  }, [periodClosures]);

  const latestClosure = periodClosures.length > 0 ? periodClosures[0] : null;
  const existingClosureForCurrentShift = useMemo(() => {
    return periodClosures.find(c => c.date === activeDayDate && c.shift === currentShift);
  }, [periodClosures, activeDayDate, currentShift]);

  const totalPeriodVariance = periodClosures.reduce((acc, c) => acc + c.variance, 0);
  const totalPeriodCountedCash = periodClosures.reduce((acc, c) => acc + c.countedCash, 0);

  // Open modal helper
  const handleOpenAddModal = (type: 'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal') => {
    setNewTxType(type);
    setIsNewTxOpen(true);
  };

  // Save Day Closure
  const handleSaveDayClosure = (e: React.FormEvent) => {
    e.preventDefault();

    const newClosure: DailyClosure = {
      id: existingClosureForCurrentShift ? existingClosureForCurrentShift.id : `close-${Date.now()}`,
      date: activeDayDate,
      shift: currentShift,
      openingCash: dayOpeningCash,
      cashSales: dailyMetrics.cashSales,
      cashExpenses: dailyMetrics.cashExpenses,
      systemExpectedCash: dailyMetrics.expectedCashDrawer,
      countedCash,
      variance,
      denominations,
      closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      closedBy: 'Turno Activo',
    };

    onSaveClosure(newClosure);
    setClosureSuccessMsg(
      existingClosureForCurrentShift 
        ? `¡Arqueo actualizado con éxito! Contado: ${formatCurrency(countedCash, settings.currencySymbol)} | Dif: ${formatCurrency(variance, settings.currencySymbol)}`
        : `¡Arqueo y Cierre guardado! Contado: ${formatCurrency(countedCash, settings.currencySymbol)} | Dif: ${formatCurrency(variance, settings.currencySymbol)}`
    );
    setTimeout(() => {
      setClosureSuccessMsg(null);
    }, 5000);
  };

  // Export Period CSV report
  const handleExportPeriodReport = () => {
    const csvContent = [
      ['Fecha', 'Hora', 'Tipo', 'Documento', 'Concepto', 'Metodo/Categoria', 'Total Bruto', 'Comision Tarjeta Retenida', 'IVA 19%', 'Flujo Real Banco/Caja'],
      ...periodTransactions.map(tx => [
        tx.date,
        tx.time,
        tx.type === 'income' ? 'Ingreso' : 'Egreso',
        tx.docType || (tx.type === 'income' ? 'boleta' : tx.hasFactura ? 'factura' : 'sin_doc'),
        `"${tx.concept}"`,
        tx.type === 'income' ? tx.paymentMethod : tx.category,
        tx.grossAmount.toFixed(2),
        (tx.feeAmount || 0).toFixed(2),
        (tx.ivaAmount || 0).toFixed(2),
        (tx.type === 'income' ? tx.netAmount : -tx.grossAmount).toFixed(2),
      ]),
      [],
      ['--- RESUMEN DEL PERIODO SELECCIONADO ---'],
      ['Periodo', getPeriodLabel(periodFilter)],
      ['Total Ingresos Brutos', periodMetrics.grossRevenue.toFixed(2)],
      ['Total Comisiones Tarjetas (-)', periodMetrics.processingFees.toFixed(2)],
      ['Total Ingresos Netos Líquidos', periodMetrics.netRevenue.toFixed(2)],
      ['Total Egresos / Gastos', periodMetrics.totalExpenses.toFixed(2)],
      ['Resultado Operativo Neto', periodMetrics.netOperatingCashFlow.toFixed(2)],
      ['Margen Operativo (%)', `${periodMetrics.operatingMargin}%`],
      ['IVA Débito (Ventas)', periodMetrics.ivaSummary.ivaDebito.toFixed(2)],
      ['IVA Crédito (Compras Factura)', periodMetrics.ivaSummary.ivaCredito.toFixed(2)],
      ['IVA a Pagar F29', periodMetrics.ivaSummary.ivaAPagar.toFixed(2)],
      ['Remanente IVA a Favor', periodMetrics.ivaSummary.remanente.toFixed(2)],
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Movimientos_${periodFilter.mode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter transactions for table
  const filteredEntries = useMemo(() => {
    return periodTransactions.filter(tx => {
      // Tab Type filter
      if (activeTabFilter === 'income' && tx.type !== 'income') return false;
      if (activeTabFilter === 'expense' && tx.type !== 'expense') return false;
      if (activeTabFilter === 'partners' && tx.type !== 'capital_contribution' && tx.type !== 'partner_withdrawal') return false;

      // Text search filter
      if (!historyFilter) return true;
      const q = historyFilter.toLowerCase();
      return tx.concept.toLowerCase().includes(q) ||
             (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q)) ||
             (tx.category && tx.category.toLowerCase().includes(q)) ||
             (tx.docNumber && tx.docNumber.toLowerCase().includes(q));
    });
  }, [periodTransactions, activeTabFilter, historyFilter]);

  // Tab counts & sums
  const incomeTxs = periodTransactions.filter(t => t.type === 'income');
  const expenseTxs = periodTransactions.filter(t => t.type === 'expense');
  const partnerTxs = periodTransactions.filter(t => t.type === 'capital_contribution' || t.type === 'partner_withdrawal');

  const incomeCount = incomeTxs.length;
  const expenseCount = expenseTxs.length;
  const partnerCount = partnerTxs.length;
  const totalCount = periodTransactions.length;

  const totalGrossIncome = incomeTxs.reduce((acc, t) => acc + t.grossAmount, 0);
  const totalGrossExpense = expenseTxs.reduce((acc, t) => acc + t.grossAmount, 0);

  // IVA Débito vs IVA Crédito
  const totalIvaDebito = periodMetrics.ivaSummary.ivaDebito;
  const totalIvaCredito = periodMetrics.ivaSummary.ivaCredito;
  const netIvaBalance = totalIvaDebito - totalIvaCredito;

  // Table summary for current filtered view
  const currentSummary = useMemo(() => {
    let gross = 0;
    let fees = 0;
    let ivaDebito = 0;
    let ivaCredito = 0;
    let realFlow = 0;

    filteredEntries.forEach(tx => {
      if (tx.type === 'income') {
        gross += tx.grossAmount;
        fees += (tx.feeAmount || 0);
        const hasTax = tx.docType === 'factura' || tx.docType === 'boleta' || tx.hasFactura || (tx.ivaAmount !== undefined && tx.ivaAmount > 0);
        const iva = (tx.ivaAmount !== undefined && tx.ivaAmount > 0) ? tx.ivaAmount : (hasTax ? (tx.grossAmount - (tx.grossAmount / 1.19)) : 0);
        ivaDebito += iva;
        realFlow += tx.netAmount;
      } else if (tx.type === 'expense') {
        gross -= tx.grossAmount;
        const isFactura = tx.docType === 'factura' || tx.hasFactura;
        const iva = isFactura ? (tx.ivaAmount || (tx.grossAmount - (tx.grossAmount / 1.19))) : 0;
        ivaCredito += iva;
        realFlow -= (tx.netAmount !== undefined ? tx.netAmount : tx.grossAmount);
      } else if (tx.type === 'capital_contribution') {
        gross += tx.grossAmount;
        realFlow += tx.grossAmount;
      } else if (tx.type === 'partner_withdrawal') {
        gross -= tx.grossAmount;
        realFlow -= tx.grossAmount;
      }
    });

    return { gross, fees, ivaDebito, ivaCredito, realFlow };
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* Unified Period Filter Bar */}
      <PeriodFilterBar
        filter={periodFilter}
        onChangeFilter={setPeriodFilter}
      />

      {/* Notice when current period filter has 0 items but database has items */}
      {transactions.length > 0 && periodTransactions.length === 0 && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-[#1E40AF]">
            <Info className="w-5 h-5 shrink-0 text-[#2563EB]" />
            <div>
              <p className="font-bold text-sm">
                Hay {transactions.length} movimientos guardados en tu historial, pero ninguno coincide con el filtro actual ({getPeriodLabel(periodFilter)}).
              </p>
              <p className="text-[#3B82F6] mt-0.5">
                Tus datos no están borrados; están registrados en otras fechas del historial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPeriodFilter(getPresetPeriod('all'))}
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
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#D97706] mt-0.5" />
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

      {/* Header with Quick Action Buttons & Current Shift */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Registro y Movimientos
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            {periodFilter.mode === 'day' 
              ? 'Arqueo de caja diaria, ventas con boleta, compras con factura y movimientos de socios'
              : 'Consolidado acumulado de ingresos, egresos, socios y balance tributario F29'}
          </p>
        </div>

        {/* Prominent Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={() => handleOpenAddModal('income')}
            className="flex-1 sm:flex-none bg-[#006C49] hover:bg-[#005538] text-white px-4 py-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 text-[#86EFAC]" />
            <span>Registrar Ingreso (Boleta/Venta)</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('expense')}
            className="flex-1 sm:flex-none bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-[#FCA5A5]" />
            <span>Registrar Egreso (Factura/Gasto)</span>
          </button>

          <button
            onClick={() => handleOpenAddModal('capital_contribution')}
            className="flex-1 sm:flex-none bg-[#0284C7] hover:bg-[#0369A1] text-white px-3.5 py-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#BAE6FD]" />
            <span>Aporte / Retiro Socio</span>
          </button>

          <button
            onClick={handleExportPeriodReport}
            className="bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] px-3.5 py-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            title="Descargar archivo CSV del período filtrado"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006C49]" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Notification banner if closure saved */}
      {closureSuccessMsg && (
        <div className="p-3.5 bg-[#DCFCE7] border border-[#86EFAC] text-[#006C49] rounded-md text-xs font-semibold flex items-center justify-between animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{closureSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setClosureSuccessMsg(null)}
            className="text-[#006C49] font-bold ml-2 hover:opacity-80 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-time Bank Balance & Cash Liquidity Reconciliation Bar */}
      <div className="bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EFF6FF] text-[#2563EB] rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Conciliación de Cuentas (Saldo Real en Vivo)
                </h3>
                <span className="text-[10px] font-bold bg-[#DCFCE7] text-[#006C49] px-2 py-0.5 rounded border border-[#86EFAC]">
                  Actualizado al instante
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Compara estos saldos directamente con tu cartola del banco y el efectivo en tu gaveta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
            <span className="text-xs font-semibold text-[#64748B]">Total Liquidez Real:</span>
            <span className={`text-base font-bold font-mono-num ${totalLiquidity >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
              {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          {/* Bank Account Balance */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5 flex items-center justify-between hover:border-[#CBD5E1] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white text-[#2563EB] border border-[#CBD5E1] rounded-md shadow-2xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span>Cuenta Corriente Bancaria</span>
                  <span className="text-[10px] bg-[#DBEAFE] text-[#1D4ED8] font-semibold px-1.5 py-0.2 rounded">
                    Banco
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Tarjetas Débito/Crédito, transferencias y pagos
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold font-mono-num ${bank >= 0 ? 'text-[#0F172A]' : 'text-[#DC2626]'}`}>
                {formatCurrency(bank, settings.currencySymbol, 0)}
              </div>
              <span className="text-[10px] text-[#64748B] font-medium">Debe coincidir con cartola</span>
            </div>
          </div>

          {/* Cash in Drawer */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5 flex items-center justify-between hover:border-[#CBD5E1] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white text-[#006C49] border border-[#CBD5E1] rounded-md shadow-2xs">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span>Caja Chica / Gaveta</span>
                  <span className="text-[10px] bg-[#DCFCE7] text-[#006C49] font-semibold px-1.5 py-0.2 rounded">
                    Efectivo
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Billetes y monedas físicos disponibles
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold font-mono-num ${cashDrawer >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                {formatCurrency(cashDrawer, settings.currencySymbol, 0)}
              </div>
              <span className="text-[10px] text-[#64748B] font-medium">Debe coincidir con arqueo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards for the Selected Period */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>INGRESOS BRUTOS COBRADOS</span>
            <span className="bg-[#DCFCE7] text-[#006C49] px-2 py-0.5 rounded text-[10px] font-bold">
              {incomeCount} ventas
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] font-mono-num mb-1">
            {formatCurrency(periodMetrics.grossRevenue, settings.currencySymbol)}
          </div>
          <p className="text-xs text-[#64748B]">Total ventas en el período seleccionado</p>
        </div>

        {/* Real Liquid Bank Deposit */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>DEPÓSITO REAL LÍQUIDO</span>
            <span className="text-[10px] text-[#006C49] font-bold">Banco/Caja</span>
          </div>
          <div className="text-2xl font-bold text-[#006C49] font-mono-num mb-1">
            {formatCurrency(periodMetrics.netRevenue, settings.currencySymbol)}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#64748B]">
            <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>-{formatCurrency(periodMetrics.processingFees, settings.currencySymbol)} comisiones tarjetas</span>
          </div>
        </div>

        {/* Expenses (Outflow) */}
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>EGRESOS Y COMPRAS TOTALES</span>
            <span className="bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded text-[10px] font-bold">
              {expenseCount} gastos
            </span>
          </div>
          <div className="text-2xl font-bold text-[#DC2626] font-mono-num mb-1">
            {formatCurrency(periodMetrics.totalExpenses, settings.currencySymbol)}
          </div>
          <p className="text-xs text-[#64748B]">Salida real de fondos del período</p>
        </div>

        {/* IVA F29 Balance */}
        <div 
          onClick={() => onOpenF29Modal && onOpenF29Modal(periodFilter.selectedMonth || (periodFilter.selectedDate ? periodFilter.selectedDate.slice(0, 7) : undefined))}
          className={`bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs transition-all ${
            onOpenF29Modal ? 'hover:border-[#006C49] cursor-pointer group' : ''
          }`}
          title="Haz clic para ver la liquidación detallada del Formulario 29 (SII)"
        >
          <div className="text-[11px] font-bold text-[#64748B] group-hover:text-[#006C49] uppercase tracking-wider mb-1.5 flex items-center justify-between transition-colors">
            <span>BALANCE IVA F29 (SII 19%)</span>
            <span className="text-[10px] text-[#006C49] group-hover:underline font-bold">Ver Liquidación &rarr;</span>
          </div>
          <div className={`text-2xl font-bold font-mono-num mb-1 ${
            netIvaBalance > 0 ? 'text-[#D97706]' : 'text-[#006C49]'
          }`}>
            {formatCurrency(netIvaBalance, settings.currencySymbol, 0)}
          </div>
          <div className="text-[11px] text-[#64748B] flex items-center justify-between">
            <span>Débito: {formatCurrency(totalIvaDebito, settings.currencySymbol, 0)}</span>
            <span>Crédito: {formatCurrency(totalIvaCredito, settings.currencySymbol, 0)}</span>
          </div>
        </div>
      </div>

      {/* MAIN SECTION: HISTORIAL DEL PERIODO */}
      <div className="bg-white border border-[#CBD5E1] rounded-lg shadow-xs overflow-hidden">
        {/* Table Toolbar: Tabs & Search */}
        <div className="p-5 border-b border-[#F1F5F9] space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                Historial de Movimientos
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Desglose transparente de cobros con boleta, comisiones retenidas y compras con facturas
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar concepto, medio o categoría..."
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0F172A] text-[#0F172A] placeholder-[#94A3B8]"
              />
              {historyFilter && (
                <button
                  onClick={() => setHistoryFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Segmented View Tabs (Todos / Ingresos / Egresos) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#F1F5F9]">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabFilter === 'all'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-[#F8FAFC] border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <span>Todos los Movimientos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTabFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475569]'
              }`}>
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('income')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabFilter === 'income'
                  ? 'bg-[#006C49] text-white shadow-xs'
                  : 'bg-[#F0FDF4] border border-[#DCFCE7] text-[#006C49] hover:bg-[#DCFCE7]'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Ingresos / Ventas (Boletas)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTabFilter === 'income' ? 'bg-white/20 text-white' : 'bg-[#DCFCE7] text-[#006C49] font-bold'
              }`}>
                {incomeCount} • {formatCurrency(totalGrossIncome, settings.currencySymbol, 0)}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('expense')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabFilter === 'expense'
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626] hover:bg-[#FEE2E2]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Egresos / Gastos (Facturas)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTabFilter === 'expense' ? 'bg-white/20 text-white' : 'bg-[#FEE2E2] text-[#DC2626] font-bold'
              }`}>
                {expenseCount} • {formatCurrency(totalGrossExpense, settings.currencySymbol, 0)}
              </span>
            </button>

            <button
              onClick={() => setActiveTabFilter('partners')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTabFilter === 'partners' && viewMode === 'movements'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'bg-[#F0F9FF] border border-[#E0F2FE] text-[#0284C7] hover:bg-[#E0F2FE]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Socios (Aportes / Retiros)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTabFilter === 'partners' && viewMode === 'movements' ? 'bg-white/20 text-white' : 'bg-[#E0F2FE] text-[#0284C7] font-bold'
              }`}>
                {partnerCount}
              </span>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'audits' ? 'movements' : 'audits')}
              className={`ml-auto px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'audits'
                  ? 'bg-[#64748B] text-white shadow-xs'
                  : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Auditoría de Caja</span>
            </button>
          </div>
        </div>

        {viewMode === 'audits' ? (
          <div className="bg-[#F8FAFC]">
            {/* Modo Rango / Mes / Historial: Resumen y Auditoría de Cierres de Caja del Período */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#F1F5F9] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                      Auditoría de Cierres de Caja del Período
                    </h3>
                    <span className="text-xs bg-[#F1F5F9] text-[#0F172A] font-bold px-2.5 py-0.5 rounded border border-[#CBD5E1]">
                      {getPeriodLabel(periodFilter)}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Histórico consolidado de arqueos de caja y control de descuadres realizados en este período
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {duplicateClosuresCount > 0 && onCleanDuplicateClosures && (
                    <button
                      type="button"
                      onClick={onCleanDuplicateClosures}
                      className="px-3 py-2 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#F59E0B] text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      title="Mantiene solo el último arqueo registrado de cada turno y elimina los repetidos por error"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Limpiar {duplicateClosuresCount} Duplicados</span>
                    </button>
                  )}

                  {periodClosures.length > 0 && onClearClosures && (
                    isConfirmingClearAll ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClearClosures();
                            setIsConfirmingClearAll(false);
                            setClosureSuccessMsg('Historial de arqueos eliminado con éxito.');
                            setTimeout(() => setClosureSuccessMsg(null), 4000);
                          }}
                          className="px-2.5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title="Confirmar eliminación total"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>¿Borrar Todo?</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingClearAll(false)}
                          className="px-2 py-2 bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] text-xs font-medium rounded-md cursor-pointer"
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingClearAll(true)}
                        className="px-2.5 py-2 bg-white hover:bg-[#FEE2E2] text-[#DC2626] border border-[#CBD5E1] hover:border-[#FCA5A5] text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="Eliminar todos los arqueos de prueba"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Limpiar Todo</span>
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPeriodFilter({
                        ...periodFilter,
                        mode: 'day',
                        selectedDate: getTodayString(),
                      });
                      // Remains in audits mode
                    }}
                    className="px-3.5 py-2 bg-[#006C49] hover:bg-[#005538] text-white text-xs font-bold rounded-md flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Realizar Arqueo de Hoy</span>
                  </button>
                </div>
              </div>

              {/* Quick Metrics of Closures */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-[#CBD5E1] p-3.5 rounded-md shadow-xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase">Cierres Realizados</div>
                  <div className="text-xl font-bold text-[#0F172A] font-mono-num mt-1">
                    {periodClosures.length} {periodClosures.length === 1 ? 'arqueo' : 'arqueos'}
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">
                    {duplicateClosuresCount > 0 ? (
                      <span className="text-[#D97706] font-semibold">({duplicateClosuresCount} duplicados por error)</span>
                    ) : (
                      'Registros únicos'
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#CBD5E1] p-3.5 rounded-md shadow-xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase">Último Efectivo Contado</div>
                  <div className="text-xl font-bold text-[#1E40AF] font-mono-num mt-1">
                    {latestClosure ? formatCurrency(latestClosure.countedCash, settings.currencySymbol) : '$0'}
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5 truncate">
                    {latestClosure ? `${latestClosure.shift} (${latestClosure.date})` : 'Sin arqueos aún'}
                  </div>
                </div>

                <div className="bg-white border border-[#CBD5E1] p-3.5 rounded-md shadow-xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase">Descuadre Neto Acumulado</div>
                  <div className={`text-xl font-bold font-mono-num mt-1 ${
                    Math.abs(totalPeriodVariance) < 1 ? 'text-[#006C49]' : totalPeriodVariance > 0 ? 'text-[#1E40AF]' : 'text-[#DC2626]'
                  }`}>
                    {totalPeriodVariance > 0 ? '+' : ''}{formatCurrency(totalPeriodVariance, settings.currencySymbol)}
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">
                    {Math.abs(totalPeriodVariance) < 1 ? (
                      <span className="text-[#006C49] font-medium">Caja 100% Cuadrada</span>
                    ) : totalPeriodVariance > 0 ? (
                      'Sobrante acumulado'
                    ) : (
                      'Faltante acumulado'
                    )}
                  </div>
                </div>
              </div>

              {/* Alert if duplicates detected */}
              {duplicateClosuresCount > 0 && (
                <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-md text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
                    <span>
                      Se detectaron <strong>{duplicateClosuresCount} arqueos duplicados</strong> para el mismo turno. Puedes eliminarlos individualmente con la papelera o usar <strong>"Limpiar Duplicados"</strong> para conservar solo el más reciente.
                    </span>
                  </div>
                  {onCleanDuplicateClosures && (
                    <button
                      type="button"
                      onClick={onCleanDuplicateClosures}
                      className="px-2.5 py-1 bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-bold rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      Limpiar Ahora
                    </button>
                  )}
                </div>
              )}

              {/* Table of closures in period */}
              {periodClosures.length === 0 ? (
                <div className="py-8 text-center text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-md bg-white">
                  <Coins className="w-8 h-8 mx-auto text-[#CBD5E1] mb-2" />
                  <p className="text-xs font-semibold text-[#475569]">No hay arqueos de caja registrados en este período.</p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    Cambia al modo "Día" para realizar el conteo de billetes y monedas de una fecha específica.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white border border-[#CBD5E1] rounded-md">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#CBD5E1] bg-[#F1F5F9] text-[11px] uppercase tracking-wider text-[#64748B]">
                        <th className="py-2.5 px-3 font-semibold">Fecha</th>
                        <th className="py-2.5 px-3 font-semibold">Turno / Hora</th>
                        <th className="py-2.5 px-3 font-semibold">Responsable</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Efectivo Esperado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Efectivo Contado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Diferencia</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-16">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {periodClosures.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3 font-mono-num font-bold text-[#0F172A]">{c.date}</td>
                          <td className="py-2.5 px-3 text-[#475569]">{c.shift} ({c.closedAt})</td>
                          <td className="py-2.5 px-3 text-[#64748B]">{c.closedBy}</td>
                          <td className="py-2.5 px-3 font-mono-num text-right font-medium">{formatCurrency(c.systemExpectedCash, settings.currencySymbol)}</td>
                          <td className="py-2.5 px-3 font-mono-num text-right font-bold text-[#1E40AF]">{formatCurrency(c.countedCash, settings.currencySymbol)}</td>
                          <td className={`py-2.5 px-3 font-mono-num text-right font-bold ${
                            Math.abs(c.variance) < 1 ? 'text-[#006C49]' : c.variance > 0 ? 'text-[#1E40AF]' : 'text-[#DC2626]'
                          }`}>
                            {c.variance > 0 ? '+' : ''}{formatCurrency(c.variance, settings.currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {onDeleteClosure && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteClosure(c.id);
                                  setClosureSuccessMsg(`Arqueo de ${c.shift} (${c.closedAt}) eliminado.`);
                                  setTimeout(() => setClosureSuccessMsg(null), 3000);
                                }}
                                className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                                title="Eliminar este arqueo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#64748B]">
                <th className="py-3 px-4 font-semibold w-32">Fecha y Hora</th>
                <th className="py-3 px-4 font-semibold">Concepto / Detalle</th>
                <th className="py-3 px-4 font-semibold">Canal / Medio de Pago</th>
                <th className="py-3 px-4 font-semibold text-right" title="Total cobrado al cliente o pagado al proveedor">
                  Monto Total (Bruto)
                </th>
                <th className="py-3 px-4 font-semibold text-right" title="Comisión de pasarela retenida (no entra al banco)">
                  Comisión Tarjeta (-)
                </th>
                <th className="py-3 px-4 font-semibold text-right" title="IVA 19% Débito recaudado o Crédito recuperable en F29">
                  IVA 19% (F29)
                </th>
                <th className="py-3 px-4 font-semibold text-right" title="Flujo real que entra o sale físicamente de tu banco/caja">
                  Flujo Real (Banco/Caja)
                </th>
                <th className="py-3 px-4 font-semibold text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-xs">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Receipt className="w-8 h-8 text-[#CBD5E1] mx-auto" />
                      <p className="font-medium text-[#475569]">No hay movimientos en este período</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {historyFilter 
                          ? `No encontramos registros que coincidan con "${historyFilter}"`
                          : `No hay ${activeTabFilter === 'income' ? 'ingresos' : activeTabFilter === 'expense' ? 'egresos' : 'movimientos'} registrados para ${getPeriodLabel(periodFilter)}.`
                        }
                      </p>
                      <div className="pt-2 flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => handleOpenAddModal(activeTabFilter === 'expense' ? 'expense' : 'income')}
                          className="px-3 py-1.5 bg-[#0F172A] text-white rounded text-xs font-semibold hover:bg-[#1E293B] cursor-pointer"
                        >
                          + Registrar Movimiento
                        </button>
                        {transactions.length > 0 && periodFilter.mode === 'day' && (
                          <button
                            onClick={() => setPeriodFilter({
                              mode: 'month',
                              selectedDate: activeDayDate,
                              startDate: `${activeDayDate.substring(0, 7)}-01`,
                              endDate: activeDayDate,
                              selectedMonth: activeDayDate.substring(0, 7),
                              startMonth: activeDayDate.substring(0, 7),
                              endMonth: activeDayDate.substring(0, 7),
                            })}
                            className="px-3 py-1.5 bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] rounded text-xs font-medium hover:bg-[#E2E8F0] cursor-pointer"
                          >
                            Ver movimientos del mes ({transactions.length})
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isCapital = tx.type === 'capital_contribution';
                  const isWithdrawal = tx.type === 'partner_withdrawal';
                  const isExpense = tx.type === 'expense';
                  const isHonorarios = isExpense && tx.docType === 'honorarios';
                  const hasFee = (tx.feeAmount || 0) > 0;
                  const isFactura = tx.docType === 'factura' || (!tx.docType && tx.hasFactura && isExpense);
                  const isBoleta = tx.docType === 'boleta' || (!tx.docType && isIncome);
                  const isSinDoc = tx.docType === 'sin_doc';

                  const ivaVal = tx.ivaAmount || (
                    (isFactura || isBoleta) ? (tx.grossAmount - (tx.grossAmount / 1.19)) : 0
                  );
                  const netCostWithoutIva = isFactura ? (tx.grossAmount / 1.19) : tx.grossAmount;

                  return (
                    <tr key={tx.id} className="hover:bg-[#F8FAFC] transition-colors group">
                      {/* Fecha y Hora */}
                      <td className="py-3 px-4 font-mono-num text-[#64748B] font-medium">
                        <div className="space-y-0.5">
                          <div className="text-[#0F172A] font-semibold">{tx.date}</div>
                          <div className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                            <Clock className="w-3 h-3" />
                            <span>{tx.time}</span>
                          </div>
                        </div>
                      </td>

                      {/* Concepto & Tax Document Badge */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#0F172A] text-sm">{tx.concept}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {isCapital ? (
                            <span className="inline-flex items-center gap-1 bg-[#F0F9FF] border border-[#BAE6FD] text-[#0284C7] px-2 py-0.5 rounded text-[10px] font-bold">
                              <UserPlus className="w-3 h-3" />
                              Aporte de Socio (Capital)
                            </span>
                          ) : isWithdrawal ? (
                            <span className="inline-flex items-center gap-1 bg-[#FAF5FF] border border-[#E9D5FF] text-[#7C3AED] px-2 py-0.5 rounded text-[10px] font-bold">
                              <UserMinus className="w-3 h-3" />
                              Retiro de Socio (Utilidades)
                            </span>
                          ) : isIncome ? (
                            isBoleta ? (
                              <span className="inline-flex items-center gap-1 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] px-2 py-0.5 rounded text-[10px] font-semibold">
                                <Receipt className="w-3 h-3" />
                                Boleta Electrónica (IVA: {formatCurrency(ivaVal, settings.currencySymbol, 0)})
                              </span>
                            ) : isFactura ? (
                              <span className="inline-flex items-center gap-1 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] px-2 py-0.5 rounded text-[10px] font-semibold">
                                <FileText className="w-3 h-3" />
                                Factura Venta (IVA: {formatCurrency(ivaVal, settings.currencySymbol, 0)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] px-2 py-0.5 rounded text-[10px] font-medium">
                                Sin Documento
                              </span>
                            )
                          ) : isHonorarios ? (
                            <span className="inline-flex items-center gap-1 bg-[#FAF5FF] border border-[#E9D5FF] text-[#6B21A8] px-2 py-0.5 rounded text-[10px] font-bold">
                              <Percent className="w-3 h-3 text-[#9333EA]" />
                              Boleta Honorarios (Retención {tx.taxRetentionRate || 15.25}%)
                            </span>
                          ) : isFactura ? (
                            <span className="inline-flex items-center gap-1 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] px-2 py-0.5 rounded text-[10px] font-bold">
                              <FileText className="w-3 h-3 text-[#B45309]" />
                              Factura Compra (IVA Crédito: {formatCurrency(ivaVal, settings.currencySymbol, 0)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] px-2 py-0.5 rounded text-[10px] font-medium">
                              <Receipt className="w-3 h-3" />
                              Boleta / Recibo (Sin IVA Crédito)
                            </span>
                          )}

                          {tx.docNumber && (
                            <span className="inline-flex items-center gap-0.5 bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">
                              Folio #{tx.docNumber}
                            </span>
                          )}

                          {tx.notes && (
                            <span className="text-[11px] text-[#64748B] italic">
                              "{tx.notes}"
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Canal / Medio de Pago */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isCapital ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]">
                              <Building2 className="w-3 h-3" />
                              {tx.outflowMethod === 'cash_drawer' ? 'Entra a Caja Chica' : 'Entra a Banco'}
                            </span>
                          ) : isWithdrawal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]">
                              <Building2 className="w-3 h-3" />
                              {tx.outflowMethod === 'cash_drawer' ? 'Sale de Caja Chica' : 'Sale de Banco'}
                            </span>
                          ) : isIncome ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#1E40AF] border border-[#DBEAFE]">
                              <CreditCard className="w-3 h-3" />
                              {tx.paymentMethod === 'credit_card' ? 'Tarjeta Crédito' :
                               tx.paymentMethod === 'debit_card' ? 'Tarjeta Débito' :
                               tx.paymentMethod === 'prepaid_card' ? 'Prepago' :
                               tx.paymentMethod === 'delivery_app' ? 'Delivery App' :
                               tx.paymentMethod === 'cash' ? 'Efectivo Caja' : 'Transferencia Banco'}
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1]">
                                <Landmark className="w-3 h-3" />
                                {tx.outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Banco / Transf.'}
                              </span>
                              {tx.category && (
                                <span className="text-[10px] text-[#64748B] font-medium">
                                  ({tx.category === 'raw_materials' ? 'Insumos' :
                                    tx.category === 'rent' ? 'Arriendo' :
                                    tx.category === 'utilities' ? 'Servicios' :
                                    tx.category === 'payroll_daily' ? 'Nómina' :
                                    tx.category === 'accounting_legal' ? 'Honorarios/Legal' : 
                                    tx.category === 'profit_distribution' ? 'Reserva Ganancia' :
                                    tx.category === 'owner_draw' ? 'Sueldo Dueño' :
                                    tx.category === 'tax_reserve' ? 'Provisión Impuestos' :
                                    'Gasto'})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Monto Bruto (Total) */}
                      <td className={`py-3 px-4 font-mono-num text-right font-semibold text-sm ${
                        isIncome ? 'text-[#0F172A]' : 
                        isCapital ? 'text-[#0284C7]' :
                        isWithdrawal ? 'text-[#7C3AED]' : 
                        'text-[#DC2626]'
                      }`}>
                        {isCapital ? '+' : isIncome ? '' : '-'}{formatCurrency(tx.grossAmount, settings.currencySymbol)}
                      </td>

                      {/* Comisión Pasarela (-) */}
                      <td className="py-3 px-4 font-mono-num text-right text-xs">
                        {hasFee ? (
                          <div>
                            <span className="text-[#DC2626] font-bold" title="Comisión de pasarela no depositada en banco">
                              -{formatCurrency(tx.feeAmount, settings.currencySymbol)}
                            </span>
                            <div className="text-[10px] text-[#94A3B8]">Retención POS</div>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8]" title="Sin comisión de pasarela">—</span>
                        )}
                      </td>

                      {/* IVA 19% (F29) */}
                      <td className="py-3 px-4 font-mono-num text-right text-xs">
                        {isCapital || isWithdrawal ? (
                          <span className="text-[#94A3B8] text-[10px]">No aplica</span>
                        ) : isIncome ? (
                          !isSinDoc && ivaVal > 0 ? (
                            <div>
                              <span className="text-[#D97706] font-semibold" title="IVA Débito recaudado (Entra a tu banco temporalmente)">
                                +{formatCurrency(ivaVal, settings.currencySymbol, 0)}
                              </span>
                              <div className="text-[10px] text-[#D97706]">Débito (Recaudado)</div>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )
                        ) : isHonorarios ? (
                          <div>
                            <span className="text-[#6B21A8] font-bold" title="Retención SII que debes retener y pagar en F29">
                              -{formatCurrency(tx.taxRetentionAmount || 0, settings.currencySymbol, 0)}
                            </span>
                            <div className="text-[10px] text-[#6B21A8]">Retención F29</div>
                          </div>
                        ) : (
                          isFactura && ivaVal > 0 ? (
                            <div>
                              <span className="text-[#006C49] font-bold" title="IVA Crédito fiscal a favor para descontar en F29">
                                +{formatCurrency(ivaVal, settings.currencySymbol, 0)}
                              </span>
                              <div className="text-[10px] text-[#006C49]">Crédito a favor</div>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )
                        )}
                      </td>

                      {/* Flujo Real (Entra o Sale del Banco/Caja) */}
                      <td className={`py-3 px-4 font-mono-num font-bold text-right text-sm ${
                        isCapital ? 'text-[#0284C7]' :
                        isWithdrawal ? 'text-[#7C3AED]' :
                        isIncome ? 'text-[#006C49]' : 
                        'text-[#DC2626]'
                      }`}>
                        <div>
                          <span>{isCapital ? '+' : isIncome ? '+' : '-'}{formatCurrency(
                            isCapital ? tx.grossAmount :
                            isWithdrawal ? tx.grossAmount :
                            isIncome ? tx.netAmount : 
                            (tx.netAmount !== undefined ? tx.netAmount : tx.grossAmount), 
                            settings.currencySymbol
                          )}</span>
                          {isCapital && (
                            <div className="text-[10px] font-normal text-[#0284C7]">Inyección Capital</div>
                          )}
                          {isWithdrawal && (
                            <div className="text-[10px] font-normal text-[#7C3AED]">Reparto Utilidades</div>
                          )}
                          {isHonorarios && (
                            <div className="text-[10px] font-normal text-[#6B21A8]">Líquido al profesional</div>
                          )}
                          {!isIncome && !isCapital && !isWithdrawal && !isHonorarios && isFactura && (
                            <div className="text-[10px] font-normal text-[#64748B]">
                              Neto sin IVA: {formatCurrency(netCostWithoutIva, settings.currencySymbol, 0)}
                            </div>
                          )}
                          {isIncome && hasFee && (
                            <div className="text-[10px] font-normal text-[#006C49]">
                              Depósito Banco
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0] p-1.5 rounded transition-colors cursor-pointer"
                            title="Modificar este registro"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] p-1.5 rounded transition-colors cursor-pointer"
                            title="Eliminar este registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Summary */}
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-[#F8FAFC] border-t-2 border-[#CBD5E1] font-bold text-xs text-[#0F172A]">
                  <td colSpan={3} className="py-3 px-4 text-[#475569] uppercase tracking-wider">
                    Total Filtrado ({filteredEntries.length} registros)
                  </td>
                  <td className={`py-3 px-4 text-right font-mono-num ${currentSummary.gross >= 0 ? 'text-[#0F172A]' : 'text-[#DC2626]'}`}>
                    {currentSummary.gross < 0 ? '-' : ''}{formatCurrency(Math.abs(currentSummary.gross), settings.currencySymbol)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-[#DC2626]">
                    {currentSummary.fees > 0 ? `-${formatCurrency(currentSummary.fees, settings.currencySymbol)}` : '$0'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-xs">
                    {activeTabFilter === 'income' ? (
                      currentSummary.ivaDebito > 0 ? (
                        <div className="text-[#D97706] font-semibold">
                          Débito: +{formatCurrency(currentSummary.ivaDebito, settings.currencySymbol, 0)}
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">$0</span>
                      )
                    ) : activeTabFilter === 'expense' ? (
                      currentSummary.ivaCredito > 0 ? (
                        <div className="text-[#006C49] font-semibold">
                          Crédito: +{formatCurrency(currentSummary.ivaCredito, settings.currencySymbol, 0)}
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">$0</span>
                      )
                    ) : (
                      <div className="space-y-0.5">
                        {currentSummary.ivaDebito > 0 && (
                          <div className="text-[#D97706]">
                            Déb: +{formatCurrency(currentSummary.ivaDebito, settings.currencySymbol, 0)}
                          </div>
                        )}
                        {currentSummary.ivaCredito > 0 && (
                          <div className="text-[#006C49]">
                            Créd: +{formatCurrency(currentSummary.ivaCredito, settings.currencySymbol, 0)}
                          </div>
                        )}
                        {currentSummary.ivaDebito === 0 && currentSummary.ivaCredito === 0 && (
                          <span className="text-[#94A3B8]">$0</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono-num text-sm ${currentSummary.realFlow >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                    {currentSummary.realFlow < 0 ? '-' : '+'}{formatCurrency(Math.abs(currentSummary.realFlow), settings.currencySymbol)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* BOTTOM SECTION: ARQUEO DE CAJA O AUDITORÍA SEGÚN MODO */}
      {viewMode === 'audits' && periodFilter.mode === 'day' && (
        /* Modo DÍA: Arqueo y Cierre Fiduciario de la Gaveta */
        <div className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs transition-all mt-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#F1F5F9] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#006C49]" />
                  <span>Arqueo y Cierre Físico de Caja</span>
                </h3>
                <span className="text-[11px] font-bold bg-[#DCFCE7] text-[#006C49] px-2 py-0.5 rounded border border-[#86EFAC]">
                  {formatCurrency(dailyMetrics.expectedCashDrawer, settings.currencySymbol)} esperado
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Conteo físico de billetes y monedas para cuadrar la gaveta física con el sistema
              </p>
            </div>

            {/* Interactive Shift Selector & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
              {/* Shift Selector Dropdown / Pills */}
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
                <span className="text-[11px] font-semibold text-[#64748B] px-1.5 hidden sm:inline">Turno:</span>
                {[
                  { id: 'Turno Mañana', label: 'Mañana' },
                  { id: 'Turno Tarde', label: 'Tarde' },
                  { id: 'Turno Noche', label: 'Noche' },
                  { id: 'Cierre Diario', label: 'Día Completo' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentShift(s.id)}
                    className={`px-2 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                      currentShift === s.id
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Quick Actions: Reset, Collapse */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetDenominations}
                  title="Reiniciar todos los billetes y monedas a 0"
                  className="p-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] rounded-md border border-[#CBD5E1] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCashDrawerCollapsed(!isCashDrawerCollapsed)}
                  title={isCashDrawerCollapsed ? "Desplegar calculadora de conteo" : "Minimizar arqueo"}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] text-xs font-semibold rounded-md border border-[#CBD5E1] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isCashDrawerCollapsed ? (
                    <>
                      <span>Mostrar Conteo</span>
                      <ChevronDown className="w-4 h-4 text-[#64748B]" />
                    </>
                  ) : (
                    <>
                      <span>Minimizar</span>
                      <ChevronUp className="w-4 h-4 text-[#64748B]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {!isCashDrawerCollapsed ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
              {/* Physical Count Inputs */}
              <div className="lg:col-span-7 space-y-3">
                {/* Direct Quick Amount Input */}
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#DBEAFE] text-[#2563EB] rounded-md">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#1E40AF] block">Ingreso Rápido de Efectivo Total:</span>
                      <span className="text-[11px] text-[#3B82F6]">Si ya contaste el dinero, escribe el total aquí</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1E40AF]">{settings.currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={countedCash === 0 ? '' : countedCash}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        handleAutoFillExpectedCash(val);
                      }}
                      className="w-24 px-2.5 py-1 text-right font-bold text-sm bg-white border border-[#93C5FD] rounded text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAutoFillExpectedCash(dailyMetrics.expectedCashDrawer)}
                      className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold rounded shadow-2xs cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1"
                      title="Asignar el total esperado y desglosar billetes automáticamente"
                    >
                      <Check className="w-3 h-3" />
                      <span>Cuadrar ({formatCurrency(dailyMetrics.expectedCashDrawer, settings.currencySymbol)})</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-[#64748B] uppercase tracking-wider pt-1">
                  <span>Conteo Físico por Denominación</span>
                  <span className="text-xs text-[#0F172A] font-mono-num font-bold">
                    Subtotal Contado: {formatCurrency(countedCash, settings.currencySymbol)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {settings.currency === 'CLP' ? (
                    <>
                      {[
                        { key: 'b20000', label: '$20.000', val: 20000 },
                        { key: 'b10000', label: '$10.000', val: 10000 },
                        { key: 'b5000', label: '$5.000', val: 5000 },
                        { key: 'b2000', label: '$2.000', val: 2000 },
                        { key: 'b1000', label: '$1.000', val: 1000 },
                        { key: 'c500', label: 'Moneda $500', val: 500 },
                        { key: 'c100', label: 'Moneda $100', val: 100 },
                        { key: 'c50', label: 'Moneda $50', val: 50 },
                        { key: 'c10', label: 'Moneda $10', val: 10 }
                      ].map(denom => (
                        <div key={denom.key} className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md hover:border-[#94A3B8] transition-colors">
                          <span className="font-mono-num font-semibold text-[#0F172A] text-xs">{denom.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#94A3B8] text-[11px]">x</span>
                            <input
                              type="number"
                              min="0"
                              value={(denominations as any)[denom.key] || ''}
                              placeholder="0"
                              onChange={(e) => setDenominations({...denominations, [denom.key]: parseInt(e.target.value) || 0})}
                              className="w-16 px-2 py-1 text-center font-bold bg-white border border-[#CBD5E1] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#0F172A] font-mono-num"
                            />
                          </div>
                        </div>
                      ))}
                      {/* Monedas sueltas */}
                      <div className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md sm:col-span-2">
                        <span className="font-semibold text-[#0F172A] text-xs">Otras Monedas / Varios ($)</span>
                        <input
                          type="number"
                          min="0"
                          value={denominations.coins || ''}
                          placeholder="0"
                          onChange={(e) => setDenominations({...denominations, coins: parseFloat(e.target.value) || 0})}
                          className="w-24 px-2 py-1 text-right font-bold bg-white border border-[#CBD5E1] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#0F172A] font-mono-num"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {[
                        { key: 'b100', label: '$100', val: 100 },
                        { key: 'b50', label: '$50', val: 50 },
                        { key: 'b20', label: '$20', val: 20 },
                        { key: 'b10', label: '$10', val: 10 },
                        { key: 'b5', label: '$5', val: 5 },
                        { key: 'b1', label: '$1', val: 1 }
                      ].map(denom => (
                        <div key={denom.key} className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md">
                          <span className="font-mono-num font-semibold text-[#0F172A] text-xs">{denom.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#94A3B8] text-[11px]">x</span>
                            <input
                              type="number"
                              min="0"
                              value={(denominations as any)[denom.key] || ''}
                              placeholder="0"
                              onChange={(e) => setDenominations({...denominations, [denom.key]: parseInt(e.target.value) || 0})}
                              className="w-16 px-2 py-1 text-center font-bold bg-white border border-[#CBD5E1] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#0F172A] font-mono-num"
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Real-time Reconciliation Summary Card */}
              <div className="lg:col-span-5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                    <span>Cuadratura: {currentShift}</span>
                    <div className="flex items-center gap-1.5 font-normal normal-case">
                      <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                      <input
                        type="date"
                        value={activeDayDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setPeriodFilter({
                              ...periodFilter,
                              mode: 'day',
                              selectedDate: e.target.value,
                              startDate: e.target.value,
                              endDate: e.target.value,
                            });
                          }
                        }}
                        className="text-xs font-mono-num font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 shadow-2xs cursor-pointer hover:border-[#94A3B8]"
                        title="Seleccionar fecha para la cuadratura"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs divide-y divide-[#E2E8F0]">
                    {/* Desglose de apertura con salidas previas si las hay */}
                    {priorCashChange !== 0 ? (
                      <div className="pt-1 pb-1.5 space-y-1 bg-[#F8FAFC] p-2.5 rounded border border-[#CBD5E1]">
                        <div className="flex justify-between items-center text-[#64748B]">
                          <span>Fondo Base Gaveta (Configurado):</span>
                          <span className="font-mono-num font-semibold text-[#0F172A]">{formatCurrency(settings.startingCashDrawer, settings.currencySymbol)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#DC2626]">
                          <div className="flex items-center gap-1.5">
                            <span>- Salidas Previas de Gaveta:</span>
                            <button
                              type="button"
                              onClick={() => setShowPriorCashDetails(!showPriorCashDetails)}
                              className="text-[10px] text-[#2563EB] hover:underline font-bold cursor-pointer"
                            >
                              {showPriorCashDetails ? '▲ Ocultar' : `▼ Ver detalle (${priorCashMovements.length})`}
                            </button>
                          </div>
                          <span className="font-mono-num font-bold">-{formatCurrency(Math.abs(priorCashChange), settings.currencySymbol)}</span>
                        </div>

                        {showPriorCashDetails && priorCashMovements.length > 0 && (
                          <div className="mt-1 pt-1.5 border-t border-[#CBD5E1] space-y-1.5 bg-white p-2 rounded text-[11px] max-h-36 overflow-y-auto">
                            <div className="text-[10px] text-[#64748B] font-semibold uppercase">Movimientos anteriores al {activeDayDate}:</div>
                            {priorCashMovements.map(tx => {
                              const isOut = tx.type === 'expense' || tx.type === 'partner_withdrawal';
                              const amt = isOut ? (tx.grossAmount || tx.netAmount) : tx.netAmount;
                              return (
                                <div key={tx.id} className="flex justify-between items-center py-1 border-b border-[#F1F5F9] font-mono-num last:border-0">
                                  <div className="flex flex-col truncate max-w-[200px]">
                                    <span className="font-semibold text-[#0F172A] truncate">{tx.concept}</span>
                                    <span className="text-[10px] text-[#94A3B8]">{tx.date} • {tx.type === 'expense' ? 'Gasto en efectivo' : tx.type}</span>
                                  </div>
                                  <span className={`font-bold ${isOut ? 'text-[#DC2626]' : 'text-[#006C49]'}`}>
                                    {isOut ? '-' : '+'}{formatCurrency(amt, settings.currencySymbol)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-1 border-t border-[#CBD5E1] font-mono-num">
                          <span className="font-bold text-[#0F172A]">Efectivo Inicial (Apertura Hoy):</span>
                          <span className="font-bold text-[#0F172A] text-xs">{formatCurrency(dayOpeningCash, settings.currencySymbol)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center pt-1 font-mono-num">
                        <span className="text-[#64748B]">Efectivo Inicial (Apertura):</span>
                        <span className="font-semibold text-[#0F172A]">{formatCurrency(dayOpeningCash, settings.currencySymbol)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5 font-mono-num">
                      <span className="text-[#64748B]">+ Ventas en Efectivo:</span>
                      <span className="font-semibold text-[#006C49]">+{formatCurrency(dailyMetrics.cashSales, settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 font-mono-num">
                      <span className="text-[#64748B]">- Gastos en Efectivo:</span>
                      <span className="font-semibold text-[#DC2626]">-{formatCurrency(dailyMetrics.cashExpenses, settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-mono-num bg-white p-2 rounded border border-[#E2E8F0]">
                      <span className="font-bold text-[#0F172A]">Efectivo Esperado (Sistema):</span>
                      <span className="font-bold text-[#0F172A] text-sm">{formatCurrency(dailyMetrics.expectedCashDrawer, settings.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-mono-num bg-[#EFF6FF] p-2 rounded border border-[#BFDBFE]">
                      <span className="font-bold text-[#1E40AF]">Efectivo Físico Contado:</span>
                      <span className="font-bold text-[#1E40AF] text-base">{formatCurrency(countedCash, settings.currencySymbol)}</span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className={`p-2.5 rounded-md border flex items-center justify-between font-bold text-xs ${
                    countedCash === 0 && dailyMetrics.expectedCashDrawer > 0
                      ? 'bg-[#F8FAFC] border-[#CBD5E1] text-[#64748B]'
                      : Math.abs(variance) < 1
                      ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#006C49]'
                      : variance > 0
                      ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1E40AF]'
                      : 'bg-[#FEE2E2] border-[#FCA5A5] text-[#DC2626]'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {countedCash === 0 && dailyMetrics.expectedCashDrawer > 0 ? (
                        <>
                          <Info className="w-4 h-4 text-[#64748B]" />
                          <span>Pendiente de conteo físico</span>
                        </>
                      ) : Math.abs(variance) < 1 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Caja Cuadrada ($0 descuadre)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          <span>{variance > 0 ? 'Sobrante en Gaveta' : 'Faltante en Gaveta'}</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono-num text-sm">
                      {countedCash === 0 && dailyMetrics.expectedCashDrawer > 0 ? (
                        <span className="text-[11px] font-normal text-[#64748B]">Aún sin ingresar</span>
                      ) : (
                        `${variance > 0 ? '+' : ''}${formatCurrency(variance, settings.currencySymbol)}`
                      )}
                    </span>
                  </div>
                </div>

                {existingClosureForCurrentShift && (
                  <div className="mt-3 p-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded text-[11px] text-[#1D4ED8] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Ya existe un arqueo guardado para {currentShift} ({existingClosureForCurrentShift.closedAt}). Al guardar se actualizará sin crear duplicados.</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveDayClosure}
                  className="w-full mt-3 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 rounded-md font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#34D399]" />
                  <span>{existingClosureForCurrentShift ? `Actualizar Cierre ${currentShift}` : `Guardar y Cerrar ${currentShift}`}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 flex items-center justify-between text-xs text-[#64748B] bg-[#F8FAFC] p-2.5 rounded-md mt-2 border border-[#E2E8F0]">
              <div className="flex items-center gap-4">
                <span>Efectivo Esperado: <strong className="text-[#0F172A]">{formatCurrency(dailyMetrics.expectedCashDrawer, settings.currencySymbol)}</strong></span>
                <span>Físico Contado: <strong className="text-[#1E40AF]">{formatCurrency(countedCash, settings.currencySymbol)}</strong></span>
                <span className={Math.abs(variance) < 1 ? 'text-[#006C49] font-bold' : 'text-[#DC2626] font-bold'}>
                  {Math.abs(variance) < 1 ? 'Cuadrado' : `${variance > 0 ? '+' : ''}${formatCurrency(variance, settings.currencySymbol)}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCashDrawerCollapsed(false)}
                className="text-[#2563EB] font-bold hover:underline cursor-pointer"
              >
                Abrir calculadora de arqueo &rarr;
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
        settings={settings}
        onUpdateTransaction={onUpdateTransaction}
      />

      {/* New Transaction Modal */}
      <NewTransactionModal
        isOpen={isNewTxOpen}
        onClose={() => setIsNewTxOpen(false)}
        settings={settings}
        onAddTransaction={onAddTransaction}
        onAddPayable={onAddPayable || (() => {})}
        initialType={newTxType}
        initialDate={activeDayDate}
      />
    </div>
  );
};