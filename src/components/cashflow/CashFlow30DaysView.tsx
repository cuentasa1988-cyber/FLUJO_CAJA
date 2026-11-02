import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet, 
  Building2, 
  Coins, 
  Info, 
  Filter, 
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  AppSettings, 
  Payable, 
  Receivable, 
  Transaction, 
  OutflowMethod 
} from '../../types';
import { 
  calculateCurrentLiquidity, 
  formatCurrency, 
  getLocalDateString 
} from '../../utils/financial';
import { calculate30DayForecast, DayForecast } from '../../utils/cashFlow30Days';
import { ReceivablesTab } from './ReceivablesTab';

interface CashFlow30DaysViewProps {
  settings: AppSettings;
  payables: Payable[];
  receivables: Receivable[];
  transactions: Transaction[];
  onAddReceivable: (receivable: Receivable | Receivable[]) => void;
  onUpdateReceivable: (receivable: Receivable) => void;
  onDeleteReceivable: (id: string) => void;
  onRecordReceivableCollection: (
    receivable: Receivable,
    amount: number,
    destinationMethod: OutflowMethod,
    date: string,
    time: string,
    reference?: string
  ) => void;
  onNavigateToPayables?: () => void;
}

export const CashFlow30DaysView: React.FC<CashFlow30DaysViewProps> = ({
  settings,
  payables,
  receivables,
  transactions,
  onAddReceivable,
  onUpdateReceivable,
  onDeleteReceivable,
  onRecordReceivableCollection,
  onNavigateToPayables,
}) => {
  const currencySymbol = settings.currencySymbol || '$';
  const isCLP = settings.currency === 'CLP';

  // Active view tab: projection vs accounts receivable
  const [activeTab, setActiveTab] = useState<'forecast' | 'receivables'>('forecast');
  
  // Projection Horizon: 30, 60 or 90 days
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  
  // Forecast controls
  const [includeSalesAvg, setIncludeSalesAvg] = useState<boolean>(false);
  const [onlyDaysWithActivity, setOnlyDaysWithActivity] = useState<boolean>(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState<DayForecast | null>(null);

  // 1. Calculate Real Liquidity Right Now (Bank + Cash Drawer)
  const liquidity = useMemo(() => {
    return calculateCurrentLiquidity(settings, transactions, payables);
  }, [settings, transactions, payables]);

  // 2. Calculate the forecast based on real data for the chosen horizon (30, 60, or 90 days)
  const forecast = useMemo(() => {
    return calculate30DayForecast(
      liquidity.bank,
      liquidity.cashDrawer,
      payables,
      receivables,
      transactions,
      {
        daysAhead: horizonDays,
        includeHistoricalSalesAverage: includeSalesAvg,
        salesLookbackDays: 14,
      }
    );
  }, [liquidity.bank, liquidity.cashDrawer, payables, receivables, transactions, horizonDays, includeSalesAvg]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return forecast.days.map(d => ({
      name: d.formattedDate,
      rawDate: d.date,
      balance: d.closingBalance,
      inflows: d.totalInflows,
      outflows: d.totalOutflows,
      net: d.netFlow,
      dayName: d.dayName,
      receivablesCount: d.scheduledReceivables.length,
      payablesCount: d.scheduledPayables.length,
    }));
  }, [forecast.days]);

  // Filtered days table
  const displayedDays = useMemo(() => {
    if (onlyDaysWithActivity) {
      return forecast.days.filter(d => d.hasActivity || d.dayIndex === 0 || d.dayIndex === forecast.days.length - 1);
    }
    return forecast.days;
  }, [forecast.days, onlyDaysWithActivity]);

  const pendingReceivablesCount = receivables.filter(r => r.status !== 'collected').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header Section */}
      <div className="bg-white border border-[#CBD5E1] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">
                Crédito y Cobranza (Flujo a {horizonDays} Días)
              </h1>
              
              {/* Horizon Selector Pill (30 Días / 60 Días / 90 Días) */}
              {activeTab === 'forecast' && (
                <div className="inline-flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#CBD5E1]">
                  <button
                    type="button"
                    onClick={() => setHorizonDays(30)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      horizonDays === 30
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    30 Días (1 Mes)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizonDays(60)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      horizonDays === 60
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    60 Días (2 Meses)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizonDays(90)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      horizonDays === 90
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    90 Días (Trimestre)
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 max-w-2xl">
              Proyección de liquidez diaria a {horizonDays} días cruzando tus saldos actuales en Banco y Caja con los cobros de clientes y pagos a proveedores.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#CBD5E1] self-start lg:self-auto shrink-0">
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'forecast'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <CalendarDays className="w-4 h-4 text-[#0284C7]" />
              <span>Calendario y Curva ({horizonDays}d)</span>
            </button>
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'receivables'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Receipt className="w-4 h-4 text-[#006C49]" />
              <span>Cuentas por Cobrar</span>
              {pendingReceivablesCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#0284C7] text-white text-[10px] font-extrabold rounded-full">
                  {pendingReceivablesCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RENDER CONDITIONAL: Tab Receivables vs Forecast */}
      {activeTab === 'receivables' ? (
        <ReceivablesTab
          receivables={receivables}
          currencySymbol={currencySymbol}
          onAddReceivable={onAddReceivable}
          onUpdateReceivable={onUpdateReceivable}
          onDeleteReceivable={onDeleteReceivable}
          onRecordCollection={onRecordReceivableCollection}
        />
      ) : (
        /* FORECAST VIEW */
        <div className="space-y-6">
          {/* KPI Cards: Starting Liquidity, Committed Inflows, Committed Outflows, Final Projected Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Saldo Real Hoy */}
            <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Liquidez Real Hoy
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] text-[#0F172A] flex items-center justify-center">
                  <Wallet className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                {formatCurrency(forecast.startingTotalLiquidity, currencySymbol)}
              </p>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F1F5F9] text-[11px] text-[#64748B]">
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="w-3 h-3 text-[#0284C7]" />
                  Banco: {formatCurrency(forecast.startingBank, currencySymbol)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <Coins className="w-3 h-3 text-[#006C49]" />
                  Caja: {formatCurrency(forecast.startingCashDrawer, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Cobros Comprometidos */}
            <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Cobros Programados ({horizonDays}d)
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-[#006C49] tracking-tight">
                +{formatCurrency(forecast.totalReceivables30Days, currencySymbol)}
              </p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                Entradas desde Cuentas por Cobrar
              </p>
            </div>

            {/* Pagos Comprometidos */}
            <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Pagos Programados ({horizonDays}d)
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-[#DC2626] tracking-tight">
                -{formatCurrency(forecast.totalPayables30Days, currencySymbol)}
              </p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                Salidas desde Cuentas por Pagar
              </p>
            </div>

            {/* Saldo Proyectado al Final del Horizonte */}
            <div className={`p-4 rounded-xl border shadow-xs ${
              forecast.hasDeficitRisk 
                ? 'bg-[#FEF2F2] border-[#FCA5A5]' 
                : 'bg-white border-[#CBD5E1]'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  forecast.hasDeficitRisk ? 'text-[#991B1B]' : 'text-[#64748B]'
                }`}>
                  Saldo Proyectado (Día {horizonDays})
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  forecast.hasDeficitRisk ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#E0F2FE] text-[#0284C7]'
                }`}>
                  {forecast.hasDeficitRisk ? (
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  )}
                </div>
              </div>
              <p className={`text-2xl font-extrabold tracking-tight ${
                forecast.projectedFinalBalance < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
              }`}>
                {formatCurrency(forecast.projectedFinalBalance, currencySymbol)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-bold ${
                  forecast.net30DayChange >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'
                }`}>
                  {forecast.net30DayChange >= 0 ? '+' : ''}
                  {formatCurrency(forecast.net30DayChange, currencySymbol)}
                </span>
                <span className="text-[11px] text-[#64748B]">vs saldo actual</span>
              </div>
            </div>
          </div>

          {/* Smart Treasury Diagnostic Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            forecast.hasDeficitRisk
              ? 'bg-[#FEF2F2] border-[#F87171] text-[#7F1D1D]'
              : 'bg-[#F0FDF4] border-[#86EFAC] text-[#14532D]'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                forecast.hasDeficitRisk ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'
              }`}>
                {forecast.hasDeficitRisk ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  {forecast.hasDeficitRisk 
                    ? `Atención: Alerta de Liquidez Detectada en los Próximos ${horizonDays} Días`
                    : `Diagnóstico de Tesorería: Flujo de Caja Cubierto a ${horizonDays} Días`
                  }
                </h4>
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                  {forecast.hasDeficitRisk ? (
                    <>
                      El día <strong>{forecast.firstDeficitDate}</strong> se proyecta un saldo negativo de{' '}
                      <strong>{formatCurrency(forecast.lowestProjectedBalance, currencySymbol)}</strong> debido a la concentración de vencimientos de cuentas por pagar.{' '}
                      Recomendación: Contactar a tus clientes para anticipar cobranzas o negociar una prórroga de pago con proveedores.
                    </>
                  ) : (
                    <>
                      Tus saldos actuales sumados a los cobros programados permiten cubrir holgadamente todas las facturas y cuotas de los próximos {horizonDays} días.{' '}
                      Tu punto de saldo más bajo será el <strong>{forecast.lowestBalanceDate}</strong> con{' '}
                      <strong>{formatCurrency(forecast.lowestProjectedBalance, currencySymbol)}</strong> disponibles.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Quick action helper button */}
            {forecast.hasDeficitRisk && onNavigateToPayables && (
              <button
                onClick={onNavigateToPayables}
                className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-md shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Revisar Cuentas por Pagar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Calculation Mode Switcher Toolbar */}
          <div className="bg-white border border-[#CBD5E1] rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#64748B]" />
              <span className="text-xs font-bold text-[#334155]">
                Metodología de Proyección:
              </span>
              <div className="inline-flex rounded-md p-0.5 bg-[#F1F5F9] border border-[#CBD5E1]">
                <button
                  onClick={() => setIncludeSalesAvg(false)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                    !includeSalesAvg
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Modo Estricto (Solo Facturas/Compromisos)
                </button>
                <button
                  onClick={() => setIncludeSalesAvg(true)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                    includeSalesAvg
                      ? 'bg-white text-[#0284C7] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Modo Operativo (+ Promedio ventas recientes)
                </button>
              </div>
            </div>

            <div className="text-xs text-[#64748B] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
              {includeSalesAvg ? (
                <span>
                  Sumando <strong>{formatCurrency(forecast.historicalDailySalesAvg, currencySymbol)}/día</strong> (promedio real de tus ventas de los últimos 14 días).
                </span>
              ) : (
                <span>
                  100% conservador: solo cuenta el dinero en mano y las facturas por cobrar.
                </span>
              )}
            </div>
          </div>

          {/* Interactive Chart Section */}
          <div className="bg-white border border-[#CBD5E1] rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#0284C7]" />
                  Curva de Liquidez Proyectada (Día 1 al {horizonDays})
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Evolución diaria del saldo disponible en cuenta y caja según fechas de cobro y pago a lo largo de {horizonDays} días.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-[#64748B]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#0284C7]" />
                  <span>Saldo Proyectado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#DC2626]" />
                  <span>Línea Cero ($0)</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                    interval={horizonDays === 90 ? 8 : horizonDays === 60 ? 5 : 3}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => {
                      if (Math.abs(val) >= 1000000) return `${currencySymbol}${(val / 1000000).toFixed(1)}M`;
                      if (Math.abs(val) >= 1000) return `${currencySymbol}${(val / 1000).toFixed(0)}k`;
                      return `${currencySymbol}${val}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0F172A] text-white p-3 rounded-lg shadow-lg border border-[#334155] text-xs space-y-1.5 min-w-[200px]">
                          <div className="flex justify-between items-center border-b border-[#334155] pb-1">
                            <span className="font-bold">{data.dayName} {data.name}</span>
                            <span className="text-[10px] text-[#94A3B8]">{data.rawDate}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#94A3B8]">Saldo Proyectado:</span>
                            <span className={`font-black text-sm ${data.balance < 0 ? 'text-[#FCA5A5]' : 'text-[#38BDF8]'}`}>
                              {formatCurrency(data.balance, currencySymbol)}
                            </span>
                          </div>
                          {data.inflows > 0 && (
                            <div className="flex justify-between items-center text-[#86EFAC]">
                              <span>+ Cobros del día:</span>
                              <span className="font-bold">+{formatCurrency(data.inflows, currencySymbol)}</span>
                            </div>
                          )}
                          {data.outflows > 0 && (
                            <div className="flex justify-between items-center text-[#FCA5A5]">
                              <span>- Pagos del día:</span>
                              <span className="font-bold">-{formatCurrency(data.outflows, currencySymbol)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-[#94A3B8] text-[11px] pt-1 border-t border-[#334155]">
                            <span>Flujo Neto:</span>
                            <span className={`font-semibold ${data.net >= 0 ? 'text-[#86EFAC]' : 'text-[#FCA5A5]'}`}>
                              {data.net >= 0 ? '+' : ''}{formatCurrency(data.net, currencySymbol)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="#DC2626" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Milestones Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#006C49]" />
              Hitos Semanales (Próximas {forecast.weeks.length} Semanas / {horizonDays} Días)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {forecast.weeks.map((week) => (
                <div
                  key={week.weekNumber}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                    week.status === 'deficit'
                      ? 'border-[#F87171] ring-1 ring-[#F87171]/20'
                      : week.status === 'tight'
                      ? 'border-[#FCD34D]'
                      : 'border-[#CBD5E1]'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-[#0F172A]">{week.label}</span>
                        <p className="text-[11px] text-[#64748B]">{week.dateRange}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        week.status === 'deficit'
                          ? 'bg-[#FEE2E2] text-[#991B1B]'
                          : week.status === 'tight'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#DCFCE7] text-[#166534]'
                      }`}>
                        {week.status === 'deficit' ? 'Déficit' : week.status === 'tight' ? 'Ajustado' : 'Holgado'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs py-2 border-y border-[#F1F5F9]">
                      <div className="flex justify-between text-[#64748B]">
                        <span>Cobros ({week.receivablesCount}):</span>
                        <span className="font-semibold text-[#006C49]">
                          +{formatCurrency(week.inflows, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#64748B]">
                        <span>Pagos ({week.payablesCount}):</span>
                        <span className="font-semibold text-[#DC2626]">
                          -{formatCurrency(week.outflows, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#64748B]">
                        <span>Flujo Neto:</span>
                        <span className={`font-bold ${week.netFlow >= 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                          {week.netFlow >= 0 ? '+' : ''}{formatCurrency(week.netFlow, currencySymbol)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2 flex justify-between items-center">
                    <span className="text-[11px] text-[#64748B] font-medium">Saldo Cierre:</span>
                    <span className={`text-sm font-black ${
                      week.endBalance < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                    }`}>
                      {formatCurrency(week.endBalance, currencySymbol)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Schedule Table (Día por Día) */}
          <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#F8FAFC]">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Cronograma Diario Detallado de Vencimientos
                </h3>
                <p className="text-xs text-[#64748B]">
                  Revisa cada cliente que te debe pagar y cada factura de proveedor que vence día por día.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyDaysWithActivity(!onlyDaysWithActivity)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    onlyDaysWithActivity
                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{onlyDaysWithActivity ? 'Mostrando solo días con movimientos' : 'Ver solo días con movimientos'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#F1F5F9] border-b border-[#CBD5E1] z-10">
                  <tr className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Día / Fecha</th>
                    <th className="py-2.5 px-3 text-right">Saldo Inicial</th>
                    <th className="py-2.5 px-4">Cobros Programados (+)</th>
                    <th className="py-2.5 px-4">Pagos Programados (-)</th>
                    <th className="py-2.5 px-3 text-right">Flujo Neto</th>
                    <th className="py-2.5 px-4 text-right">Saldo Cierre</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {displayedDays.map((day) => {
                    const isToday = day.dayIndex === 0;
                    return (
                      <tr 
                        key={day.date} 
                        className={`hover:bg-[#F8FAFC] transition-colors ${
                          day.isDeficit 
                            ? 'bg-[#FEF2F2]/50' 
                            : isToday 
                            ? 'bg-[#EFF6FF]/40 font-medium' 
                            : ''
                        }`}
                      >
                        {/* Día / Fecha */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                            <span>{day.dayName} {day.formattedDate}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.2 bg-[#0284C7] text-white text-[10px] font-extrabold rounded">
                                HOY
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#64748B]">{day.date}</span>
                        </td>

                        {/* Saldo Inicial */}
                        <td className="py-3 px-3 text-right font-medium text-[#475569] whitespace-nowrap">
                          {formatCurrency(day.openingBalance, currencySymbol)}
                        </td>

                        {/* Cobros Programados */}
                        <td className="py-3 px-4">
                          {day.scheduledReceivables.length > 0 ? (
                            <div className="space-y-1">
                              {day.scheduledReceivables.map(rec => (
                                <div key={rec.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#DCFCE7] text-[#166534] rounded text-[11px] font-semibold border border-[#86EFAC] mr-1.5 mb-1">
                                  <span>{rec.name}:</span>
                                  <span className="font-bold">+{formatCurrency(rec.amount, currencySymbol)}</span>
                                </div>
                              ))}
                              {includeSalesAvg && day.estimatedSalesAvg > 0 && (
                                <span className="text-[10px] text-[#64748B] block">
                                  + {formatCurrency(day.estimatedSalesAvg, currencySymbol)} (vta. prom)
                                </span>
                              )}
                            </div>
                          ) : includeSalesAvg && day.estimatedSalesAvg > 0 ? (
                            <span className="text-[11px] text-[#64748B]">
                              +{formatCurrency(day.estimatedSalesAvg, currencySymbol)} (promedio)
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Pagos Programados */}
                        <td className="py-3 px-4">
                          {day.scheduledPayables.length > 0 ? (
                            <div className="space-y-1">
                              {day.scheduledPayables.map(pay => (
                                <div key={pay.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FEE2E2] text-[#991B1B] rounded text-[11px] font-semibold border border-[#FCA5A5] mr-1.5 mb-1">
                                  <span>{pay.name}:</span>
                                  <span className="font-bold">-{formatCurrency(pay.amount, currencySymbol)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Flujo Neto */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {day.netFlow !== 0 ? (
                            <span className={`font-bold ${day.netFlow > 0 ? 'text-[#006C49]' : 'text-[#DC2626]'}`}>
                              {day.netFlow > 0 ? '+' : ''}{formatCurrency(day.netFlow, currencySymbol)}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">$0</span>
                          )}
                        </td>

                        {/* Saldo Cierre */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-extrabold text-sm ${
                            day.closingBalance < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                          }`}>
                            {formatCurrency(day.closingBalance, currencySymbol)}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {day.isDeficit ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
                              Déficit
                            </span>
                          ) : day.closingBalance < forecast.startingTotalLiquidity * 0.2 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                              Ajustado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                              Holgado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
