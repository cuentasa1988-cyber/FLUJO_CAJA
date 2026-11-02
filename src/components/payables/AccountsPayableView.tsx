import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Droplet, 
  MoreVertical, 
  Check, 
  Trash2, 
  CreditCard, 
  Calendar,
  AlertCircle,
  Filter,
  Building2,
  Coins
} from 'lucide-react';
import { 
  AppSettings, 
  Payable, 
  PayableStatus, 
  Transaction, 
  DatePeriodFilter,
  OutflowMethod 
} from '../../types';
import { 
  calculateCurrentLiquidity, 
  calculatePayablesMetrics, 
  formatCurrency,
  getLocalDateString,
  getLocalTimeString
} from '../../utils/financial';
import { 
  getDefaultPeriodFilter, 
  isDateInPeriod, 
  getPeriodLabel 
} from '../../utils/dateFilter';
import { PeriodFilterBar } from '../common/PeriodFilterBar';
import { NewTransactionModal } from '../modals/NewTransactionModal';

interface AccountsPayableViewProps {
  settings: AppSettings;
  payables: Payable[];
  transactions: Transaction[];
  onAddPayable: (p: Payable) => void;
  onUpdatePayable: (p: Payable) => void;
  onDeletePayable: (id: string) => void;
  onRecordPayablePayment: (
    payable: Payable, 
    paymentAmount: number, 
    paymentDate?: string, 
    paymentTime?: string,
    paymentMethod?: OutflowMethod
  ) => void;
  onAddTransaction?: (tx: Transaction) => void;
  periodFilter?: DatePeriodFilter;
  onChangePeriodFilter?: (filter: DatePeriodFilter) => void;
}

export const AccountsPayableView: React.FC<AccountsPayableViewProps> = ({
  settings,
  payables,
  transactions,
  onAddPayable,
  onUpdatePayable,
  onDeletePayable,
  onRecordPayablePayment,
  onAddTransaction = () => {},
  periodFilter: propPeriodFilter,
  onChangePeriodFilter: propOnChangePeriodFilter,
}) => {
  const [localPeriodFilter, setLocalPeriodFilter] = useState<DatePeriodFilter>(() => getDefaultPeriodFilter());
  const periodFilter = propPeriodFilter || localPeriodFilter;
  const setPeriodFilter = propOnChangePeriodFilter || setLocalPeriodFilter;
  const [filterByPeriod, setFilterByPeriod] = useState<boolean>(false); // false by default so all payables are visible, but period filter available
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [payAmountStr, setPayAmountStr] = useState<string>('');
  const [payMethod, setPayMethod] = useState<OutflowMethod>('bank_transfer');
  const [payDate, setPayDate] = useState<string>(() => getLocalDateString());
  const [payTime, setPayTime] = useState<string>(() => getLocalTimeString());

  const { bank, totalLiquidity } = calculateCurrentLiquidity(settings, transactions, payables);
  const metrics = calculatePayablesMetrics(payables, totalLiquidity);

  // Filtered Payables
  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (filterByPeriod && !isDateInPeriod(p.dueDate, periodFilter)) return false;
      return true;
    });
  }, [payables, statusFilter, filterByPeriod, periodFilter]);

  // Period-specific metrics for payables
  const periodPayables = useMemo(() => {
    return payables.filter(p => isDateInPeriod(p.dueDate, periodFilter));
  }, [payables, periodFilter]);

  const periodTotalDue = periodPayables.reduce((acc, p) => acc + p.totalAmount, 0);
  const periodRemainingDue = periodPayables.filter(p => p.status !== 'paid').reduce((acc, p) => acc + p.remainingAmount, 0);
  const periodPaidAmount = periodTotalDue - periodRemainingDue;

  // Handle Pay Installment Action
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPayable) return;
    const amount = parseFloat(payAmountStr) || 0;
    if (amount <= 0) return;
    if (amount > payingPayable.remainingAmount) return;

    onRecordPayablePayment(
      payingPayable, 
      amount, 
      payDate || getLocalDateString(), 
      payTime || getLocalTimeString(),
      payMethod
    );
    setPayingPayable(null);
    setPayAmountStr('');
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = [
      ['Proveedor / Concepto', 'Detalle', 'Monto Total', 'Saldo Pendiente', 'Cuotas', 'Vencimiento', 'Estado', 'Factura/IVA'],
      ...filteredPayables.map(p => [
        `"${p.vendor}"`,
        `"${p.concept}"`,
        p.totalAmount.toFixed(2),
        p.remainingAmount.toFixed(2),
        `"${p.currentInstallment}/${p.installmentCount}"`,
        p.dueDate,
        p.status.toUpperCase(),
        p.hasFactura ? 'FACTURA (IVA)' : 'NO',
      ]),
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cuentas_Por_Pagar_${new Date().toISOString().split('T')[0]}.csv`);
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
            Cuentas por Pagar
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Gestiona pasivos a corto plazo, cuotas y compromisos futuros de caja
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] px-3.5 py-2.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006C49]" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.98] text-white px-4 py-2.5 rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Nuevo Pasivo / Cuota</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI Cards including Available Liquidity Projection */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Total Outstanding */}
        <div className="md:col-span-3 bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
            TOTAL PENDIENTE HISTÓRICO
          </div>
          <div className="text-2xl font-bold text-[#0F172A] font-mono-num mb-1">
            {formatCurrency(metrics.totalOutstanding, settings.currencySymbol)}
          </div>
          <p className="text-xs text-[#64748B]">Saldo vivo de todos los pasivos registrados</p>
        </div>

        {/* Due in Active Period */}
        <div className="md:col-span-3 bg-white border border-[#CBD5E1] rounded-lg p-4 shadow-xs">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>VENCE EN ESTE PERÍODO</span>
            <span className="text-[10px] font-bold bg-[#EFF6FF] text-[#1E40AF] px-1.5 py-0.5 rounded">
              {periodPayables.length} cuotas
            </span>
          </div>
          <div className="text-2xl font-bold text-[#0F172A] font-mono-num mb-1">
            {formatCurrency(periodRemainingDue, settings.currencySymbol)}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#006C49] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pagado en período: {formatCurrency(periodPaidAmount, settings.currencySymbol)}</span>
          </div>
        </div>

        {/* Available Liquidity Projection */}
        <div className="md:col-span-6 bg-[#0F172A] rounded-lg p-4 text-white shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#94A3B8] uppercase">
              <Droplet className="w-3.5 h-3.5 text-[#6CF8BB]" />
              <span>PROYECCIÓN DE LIQUIDEZ DISPONIBLE</span>
            </div>
            <span className="text-[10px] text-[#6CF8BB] font-mono-num font-bold">Caja + Banco</span>
          </div>

          <div className="my-2 flex justify-between items-baseline">
            <span className="text-xs text-[#94A3B8]">Caja y Banco Actual</span>
            <span className="text-2xl font-bold text-white font-mono-num">
              {formatCurrency(totalLiquidity, settings.currencySymbol, 0)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1E293B] rounded-full h-2 mb-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                metrics.post30DLiquidity >= 0 ? 'bg-[#6CF8BB]' : 'bg-[#EF4444]'
              }`}
              style={{ 
                width: `${totalLiquidity <= 0 ? (metrics.dueIn30Days > 0 ? 0 : 100) : Math.max(0, Math.min(100, (metrics.post30DLiquidity / totalLiquidity) * 100))}%` 
              }}
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-[#94A3B8]">Liquidez estimada tras compromisos del mes:</span>
            <span className={`font-bold font-mono-num ${
              metrics.post30DLiquidity < 0 ? 'text-[#FCA5A5]' : 'text-[#6CF8BB]'
            }`}>
              {metrics.post30DLiquidity < 0 ? `Déficit: -${formatCurrency(Math.abs(metrics.post30DLiquidity), settings.currencySymbol, 0)}` : formatCurrency(metrics.post30DLiquidity, settings.currencySymbol, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Liability Schedule Table + Commitment Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Liability Schedule Table */}
        <div className="lg:col-span-8 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                Cronograma de Pasivos y Facturas por Pagar
              </h3>
              <p className="text-xs text-[#64748B]">
                {filterByPeriod 
                  ? `Mostrando vencimientos del período (${getPeriodLabel(periodFilter)})`
                  : 'Mostrando todos los pasivos registrados en el sistema'}
              </p>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterByPeriod(!filterByPeriod)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterByPeriod
                    ? 'bg-[#006C49] text-white border-[#006C49] shadow-xs'
                    : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:bg-white'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{filterByPeriod ? 'Filtrado por Período' : 'Ver Todos'}</span>
              </button>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold bg-[#F8FAFC] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-[#0F172A] focus:outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="overdue">Vencidos</option>
                <option value="paid">Pagados</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#CBD5E1] bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 px-3 font-semibold">Proveedor / Concepto</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Monto Total</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Saldo Pendiente</th>
                  <th className="py-2.5 px-3 font-semibold">Vencimiento</th>
                  <th className="py-2.5 px-3 font-semibold">Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-xs">
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                      No hay cuentas por pagar ni pasivos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((p) => {
                    const isOverdue = p.status === 'overdue';
                    const isPaid = p.status === 'paid';

                    return (
                      <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#0F172A]">{p.vendor}</div>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                            <span>{p.concept}</span>
                            {p.installmentCount > 1 && (
                              <span className="bg-[#F1F5F9] px-1.5 py-0.2 rounded text-[10px] text-[#475569] font-semibold border border-[#E2E8F0]">
                                Cuota {p.currentInstallment}/{p.installmentCount}
                              </span>
                            )}
                            {p.hasFactura && (
                              <span className="bg-[#FEF3C7] text-[#92400E] px-1.5 py-0.2 rounded text-[10px] font-bold">
                                Factura (IVA)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono-num text-right text-[#0F172A] font-semibold">
                          {formatCurrency(p.totalAmount, settings.currencySymbol)}
                        </td>
                        <td className="py-3 px-3 font-mono-num font-bold text-right text-[#0F172A]">
                          {formatCurrency(p.remainingAmount, settings.currencySymbol)}
                        </td>
                        <td className={`py-3 px-3 font-mono-num ${isOverdue ? 'text-[#EF4444] font-bold' : 'text-[#64748B]'}`}>
                          {p.dueDate}
                        </td>
                        <td className="py-3 px-3">
                          {isPaid ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#006C49] uppercase tracking-wider">
                              PAGADO
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] uppercase tracking-wider">
                              VENCIDO
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#1E40AF] uppercase tracking-wider">
                              PENDIENTE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!isPaid && (
                              <button
                                onClick={() => {
                                  setPayingPayable(p);
                                  // Default strictly to the exact pending balance of this payable item
                                  const pendingVal = settings.currency === 'CLP' 
                                    ? String(Math.round(p.remainingAmount)) 
                                    : p.remainingAmount % 1 === 0 
                                      ? String(p.remainingAmount) 
                                      : p.remainingAmount.toFixed(2);
                                  setPayAmountStr(pendingVal);
                                  setPayMethod('bank_transfer');
                                  setPayDate(getLocalDateString());
                                  setPayTime(getLocalTimeString());
                                }}
                                className="p-1.5 text-[#006C49] hover:bg-[#DCFCE7] rounded transition-colors cursor-pointer"
                                title="Pagar compromiso / Saldo pendiente"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => onDeletePayable(p.id)}
                              className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                              title="Eliminar pasivo"
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
            </table>
          </div>
        </div>

        {/* Right: 6-Month Commitment Timeline */}
        <div className="lg:col-span-4 bg-white border border-[#CBD5E1] rounded-lg p-5 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-[#0F172A] tracking-tight mb-5">
            Compromisos Próximos
          </h3>

          <div className="space-y-6 relative pl-4 border-l-2 border-[#CBD5E1] ml-2">
            {/* Item 1 */}
            <div className="relative group">
              <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#0F172A] ring-4 ring-white" />
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-xs font-bold text-[#0F172A] border-b border-[#0F172A] pb-0.5">
                  Mes Actual
                </span>
                <span className="text-xs font-bold font-mono-num text-[#0F172A]">
                  {formatCurrency(metrics.dueIn30Days, settings.currencySymbol, 0)}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Arriendo, insumos y cuotas activas
              </p>
            </div>

            {/* Item 2 */}
            <div className="relative group">
              <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#CBD5E1] ring-4 ring-white" />
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Próximo Mes (+30D)
                </span>
                <span className="text-xs font-bold font-mono-num text-[#0F172A]">
                  {formatCurrency(metrics.due30To60Days, settings.currencySymbol, 0)}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Licencias de software, cuotas programadas
              </p>
            </div>

            {/* Item 3 */}
            <div className="relative group">
              <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#CBD5E1] ring-4 ring-white" />
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-xs font-semibold text-[#0F172A]">
                  En 60-90 Días
                </span>
                <span className="text-xs font-bold font-mono-num text-[#0F172A]">
                  {formatCurrency(metrics.duePost60Days, settings.currencySymbol, 0)}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Renovaciones y compromisos a mediano plazo
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Pay Installment Modal */}
      {payingPayable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-[#CBD5E1]">
            <h3 className="text-base font-bold text-[#0F172A] mb-1">
              Pagar Compromiso / Cuota
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              {payingPayable.vendor} — {payingPayable.concept}
            </p>

            <form onSubmit={handleExecutePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Monto a Pagar (descuenta de liquidez y crea registro de egreso)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-0 top-0 bottom-0 px-3 bg-[#F1F5F9] border-r border-[#CBD5E1] flex items-center text-xs text-[#64748B] font-bold rounded-l-md">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step={settings.currency === 'CLP' ? "1" : "0.01"}
                    min="1"
                    max={payingPayable.remainingAmount}
                    value={payAmountStr}
                    onChange={(e) => setPayAmountStr(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2 text-sm font-bold text-right bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#006C49]"
                  />
                </div>
                
                {/* Pending balance and quick helper buttons */}
                <div className="flex flex-wrap items-center justify-between mt-1.5 gap-2">
                  <p className="text-[11px] text-[#64748B]">
                    Saldo pendiente actual: <strong className="text-[#0F172A] font-mono-num">{formatCurrency(payingPayable.remainingAmount, settings.currencySymbol)}</strong>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPayAmountStr("0")}
                      className="px-2 py-0.5 text-[11px] font-semibold text-[#64748B] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded cursor-pointer transition-colors"
                      title="Poner en $0 para ingresar otro monto"
                    >
                      Poner $0
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const fullAmt = settings.currency === 'CLP' 
                          ? String(Math.round(payingPayable.remainingAmount)) 
                          : String(payingPayable.remainingAmount);
                        setPayAmountStr(fullAmt);
                      }}
                      className="px-2 py-0.5 text-[11px] font-semibold text-[#006C49] bg-[#DCFCE7] hover:bg-[#BBF7D0] rounded cursor-pointer transition-colors"
                      title="Pagar la totalidad pendiente"
                    >
                      Pagar Total ({formatCurrency(payingPayable.remainingAmount, settings.currencySymbol)})
                    </button>
                  </div>
                </div>

                {parseFloat(payAmountStr) > payingPayable.remainingAmount && (
                  <p className="text-[11px] text-[#DC2626] font-semibold mt-1">
                    El monto no puede superar el saldo pendiente ({formatCurrency(payingPayable.remainingAmount, settings.currencySymbol)})
                  </p>
                )}
              </div>

              {/* Payment Method / Outflow source */}
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Medio de Pago / Origen de Fondos
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('bank_transfer')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      payMethod === 'bank_transfer'
                        ? 'border-[#006C49] bg-[#F0FDF4] text-[#006C49] font-bold shadow-xs'
                        : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Banco / Transferencia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`py-2 px-3 text-xs font-semibold rounded-md border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      payMethod === 'cash'
                        ? 'border-[#006C49] bg-[#F0FDF4] text-[#006C49] font-bold shadow-xs'
                        : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Caja / Efectivo</span>
                  </button>
                </div>
              </div>

              {/* Date & Time fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Fecha de Pago
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#006C49]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={payTime}
                    onChange={(e) => setPayTime(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#006C49]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingPayable(null)}
                  className="flex-1 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={parseFloat(payAmountStr) <= 0 || parseFloat(payAmountStr) > payingPayable.remainingAmount}
                  className="flex-1 py-2 bg-[#006C49] hover:bg-[#005236] disabled:bg-[#94A3B8] disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Add Transaction / Payable Modal */}
      <NewTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        settings={settings}
        onAddTransaction={onAddTransaction}
        onAddPayable={onAddPayable}
        initialType="payable"
      />
    </div>
  );
};
