import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  TrendingUp, 
  UserCheck, 
  Landmark, 
  AlertTriangle, 
  Coins, 
  ShieldCheck, 
  Check, 
  ArrowRight,
  Calculator,
  RefreshCw,
  Sparkles,
  Users,
  PieChart as PieIcon,
  Calendar,
  Wallet,
  Info,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { 
  AppSettings, 
  Transaction,
  DatePeriodFilter,
  Partner
} from '../../types';
import { 
  calculatePocketsActualVsTarget, 
  calculateCurrentLiquidity,
  formatCurrency 
} from '../../utils/financial';
import { 
  getDefaultPeriodFilter, 
  isDateInPeriod, 
  getPeriodLabel 
} from '../../utils/dateFilter';
import { PeriodFilterBar } from '../common/PeriodFilterBar';
import { ProfitDistributionModal } from '../modals/ProfitDistributionModal';

interface DistributionViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  onAddTransaction: (tx: Transaction) => void;
  onOpenF29Modal?: (month?: string) => void;
  onUpdatePartners?: (partners: Partner[]) => void;
  periodFilter?: DatePeriodFilter;
  onChangePeriodFilter?: (filter: DatePeriodFilter) => void;
}

export const DistributionView: React.FC<DistributionViewProps> = ({
  settings,
  transactions,
  onAddTransaction,
  onOpenF29Modal,
  onUpdatePartners,
  periodFilter: propPeriodFilter,
  onChangePeriodFilter: propOnChangePeriodFilter,
}) => {
  const [localPeriodFilter, setLocalPeriodFilter] = useState<DatePeriodFilter>(() => getDefaultPeriodFilter());
  const periodFilter = propPeriodFilter || localPeriodFilter;
  const setPeriodFilter = propOnChangePeriodFilter || setLocalPeriodFilter;
  const config = settings.pocketConfig;
  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => isDateInPeriod(t.date, periodFilter));
  }, [transactions, periodFilter]);

  // Actual vs Theoretical from real ledger data in the filtered period
  const pockets = useMemo(() => {
    return calculatePocketsActualVsTarget(periodTransactions, config);
  }, [periodTransactions, config]);

  const isCLP = settings.currency === 'CLP';
  const roundCurrency = (val: number) => isCLP ? Math.round(val) : Number(val.toFixed(2));

  // Pocket fulfilment calculations
  const pendingProfit = Math.max(0, roundCurrency(pockets.theoretical.profit) - pockets.actual.profit);
  const pendingOwner = Math.max(0, roundCurrency(pockets.theoretical.owner) - pockets.actual.owner);
  const pendingTaxes = Math.max(0, roundCurrency(pockets.theoretical.taxes) - pockets.actual.taxes);
  const totalProtectedTheoretical = roundCurrency(pockets.theoretical.profit) + roundCurrency(pockets.theoretical.owner) + roundCurrency(pockets.theoretical.taxes);
  const totalProtectedActual = pockets.actual.profit + pockets.actual.owner + pockets.actual.taxes;
  const isPeriodFullyDistributed = pockets.totalNetRevenue > 0 && totalProtectedActual >= totalProtectedTheoretical;
  const totalProtectedPending = roundCurrency(pendingProfit + pendingOwner + pendingTaxes);
  const pendingSalesToDistribute = isPeriodFullyDistributed 
    ? 0 
    : Math.max(0, roundCurrency(totalProtectedPending / ((config.profit + config.ownerPay + config.taxes) / 100)));

  const [allocationInput, setAllocationInput] = useState<string>(() => {
    return pendingSalesToDistribute > 0 ? String(pendingSalesToDistribute) : '0';
  });

  // Sync default input with pending sales to distribute whenever period changes
  useEffect(() => {
    if (pendingSalesToDistribute > 0) {
      setAllocationInput(String(pendingSalesToDistribute));
    } else {
      setAllocationInput('0');
    }
  }, [periodFilter, pendingSalesToDistribute]);

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showProfitModal, setShowProfitModal] = useState<boolean>(false);
  const [transferTarget, setTransferTarget] = useState<'profit_vault' | 'owner_payout' | 'tax_reserve'>('profit_vault');
  const [transferAmountStr, setTransferAmountStr] = useState<string>('50000');
  const [transferSuccessMsg, setTransferSuccessMsg] = useState<string | null>(null);

  const parsedRevenue = parseFloat(allocationInput) || 0;

  // Today's total sales (sum of today's income transactions)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todaySales = useMemo(() => {
    return transactions
      .filter(t => t.date === todayStr && t.type === 'income')
      .reduce((sum, t) => sum + (t.netAmount || t.grossAmount), 0);
  }, [transactions, todayStr]);

  const todaySalesCount = useMemo(() => {
    return transactions.filter(t => t.date === todayStr && t.type === 'income').length;
  }, [transactions, todayStr]);

  // Current liquid cash available in accounts
  const liquidity = useMemo(() => {
    return calculateCurrentLiquidity(settings, transactions, []);
  }, [settings, transactions]);

  // Period financial diagnosis
  const periodDeficit = pockets.actual.opEx > pockets.theoretical.opEx;
  const periodNetOperationalResult = pockets.totalNetRevenue - pockets.actual.opEx;
  const isOperatingLoss = periodNetOperationalResult < 0;

  // Real-time splits for the calculator (strictly whole integers for CLP)
  const splitProfit = isCLP ? Math.round(parsedRevenue * (config.profit / 100)) : Number((parsedRevenue * (config.profit / 100)).toFixed(2));
  const splitOwner = isCLP ? Math.round(parsedRevenue * (config.ownerPay / 100)) : Number((parsedRevenue * (config.ownerPay / 100)).toFixed(2));
  const splitTaxes = isCLP ? Math.round(parsedRevenue * (config.taxes / 100)) : Number((parsedRevenue * (config.taxes / 100)).toFixed(2));
  const splitOpEx = isCLP ? Math.round(parsedRevenue * (config.opEx / 100)) : Number((parsedRevenue * (config.opEx / 100)).toFixed(2));

  // Projected liquidity after executing the calculated distribution
  const totalOutflowTransfer = splitProfit + splitOwner + splitTaxes;
  const projectedBankAfterTransfer = liquidity.bank - totalOutflowTransfer;

  // Execute transfer handler
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(transferAmountStr) || 0;
    const amount = isCLP ? Math.round(parsedAmount) : Number(parsedAmount.toFixed(2));
    if (amount <= 0) return;

    let concept = 'Transferencia a Reserva de Ganancias / Fondo de Emergencia';
    let category: any = 'profit_distribution';

    if (transferTarget === 'owner_payout') {
      concept = 'Pago de Sueldo del Dueño (Owner Draw)';
      category = 'owner_draw';
    } else if (transferTarget === 'tax_reserve') {
      concept = 'Provisión Fiscal para Impuestos (IVA/PPM)';
      category = 'tax_reserve';
    }

    const newTx: Transaction = {
      id: `tx-transfer-${Date.now()}`,
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      concept,
      category,
      outflowMethod: 'bank_transfer',
      grossAmount: amount,
      feeAmount: 0,
      netAmount: amount,
    };

    onAddTransaction(newTx);
    setShowTransferModal(false);
    setTransferSuccessMsg(`¡Transferencia registrada con éxito! ${concept} • ${formatCurrency(amount, settings.currencySymbol)}`);
    setTimeout(() => {
      setTransferSuccessMsg(null);
    }, 5000);
  };

  // Export report
  const handleExportReport = () => {
    const csvContent = [
      ['--- REPORTE DISTRIBUCIÓN 4 BOLSILLOS (PROFIT FIRST) ---'],
      ['Período Seleccionado', getPeriodLabel(periodFilter)],
      ['Ingresos Netos del Período', pockets.totalNetRevenue.toFixed(2)],
      [],
      ['Bolsillo / Pocket', 'Porcentaje Meta', 'Monto Teórico Período', 'Monto Real Ejecutado', 'Porcentaje Real'],
      ['Ganancia / Fondo Emergencia', `${config.profit}%`, pockets.theoretical.profit.toFixed(2), pockets.actual.profit.toFixed(2), `${pockets.percentages.profit}%`],
      ['Sueldo del Dueño', `${config.ownerPay}%`, pockets.theoretical.owner.toFixed(2), pockets.actual.owner.toFixed(2), `${pockets.percentages.owner}%`],
      ['Provisión de Impuestos', `${config.taxes}%`, pockets.theoretical.taxes.toFixed(2), pockets.actual.taxes.toFixed(2), `${pockets.percentages.taxes}%`],
      ['Costos Operativos (OpEx)', `${config.opEx}%`, pockets.theoretical.opEx.toFixed(2), pockets.actual.opEx.toFixed(2), `${pockets.percentages.opEx}%`],
      [],
      ['Fondo de Emergencia Actual', pockets.reserveVault.current.toFixed(2)],
      ['Meta Fondo (3 Meses OpEx)', pockets.reserveVault.target.toFixed(2)],
      ['% Cobertura Fondo', `${pockets.reserveVault.percentage}%`],
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Profit_First_${periodFilter.mode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Unified Period Filter Bar */}
      <PeriodFilterBar
        filter={periodFilter}
        onChangeFilter={setPeriodFilter}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Distribución 4 Bolsillos (Profit First)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Asignación en tiempo real y análisis de bolsillos financieros sobre ingresos reales
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="hidden lg:flex items-center gap-1.5 bg-[#F1F5F9] border border-[#CBD5E1] px-3 py-2 rounded-md text-xs">
            <Coins className="w-3.5 h-3.5 text-[#006C49]" />
            <span className="text-[#64748B]">Ingresos Líquidos Período:</span>
            <span className="font-bold font-mono-num text-[#0F172A]">
              {formatCurrency(pockets.totalNetRevenue, settings.currencySymbol, 0)}
            </span>
          </div>

          <button
            onClick={handleExportReport}
            className="bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] px-3.5 py-2.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006C49]" />
            <span>Exportar Reporte</span>
          </button>

          <button
            onClick={() => setShowProfitModal(true)}
            className="bg-[#006C49] hover:bg-[#005438] text-white px-3.5 py-2.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4 stroke-[2.5]" />
            <span>Distribuir Utilidades / Socios</span>
          </button>
        </div>
      </div>

      {transferSuccessMsg && (
        <div className="p-3.5 bg-[#DCFCE7] border border-[#86EFAC] text-[#006C49] rounded-md text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
          <span>{transferSuccessMsg}</span>
          <button 
            onClick={() => setTransferSuccessMsg(null)}
            className="text-[#006C49] font-bold ml-2 hover:opacity-80 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Period Completed Status Banner */}
      {isPeriodFullyDistributed ? (
        <div className="bg-gradient-to-r from-[#ECFDF5] via-[#F0FDF4] to-white border border-[#86EFAC] rounded-lg p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#006C49] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-[#0F172A]">
                  ¡Distribución {periodFilter.mode === 'week' ? 'Semanal' : 'del Período'} 100% Completada!
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#006C49] text-white">
                  ✓ Al día
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                Has apartado exitosamente <strong>{formatCurrency(totalProtectedActual, settings.currencySymbol, 0)}</strong> a tus 3 bolsillos protegidos (Ganancia {formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)}, Sueldo Dueño {formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)}, Impuestos {formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)}). Tu saldo restante en banco ({formatCurrency(liquidity.bank, settings.currencySymbol, 0)}) es <strong>100% fondo operativo (OpEx) libre para operar</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : pockets.totalNetRevenue > 0 && totalProtectedActual > 0 && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 shadow-xs flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span className="text-[#1E40AF]">
              Distribución en progreso: Llevas apartado <strong>{formatCurrency(totalProtectedActual, settings.currencySymbol, 0)}</strong> de una meta de <strong>{formatCurrency(totalProtectedTheoretical, settings.currencySymbol, 0)}</strong>. Falta transferir <strong>{formatCurrency(totalProtectedPending, settings.currencySymbol, 0)}</strong> a bolsillos (correspondiente al {config.profit + config.ownerPay + config.taxes}% de <strong>{formatCurrency(pendingSalesToDistribute, settings.currencySymbol, 0)}</strong> en nuevas ventas sin procesar).
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Left Column (4 cols) & Right Column (8 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Allocator & Reserve Vault */}
        <div className="md:col-span-4 flex flex-col gap-6">
          
          {/* Real-time Allocator Card with High-Volume Batch Support */}
          <section className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-[#006C49]" />
                    <span>CALCULADORA DE ASIGNACIÓN</span>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Calcula la distribución por lotes de venta o saldo real
                  </p>
                </div>
              </div>

              {/* Quick Batch Presets */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Cargar monto rápido a distribuir:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Option 1: Pending Sales to Distribute */}
                  <button
                    type="button"
                    onClick={() => setAllocationInput(pendingSalesToDistribute.toFixed(0))}
                    className={`flex flex-col items-center justify-center p-2 rounded border transition-colors cursor-pointer text-center group ${
                      pendingSalesToDistribute === 0
                        ? 'border-[#86EFAC] bg-[#F0FDF4] hover:bg-[#DCFCE7]'
                        : 'border-[#3B82F6] bg-[#EFF6FF] hover:bg-[#DBEAFE]'
                    }`}
                    title={pendingSalesToDistribute === 0 ? "¡Todo asignado en este período!" : `Ventas pendientes de procesar: ${formatCurrency(pendingSalesToDistribute, settings.currencySymbol, 0)} (${formatCurrency(totalProtectedPending, settings.currencySymbol, 0)} a transferir a bolsillos)`}
                  >
                    <span className="text-[10px] font-bold text-[#0F172A] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-[#3B82F6]" />
                      <span>Ventas x Asignar</span>
                    </span>
                    <span className={`text-[10px] font-mono-num font-bold mt-0.5 ${pendingSalesToDistribute === 0 ? 'text-[#006C49]' : 'text-[#2563EB]'}`}>
                      {formatCurrency(pendingSalesToDistribute, settings.currencySymbol, 0)}
                    </span>
                    <span className="text-[9px] text-[#64748B]">
                      {pendingSalesToDistribute === 0 ? '✓ Al día' : `Apartar: ${formatCurrency(totalProtectedPending, settings.currencySymbol, 0)}`}
                    </span>
                  </button>

                  {/* Option 2: Today's Total Sales */}
                  <button
                    type="button"
                    onClick={() => setAllocationInput(todaySales > 0 ? todaySales.toFixed(0) : '0')}
                    className="flex flex-col items-center justify-center p-2 rounded border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-center group"
                    title={`Suma de ${todaySalesCount} ventas registradas hoy`}
                  >
                    <span className="text-[10px] font-bold text-[#0F172A] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#006C49]" />
                      <span>Ventas Hoy</span>
                    </span>
                    <span className="text-[10px] font-mono-num font-bold text-[#006C49] mt-0.5">
                      {formatCurrency(todaySales, settings.currencySymbol, 0)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">
                      {todaySalesCount} {todaySalesCount === 1 ? 'venta' : 'ventas'}
                    </span>
                  </button>

                  {/* Option 3: Period Total Sales */}
                  <button
                    type="button"
                    onClick={() => setAllocationInput(pockets.totalNetRevenue > 0 ? pockets.totalNetRevenue.toFixed(0) : '0')}
                    className="flex flex-col items-center justify-center p-2 rounded border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-center group"
                    title="Ingresos líquidos totales del período seleccionado"
                  >
                    <span className="text-[10px] font-bold text-[#0F172A] flex items-center gap-1">
                      <PieIcon className="w-3 h-3 text-[#64748B]" />
                      <span>Total Período</span>
                    </span>
                    <span className="text-[10px] font-mono-num font-bold text-[#0F172A] mt-0.5">
                      {formatCurrency(pockets.totalNetRevenue, settings.currencySymbol, 0)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">
                      100% ingresos
                    </span>
                  </button>

                  {/* Option 4: Liquid Bank Balance */}
                  <button
                    type="button"
                    onClick={() => setAllocationInput(liquidity.bank > 0 ? liquidity.bank.toFixed(0) : '0')}
                    className="flex flex-col items-center justify-center p-2 rounded border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-center group"
                    title="Saldo líquido disponible actualmente en banco"
                  >
                    <span className="text-[10px] font-bold text-[#0F172A] flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-[#F59E0B]" />
                      <span>Banco Real</span>
                    </span>
                    <span className="text-[10px] font-mono-num font-bold text-[#F59E0B] mt-0.5">
                      {formatCurrency(liquidity.bank, settings.currencySymbol, 0)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">
                      Disponible
                    </span>
                  </button>
                </div>
              </div>

              {/* Currency Input */}
              <div className="relative mb-3 flex items-center">
                <span className="absolute left-0 top-0 bottom-0 px-3 bg-[#F1F5F9] border-r border-[#CBD5E1] flex items-center text-xs text-[#64748B] font-bold rounded-l-md">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  step="10"
                  value={allocationInput}
                  onChange={(e) => setAllocationInput(e.target.value)}
                  placeholder={settings.currency === 'CLP' ? "0" : "0.00"}
                  className="w-full pl-10 pr-3 py-2 text-lg font-bold text-right bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none font-mono-num"
                />
              </div>

              {/* Notice if the period is already 100% completed and the user typed the total revenue */}
              {isPeriodFullyDistributed && parsedRevenue === pockets.totalNetRevenue && (
                <div className="p-2.5 bg-[#ECFDF5] border border-[#86EFAC] rounded-md text-[10.5px] text-[#006C49] flex items-start gap-1.5 mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#006C49] shrink-0 mt-0.5" />
                  <span>
                    <strong>¡Ventas del período ya distribuidas!</strong> Los {formatCurrency(pockets.totalNetRevenue, settings.currencySymbol, 0)} de esta semana ya fueron 100% asignados a sus 3 bolsillos.
                  </span>
                </div>
              )}

              {/* 4 Bolsillos Splits List */}
              <div className="space-y-2.5 text-xs">
                {/* Profit Split */}
                <div className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-3.5 bg-[#006C49] rounded-full"></div>
                    <span className="font-semibold text-[#0F172A]">Ganancia / Fondo ({config.profit}%)</span>
                  </div>
                  <span className="font-bold font-mono-num text-[#0F172A]">
                    {formatCurrency(splitProfit, settings.currencySymbol)}
                  </span>
                </div>

                {/* Owner Split */}
                <div className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-3.5 bg-[#3B82F6] rounded-full"></div>
                    <span className="font-semibold text-[#0F172A]">Sueldo Dueño ({config.ownerPay}%)</span>
                  </div>
                  <span className="font-bold font-mono-num text-[#0F172A]">
                    {formatCurrency(splitOwner, settings.currencySymbol)}
                  </span>
                </div>

                {/* Tax Split */}
                <div className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-3.5 bg-[#F59E0B] rounded-full"></div>
                    <span className="font-semibold text-[#0F172A]">Impuestos ({config.taxes}%)</span>
                  </div>
                  <span className="font-bold font-mono-num text-[#0F172A]">
                    {formatCurrency(splitTaxes, settings.currencySymbol)}
                  </span>
                </div>

                {/* OpEx Split */}
                <div className="flex justify-between items-center py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-3.5 bg-[#64748B] rounded-full"></div>
                    <span className="font-semibold text-[#0F172A]">Costos OpEx ({config.opEx}%)</span>
                  </div>
                  <span className="font-bold font-mono-num text-[#0F172A]">
                    {formatCurrency(splitOpEx, settings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Safe Transfer Assessment Box */}
              {parsedRevenue > 0 && (
                <div className="mt-4 p-3 rounded-md border text-[11px] space-y-1.5 bg-[#F8FAFC] border-[#CBD5E1]">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[#475569] flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-[#006C49]" />
                      <span>Saldo actual en Banco:</span>
                    </span>
                    <span className="font-mono-num text-[#0F172A]">
                      {formatCurrency(liquidity.bank, settings.currencySymbol, 0)}
                    </span>
                  </div>

                  {isOperatingLoss ? (
                    <div className="p-2 bg-[#FEF2F2] border border-[#FECACA] rounded text-[#991B1B] text-[10.5px] leading-tight flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-0.5" />
                      <span>
                        <strong>Déficit en el período:</strong> Los gastos superaron las ventas. Se recomienda transferir <strong>únicamente Impuestos ({formatCurrency(splitTaxes, settings.currencySymbol, 0)})</strong> para no descapitalizar tu banco.
                      </span>
                    </div>
                  ) : projectedBankAfterTransfer < 0 ? (
                    <div className="p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded text-[#92400E] text-[10.5px] leading-tight flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                      <span>
                        <strong>Advertencia:</strong> Transferir este monto total ({formatCurrency(totalOutflowTransfer, settings.currencySymbol, 0)}) sobrepasará tu saldo disponible en banco.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[#006C49] font-medium pt-0.5">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#006C49]" />
                        <span>Quedará en OpEx / Banco:</span>
                      </span>
                      <span className="font-bold font-mono-num">
                        {formatCurrency(projectedBankAfterTransfer, settings.currencySymbol, 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Action Button to Execute Transfer from Calculator */}
              <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                <button
                  onClick={() => {
                    setTransferAmountStr(splitProfit > 0 ? String(splitProfit) : '50000');
                    setShowTransferModal(true);
                  }}
                  className="w-full bg-[#006C49] hover:bg-[#005438] text-white py-2.5 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>
                    {isPeriodFullyDistributed && parsedRevenue === pockets.totalNetRevenue
                      ? 'Ejecutar Asignación Manual / Extra'
                      : 'Ejecutar Transferencia a Bolsillos'}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Reserve Fund Tracker (Vault) */}
          <section className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  FONDO DE RESERVA Y EMERGENCIA
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Meta: {config.reserveMonthsTarget} Meses de Costos Operativos
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#006C49]" />
            </div>

            <div className="mb-2">
              <span className="text-xl font-bold text-[#0F172A] font-mono-num">
                {formatCurrency(pockets.reserveVault.current, settings.currencySymbol, 0)}
              </span>
              <span className="text-xs text-[#64748B] ml-1 font-mono-num">
                / {formatCurrency(pockets.reserveVault.target, settings.currencySymbol, 0)}
              </span>
            </div>
            
            <p className="text-[10px] text-[#94A3B8] mb-3">
              Cálculo: {config.reserveMonthsTarget} meses x {formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)} (OpEx del período)
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden mb-1">
              <div 
                className="bg-[#006C49] h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, pockets.reserveVault.percentage)}%` }}
              />
            </div>
            <p className="text-[11px] font-mono-num text-[#64748B] text-right font-semibold">
              {pockets.reserveVault.percentage}% Financiado
            </p>
          </section>

        </div>

        {/* Right Column: Pockets Bento & Analysis Chart */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {pockets.totalNetRevenue === 0 ? (
            <div className="flex-1 bg-white border border-[#CBD5E1] rounded-lg shadow-xs flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
              <div className="w-16 h-16 bg-[#F8FAFC] border border-[#CBD5E1] rounded-full flex items-center justify-center mb-4">
                 <TrendingUp className="w-8 h-8 text-[#94A3B8]" />
              </div>
              <h3 className="text-[#0F172A] font-bold text-lg mb-2">Sin Ingresos en {getPeriodLabel(periodFilter)}</h3>
              <p className="text-[#64748B] text-sm max-w-sm">
                La metodología Profit First requiere ventas para distribuir y analizar los porcentajes de forma real.
                <br/><br/>Tus gastos en este período son <strong className="text-[#0F172A]">{formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)}</strong>. Registra ventas o amplía el período para habilitar los gráficos y el análisis contra la meta teórica.
              </p>
            </div>
          ) : (
            <>
              {/* Bento Grid: 4 Pocket Status Cards for the Period */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Profit Card */}
                <div className={`bg-white border rounded-lg p-3.5 hover:bg-[#F8FAFC] transition-colors shadow-xs flex flex-col justify-between ${isOperatingLoss ? 'border-[#E2E8F0] opacity-80' : 'border-[#CBD5E1]'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-2 border-b-2 border-[#006C49] pb-1">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase">Ganancia</span>
                      <TrendingUp className="w-3.5 h-3.5 text-[#006C49]" />
                    </div>
                    <div className="mb-2">
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Transferido (Real)</div>
                      <div className="text-lg font-bold text-[#0F172A] font-mono-num leading-none">
                        {formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono-num text-[#64748B] bg-[#F1F5F9] p-1.5 rounded flex justify-between items-center mb-2">
                      <span>Meta ({config.profit}%):</span>
                      <span className="text-[#006C49] font-bold">{formatCurrency(pockets.theoretical.profit, settings.currencySymbol, 0)}</span>
                    </div>
                  </div>
                  {isOperatingLoss ? (
                    <div className="text-[9.5px] text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] py-1 px-1.5 rounded text-center font-medium">
                      Pausa: Déficit Operativo
                    </div>
                  ) : pockets.actual.profit >= pockets.theoretical.profit && pockets.theoretical.profit > 0 ? (
                    <div className="w-full bg-[#ECFDF5] border border-[#86EFAC] py-1 px-2 rounded flex items-center justify-between text-[10px] text-[#006C49] font-bold">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>100% Apartado</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget('profit_vault');
                          setTransferAmountStr('50000');
                          setShowTransferModal(true);
                        }}
                        className="text-[9px] font-semibold text-[#006C49] hover:underline cursor-pointer"
                      >
                        + Extra
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTransferTarget('profit_vault');
                        setTransferAmountStr(String(pendingProfit > 0 ? pendingProfit : splitProfit));
                        setShowTransferModal(true);
                      }}
                      className="w-full text-[10px] font-bold text-[#006C49] bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#86EFAC] py-1.5 rounded transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Apartar ({formatCurrency(pendingProfit > 0 ? pendingProfit : splitProfit, settings.currencySymbol, 0)}) &rarr;</span>
                    </button>
                  )}
                </div>

                {/* Owner Card */}
                <div className="bg-white border border-[#CBD5E1] rounded-lg p-3.5 hover:bg-[#F8FAFC] transition-colors shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2 border-b-2 border-[#3B82F6] pb-1">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase">Dueño</span>
                      <UserCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                    </div>
                    <div className="mb-2">
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Transferido (Real)</div>
                      <div className="text-lg font-bold text-[#0F172A] font-mono-num leading-none">
                        {formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono-num text-[#64748B] bg-[#F1F5F9] p-1.5 rounded flex justify-between items-center mb-2">
                      <span>Meta ({config.ownerPay}%):</span>
                      <span className="text-[#3B82F6] font-bold">{formatCurrency(pockets.theoretical.owner, settings.currencySymbol, 0)}</span>
                    </div>
                  </div>
                  {pockets.actual.owner >= pockets.theoretical.owner && pockets.theoretical.owner > 0 ? (
                    <div className="w-full bg-[#EFF6FF] border border-[#BFDBFE] py-1 px-2 rounded flex items-center justify-between text-[10px] text-[#1D4ED8] font-bold">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>100% Apartado</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget('owner_payout');
                          setTransferAmountStr('100000');
                          setShowTransferModal(true);
                        }}
                        className="text-[9px] font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        + Extra
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTransferTarget('owner_payout');
                        setTransferAmountStr(String(pendingOwner > 0 ? pendingOwner : splitOwner));
                        setShowTransferModal(true);
                      }}
                      className="w-full text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] py-1.5 rounded transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Apartar ({formatCurrency(pendingOwner > 0 ? pendingOwner : splitOwner, settings.currencySymbol, 0)}) &rarr;</span>
                    </button>
                  )}
                </div>

                {/* Tax Card */}
                <div className="bg-white border border-[#CBD5E1] rounded-lg p-3.5 hover:bg-[#F8FAFC] transition-colors shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2 border-b-2 border-[#F59E0B] pb-1">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase">Impuestos</span>
                      <Landmark className="w-3.5 h-3.5 text-[#F59E0B]" />
                    </div>
                    <div className="mb-2">
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Transferido (Real)</div>
                      <div className="text-lg font-bold text-[#0F172A] font-mono-num leading-none">
                        {formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono-num text-[#64748B] bg-[#F1F5F9] p-1.5 rounded flex justify-between items-center mb-2">
                      <span>Meta ({config.taxes}%):</span>
                      <span className="text-[#F59E0B] font-bold">{formatCurrency(pockets.theoretical.taxes, settings.currencySymbol, 0)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {pockets.actual.taxes >= pockets.theoretical.taxes && pockets.theoretical.taxes > 0 ? (
                      <div className="w-full bg-[#FFFBEB] border border-[#FDE68A] py-1 px-2 rounded flex items-center justify-between text-[10px] text-[#B45309] font-bold">
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>100% Apartado</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferTarget('tax_reserve');
                            setTransferAmountStr('100000');
                            setShowTransferModal(true);
                          }}
                          className="text-[9px] font-semibold text-[#B45309] hover:underline cursor-pointer"
                        >
                          + Extra
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget('tax_reserve');
                          setTransferAmountStr(String(pendingTaxes > 0 ? pendingTaxes : splitTaxes));
                          setShowTransferModal(true);
                        }}
                        className="w-full text-[10px] font-bold text-[#B45309] bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] py-1.5 rounded transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                      >
                        <Landmark className="w-3 h-3" />
                        <span>Apartar ({formatCurrency(pendingTaxes > 0 ? pendingTaxes : splitTaxes, settings.currencySymbol, 0)}) &rarr;</span>
                      </button>
                    )}
                    {onOpenF29Modal && (
                      <button
                        type="button"
                        onClick={() => onOpenF29Modal(periodFilter.selectedMonth || undefined)}
                        className="w-full text-[9px] text-[#006C49] hover:underline font-semibold text-center cursor-pointer block pt-0.5"
                      >
                        Ver Formulario F29 SII
                      </button>
                    )}
                  </div>
                </div>

                {/* OpEx Card */}
                <div className={`bg-white border rounded-lg p-3.5 hover:bg-[#F8FAFC] transition-colors shadow-xs flex flex-col justify-between ${periodDeficit ? 'border-[#FCA5A5]' : 'border-[#CBD5E1]'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-2 border-b-2 border-[#DC2626] pb-1">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase">OpEx (Gastos)</span>
                      <AlertTriangle className={`w-3.5 h-3.5 ${periodDeficit ? 'text-[#DC2626]' : 'text-[#64748B]'}`} />
                    </div>
                    <div className="mb-2">
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Ejecutado (Real)</div>
                      <div className={`text-lg font-bold font-mono-num leading-none ${periodDeficit ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                        {formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono-num text-[#64748B] bg-[#F1F5F9] p-1.5 rounded flex justify-between items-center">
                      <span>Meta ({config.opEx}%):</span>
                      <span className="text-[#DC2626] font-bold">{formatCurrency(pockets.theoretical.opEx, settings.currencySymbol, 0)}</span>
                    </div>
                  </div>
                  {periodDeficit ? (
                    <div className="mt-2 text-[9.5px] text-[#DC2626] font-bold bg-[#FEF2F2] border border-[#FECACA] py-1 px-1.5 rounded text-center">
                      Exceso: +{formatCurrency(pockets.actual.opEx - pockets.theoretical.opEx, settings.currencySymbol, 0)}
                    </div>
                  ) : (
                    <div className="mt-2 text-[9.5px] text-[#006C49] font-semibold bg-[#ECFDF5] border border-[#A7F3D0] py-1 px-1.5 rounded text-center">
                      ✓ Gastos dentro de meta
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Chart Area: Theoretical vs Actual Spend (Filtered Period) */}
              <section className="bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col gap-5">
                {/* Header with clear title */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#F1F5F9] pb-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#006C49]" />
                      <span>Cumplimiento de Bolsillos: Meta vs. Real ({getPeriodLabel(periodFilter)})</span>
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Compara el dinero que debías apartar/gastar (Meta) contra lo efectivamente transferido y gastado (Real)
                    </p>
                  </div>
                </div>

                {/* Comparative Visual Graph with direct value tags */}
                {(() => {
                  const maxAmount = Math.max(
                    pockets.theoretical.profit,
                    pockets.actual.profit,
                    pockets.theoretical.owner,
                    pockets.actual.owner,
                    pockets.theoretical.taxes,
                    pockets.actual.taxes,
                    pockets.theoretical.opEx,
                    pockets.actual.opEx,
                    1000
                  );

                  const getBarHeight = (amount: number) => {
                    if (amount <= 0) return 4;
                    return Math.max(8, Math.round((amount / maxAmount) * 100));
                  };

                  return (
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 pt-6">
                      <div className="text-[11px] font-bold text-[#475569] mb-4 text-center">
                        COMPARACIÓN GRÁFICA DE MONTOS ($) EN EL PERÍODO
                      </div>
                      
                      <div className="flex items-end justify-around gap-4 h-48 border-b border-[#CBD5E1] pb-3 relative">
                        {/* Background guide lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                          <div className="w-full border-t border-[#64748B]"></div>
                          <div className="w-full border-t border-[#64748B]"></div>
                          <div className="w-full border-t border-[#64748B]"></div>
                        </div>

                        {/* 1. Ganancia Bars */}
                        <div className="flex flex-col items-center gap-2 z-10 w-full max-w-[110px]">
                          <div className="flex items-end gap-2 h-36 w-full justify-center">
                            {/* Meta */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#64748B] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.theoretical.profit, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#CBD5E1] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.theoretical.profit)}%` }}
                                title={`Meta: ${formatCurrency(pockets.theoretical.profit, settings.currencySymbol, 0)} (${config.profit}%)`}
                              />
                            </div>
                            {/* Real */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#006C49] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#006C49] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.actual.profit)}%` }}
                                title={`Real Transferido: ${formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)} (${pockets.percentages.profit}%)`}
                              />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-bold text-[#0F172A] block">GANANCIA</span>
                            <span className="text-[9px] font-mono-num text-[#006C49] font-bold">
                              {formatCurrency(pockets.actual.profit, settings.currencySymbol, 0)}
                            </span>
                          </div>
                        </div>

                        {/* 2. Dueño Bars */}
                        <div className="flex flex-col items-center gap-2 z-10 w-full max-w-[110px]">
                          <div className="flex items-end gap-2 h-36 w-full justify-center">
                            {/* Meta */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#64748B] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.theoretical.owner, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#CBD5E1] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.theoretical.owner)}%` }}
                                title={`Meta: ${formatCurrency(pockets.theoretical.owner, settings.currencySymbol, 0)} (${config.ownerPay}%)`}
                              />
                            </div>
                            {/* Real */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#2563EB] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#3B82F6] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.actual.owner)}%` }}
                                title={`Real Transferido: ${formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)} (${pockets.percentages.owner}%)`}
                              />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-bold text-[#0F172A] block">DUEÑO</span>
                            <span className="text-[9px] font-mono-num text-[#2563EB] font-bold">
                              {formatCurrency(pockets.actual.owner, settings.currencySymbol, 0)}
                            </span>
                          </div>
                        </div>

                        {/* 3. Impuestos Bars */}
                        <div className="flex flex-col items-center gap-2 z-10 w-full max-w-[110px]">
                          <div className="flex items-end gap-2 h-36 w-full justify-center">
                            {/* Meta */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#64748B] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.theoretical.taxes, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#CBD5E1] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.theoretical.taxes)}%` }}
                                title={`Meta: ${formatCurrency(pockets.theoretical.taxes, settings.currencySymbol, 0)} (${config.taxes}%)`}
                              />
                            </div>
                            {/* Real */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#D97706] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#F59E0B] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.actual.taxes)}%` }}
                                title={`Real Transferido: ${formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)} (${pockets.percentages.taxes}%)`}
                              />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-bold text-[#0F172A] block">IMPUESTOS</span>
                            <span className="text-[9px] font-mono-num text-[#D97706] font-bold">
                              {formatCurrency(pockets.actual.taxes, settings.currencySymbol, 0)}
                            </span>
                          </div>
                        </div>

                        {/* 4. OpEx Bars */}
                        <div className="flex flex-col items-center gap-2 z-10 w-full max-w-[110px]">
                          <div className="flex items-end gap-2 h-36 w-full justify-center">
                            {/* Meta */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#64748B] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.theoretical.opEx, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className="w-full bg-[#CBD5E1] rounded-t-sm transition-all duration-300"
                                style={{ height: `${getBarHeight(pockets.theoretical.opEx)}%` }}
                                title={`Meta Máxima OpEx: ${formatCurrency(pockets.theoretical.opEx, settings.currencySymbol, 0)} (${config.opEx}%)`}
                              />
                            </div>
                            {/* Real */}
                            <div className="flex flex-col items-center w-1/2 max-w-[36px] h-full justify-end group">
                              <span className="text-[8.5px] font-mono-num text-[#DC2626] mb-1 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)}
                              </span>
                              <div 
                                className={`w-full rounded-t-sm transition-all duration-300 ${periodDeficit ? 'bg-[#DC2626]' : 'bg-[#64748B]'}`}
                                style={{ height: `${getBarHeight(pockets.actual.opEx)}%` }}
                                title={`Gastos Reales: ${formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)} (${pockets.percentages.opEx}%)`}
                              />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-bold text-[#0F172A] block">OPEX (GASTOS)</span>
                            <span className={`text-[9px] font-mono-num font-bold ${periodDeficit ? 'text-[#DC2626]' : 'text-[#475569]'}`}>
                              {formatCurrency(pockets.actual.opEx, settings.currencySymbol, 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Informative footer */}
                      <div className="mt-3 flex items-center justify-between text-[10px] text-[#64748B] pt-2 border-t border-[#E2E8F0]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#006C49]" />
                          <span><strong>Barra gris:</strong> Meta esperada según tus % de Profit First.</span>
                        </span>
                        <span><strong>Barra de color:</strong> Dinero real que ya transferiste o gastaste.</span>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </>
          )}
        </div>

      </div>

      {/* Execute Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-[#CBD5E1]">
            <h3 className="text-base font-bold text-[#0F172A] mb-1">
              Ejecutar Transferencia entre Bolsillos
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              Distribuye los fondos según el método Profit First
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Destino de la Transferencia
                </label>
                <select
                  value={transferTarget}
                  onChange={(e) => {
                    const newTarget = e.target.value as any;
                    setTransferTarget(newTarget);
                    if (newTarget === 'profit_vault') {
                      setTransferAmountStr(String(splitProfit));
                    } else if (newTarget === 'owner_payout') {
                      setTransferAmountStr(String(splitOwner));
                    } else if (newTarget === 'tax_reserve') {
                      setTransferAmountStr(String(splitTaxes));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none font-medium"
                >
                  <option value="profit_vault">1. Ganancia / Fondo de Emergencia ({config.profit}%)</option>
                  <option value="owner_payout">2. Sueldo / Retiro del Dueño ({config.ownerPay}%)</option>
                  <option value="tax_reserve">3. Cuenta Provisión de Impuestos ({config.taxes}%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Monto a Transferir
                </label>
                <div className="relative flex items-center mb-2">
                  <span className="absolute left-0 top-0 bottom-0 px-3 bg-[#F1F5F9] border-r border-[#CBD5E1] flex items-center text-xs text-[#64748B] font-bold rounded-l-md">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step={isCLP ? "any" : "0.01"}
                    min="1"
                    value={transferAmountStr}
                    onChange={(e) => setTransferAmountStr(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2 text-sm font-bold text-right bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none font-mono-num"
                  />
                </div>

                {parsedRevenue > 0 && (
                  <div className="pt-1">
                    {/* Profit First Rule Explanatory Box */}
                    <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-[11px] text-[#64748B] flex items-start gap-2">
                      <span className="text-sm">ℹ️</span>
                      <span>
                        <strong className="text-[#334155] font-semibold">Regla Profit First:</strong> El <strong>{config.opEx}% restante ({formatCurrency(splitOpEx, settings.currencySymbol)})</strong> permanece en la cuenta corriente principal para cubrir los gastos operativos diarios (OpEx) y no requiere transferencia.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-md transition-colors"
                >
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profit Distribution & Partner Payouts Modal */}
      {showProfitModal && (
        <ProfitDistributionModal
          isOpen={showProfitModal}
          onClose={() => setShowProfitModal(false)}
          settings={settings}
          transactions={transactions}
          onAddTransaction={onAddTransaction}
          onUpdatePartners={onUpdatePartners}
          defaultPeriodFilter={periodFilter}
        />
      )}
    </div>
  );
};
