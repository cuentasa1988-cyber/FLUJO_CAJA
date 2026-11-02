import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Building2, 
  Calendar, 
  FileText, 
  Trash2, 
  Receipt, 
  ArrowDownLeft, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Check, 
  X 
} from 'lucide-react';
import { Receivable, ReceivableStatus, OutflowMethod } from '../../types';
import { formatCurrency, getLocalDateString } from '../../utils/financial';
import { RecordCollectionModal } from './RecordCollectionModal';
import { NewReceivableModal } from './NewReceivableModal';

interface ReceivablesTabProps {
  receivables: Receivable[];
  currencySymbol: string;
  onAddReceivable: (receivable: Receivable | Receivable[]) => void;
  onUpdateReceivable: (receivable: Receivable) => void;
  onDeleteReceivable: (id: string) => void;
  onRecordCollection: (
    receivable: Receivable,
    amount: number,
    destinationMethod: OutflowMethod,
    date: string,
    time: string,
    reference?: string
  ) => void;
}

export const ReceivablesTab: React.FC<ReceivablesTabProps> = ({
  receivables,
  currencySymbol,
  onAddReceivable,
  onUpdateReceivable,
  onDeleteReceivable,
  onRecordCollection,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedReceivableForCollection, setSelectedReceivableForCollection] = useState<Receivable | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [confirmReopenId, setConfirmReopenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayStr = getLocalDateString();

  // Helper to check days remaining or overdue
  const getDaysInfo = (dueDate: string, status: ReceivableStatus) => {
    if (status === 'collected') {
      return { text: 'Cobrado', isOverdue: false, days: 0 };
    }
    const today = new Date(todayStr + 'T12:00:00');
    const due = new Date(dueDate + 'T12:00:00');
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Vencido hace ${Math.abs(diffDays)}d`, isOverdue: true, days: diffDays };
    } else if (diffDays === 0) {
      return { text: 'Vence hoy', isOverdue: false, days: 0 };
    } else if (diffDays === 1) {
      return { text: 'Vence mañana', isOverdue: false, days: 1 };
    } else {
      return { text: `En ${diffDays} días`, isOverdue: false, days: diffDays };
    }
  };

  // Metrics
  const totalPending = receivables
    .filter(r => r.status !== 'collected')
    .reduce((sum, r) => sum + r.remainingAmount, 0);

  const overdueItems = receivables.filter(r => {
    if (r.status === 'collected') return false;
    return r.dueDate < todayStr;
  });
  const totalOverdue = overdueItems.reduce((sum, r) => sum + r.remainingAmount, 0);

  const dueNext7DaysItems = receivables.filter(r => {
    if (r.status === 'collected') return false;
    const diff = getDaysInfo(r.dueDate, r.status).days;
    return diff >= 0 && diff <= 7;
  });
  const totalDueNext7Days = dueNext7DaysItems.reduce((sum, r) => sum + r.remainingAmount, 0);

  const totalCollected = receivables.reduce((sum, r) => {
    const paid = r.totalAmount - r.remainingAmount;
    return sum + (paid > 0 ? paid : 0);
  }, 0);

  // Filtered List
  const filteredReceivables = receivables.filter(r => {
    const matchesSearch = 
      r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.docNumber && r.docNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return r.status === 'pending' || r.status === 'partial';
    if (statusFilter === 'overdue') return r.status !== 'collected' && r.dueDate < todayStr;
    if (statusFilter === 'collected') return r.status === 'collected';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total por Cobrar */}
        <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Total por Cobrar
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
            {formatCurrency(totalPending, currencySymbol)}
          </p>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            {receivables.filter(r => r.status !== 'collected').length} clientes con saldo pendiente
          </p>
        </div>

        {/* Vencido (Alerta) */}
        <div className={`p-4 rounded-xl border shadow-xs ${
          totalOverdue > 0 ? 'bg-[#FEF2F2] border-[#FCA5A5]' : 'bg-white border-[#CBD5E1]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              totalOverdue > 0 ? 'text-[#991B1B]' : 'text-[#64748B]'
            }`}>
              Cobranzas Vencidas
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              totalOverdue > 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#F1F5F9] text-[#64748B]'
            }`}>
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${
            totalOverdue > 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
          }`}>
            {formatCurrency(totalOverdue, currencySymbol)}
          </p>
          <p className={`text-xs mt-1 font-medium ${
            totalOverdue > 0 ? 'text-[#991B1B]' : 'text-[#64748B]'
          }`}>
            {overdueItems.length} {overdueItems.length === 1 ? 'cuenta fuera de plazo' : 'cuentas fuera de plazo'}
          </p>
        </div>

        {/* Vence en 7 Días */}
        <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Vence en 7 Días
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
              <Clock className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-[#D97706] tracking-tight">
            {formatCurrency(totalDueNext7Days, currencySymbol)}
          </p>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            Entrada de dinero esperada esta semana
          </p>
        </div>

        {/* Total Cobrado / Recuperado */}
        <div className="bg-white border border-[#CBD5E1] p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Cobrado / Recuperado
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-[#006C49] tracking-tight">
            {formatCurrency(totalCollected, currencySymbol)}
          </p>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            Dinero efectivamente ingresado
          </p>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search & Filters */}
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Buscar por cliente, concepto o N° folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              Todos ({receivables.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-[#0284C7] text-white border-[#0284C7]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              Pendientes ({receivables.filter(r => r.status !== 'collected').length})
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                statusFilter === 'overdue'
                  ? 'bg-[#DC2626] text-white border-[#DC2626]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              Vencidos ({overdueItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('collected')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                statusFilter === 'collected'
                  ? 'bg-[#006C49] text-white border-[#006C49]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              Cobrados ({receivables.filter(r => r.status === 'collected').length})
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#0284C7] hover:bg-[#0369A1] active:scale-[0.98] text-white px-4 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          <span>Nueva Cuenta por Cobrar</span>
        </button>
      </div>

      {/* Receivables Table */}
      <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#CBD5E1] text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                <th className="py-3 px-4">Cliente / Concepto</th>
                <th className="py-3 px-3">Documento</th>
                <th className="py-3 px-3">Vencimiento</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-right">Cobrado</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#64748B]">
                    <Receipt className="w-8 h-8 mx-auto text-[#94A3B8] mb-2" />
                    <p className="font-semibold text-sm text-[#334155]">No se encontraron cuentas por cobrar</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {searchTerm ? 'Intenta buscar con otros términos' : 'Registra clientes con pagos pendientes para proyectar tus cobros.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((rec) => {
                  const daysInfo = getDaysInfo(rec.dueDate, rec.status);
                  const isCollected = rec.status === 'collected';
                  const isExpanded = expandedHistoryId === rec.id;
                  const hasHistory = rec.paymentHistory && rec.paymentHistory.length > 0;

                  return (
                    <React.Fragment key={rec.id}>
                      <tr className={`hover:bg-[#F8FAFC] transition-colors ${
                        daysInfo.isOverdue && !isCollected ? 'bg-[#FEF2F2]/40' : ''
                      }`}>
                        {/* Cliente / Concepto */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0F172A] text-sm flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                            <span>{rec.clientName}</span>
                          </div>
                          <p className="text-[#64748B] text-xs mt-0.5">{rec.concept}</p>
                          {rec.notes && (
                            <p className="text-[11px] text-[#0284C7] italic mt-0.5">
                              💬 {rec.notes}
                            </p>
                          )}
                        </td>

                        {/* Documento */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {rec.docType === 'factura' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] rounded text-[11px] font-semibold border border-[#BFDBFE]">
                              <FileText className="w-3 h-3" />
                              Factura {rec.docNumber || ''}
                            </span>
                          )}
                          {rec.docType === 'boleta' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F0FDF4] text-[#15803D] rounded text-[11px] font-semibold border border-[#BBF7D0]">
                              <Receipt className="w-3 h-3" />
                              Boleta {rec.docNumber || ''}
                            </span>
                          )}
                          {rec.docType === 'sin_doc' && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-[#F1F5F9] text-[#475569] rounded text-[11px] font-medium border border-[#CBD5E1]">
                              Sin Doc / Fiado
                            </span>
                          )}
                        </td>

                        {/* Vencimiento */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-[#0F172A] font-medium">
                            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                            <span>{rec.dueDate}</span>
                          </div>
                          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                            isCollected 
                              ? 'bg-[#DCFCE7] text-[#166534]'
                              : daysInfo.isOverdue
                              ? 'bg-[#FEE2E2] text-[#991B1B]'
                              : daysInfo.days <= 3
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : 'bg-[#F1F5F9] text-[#475569]'
                          }`}>
                            {daysInfo.text}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-3 text-right font-medium text-[#475569] whitespace-nowrap">
                          {formatCurrency(rec.totalAmount, currencySymbol)}
                        </td>

                        {/* Cobrado */}
                        <td className="py-3.5 px-3 text-right font-semibold text-[#006C49] whitespace-nowrap">
                          {formatCurrency(rec.totalAmount - rec.remainingAmount, currencySymbol)}
                        </td>

                        {/* Saldo Pendiente */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`text-sm font-extrabold ${
                            isCollected ? 'text-[#64748B]' : 'text-[#0284C7]'
                          }`}>
                            {formatCurrency(rec.remainingAmount, currencySymbol)}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                              <CheckCircle2 className="w-3 h-3" />
                              Cobrado
                            </span>
                          ) : rec.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                              Abono Parcial
                            </span>
                          ) : daysInfo.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]">
                              <AlertTriangle className="w-3 h-3" />
                              Vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                              Pendiente
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reabrir / Cancelar Cobro con Confirmación Inline */}
                            {isCollected && (
                              confirmReopenId === rec.id ? (
                                <div className="inline-flex items-center gap-1 bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-md text-xs">
                                  <span className="text-[#92400E] font-medium text-[11px]">¿Reabrir?</span>
                                  <button
                                    onClick={() => {
                                      onUpdateReceivable({
                                        ...rec,
                                        status: 'pending',
                                        remainingAmount: rec.totalAmount,
                                        paymentHistory: [],
                                      });
                                      setConfirmReopenId(null);
                                    }}
                                    className="p-1 bg-[#006C49] hover:bg-[#005538] text-white rounded text-[10px] font-bold flex items-center transition-colors cursor-pointer"
                                    title="Confirmar reapertura"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmReopenId(null)}
                                    className="p-1 bg-white hover:bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] rounded text-[10px] transition-colors cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmReopenId(rec.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-xs font-semibold rounded-md flex items-center gap-1 transition-colors cursor-pointer border border-[#CBD5E1]"
                                  title="Reactivar / Anular cobro"
                                >
                                  <RotateCcw className="w-3 h-3 text-[#0284C7]" />
                                  <span>Reabrir</span>
                                </button>
                              )
                            )}

                            {!isCollected && (
                              <button
                                onClick={() => setSelectedReceivableForCollection(rec)}
                                className="px-2.5 py-1.5 bg-[#006C49] hover:bg-[#005538] text-white text-xs font-bold rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title="Registrar cobro de dinero"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5 text-[#86EFAC]" />
                                <span>Cobrar</span>
                              </button>
                            )}

                            {hasHistory && (
                              <button
                                onClick={() => setExpandedHistoryId(isExpanded ? null : rec.id)}
                                className="p-1.5 text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-md transition-colors cursor-pointer"
                                title="Ver historial de abonos"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}

                            {/* Eliminar Cuenta con Confirmación Inline */}
                            {confirmDeleteId === rec.id ? (
                              <div className="inline-flex items-center gap-1 bg-[#FEE2E2] border border-[#FCA5A5] px-2 py-0.5 rounded-md text-xs">
                                <span className="text-[#991B1B] font-medium text-[11px]">¿Eliminar?</span>
                                <button
                                  onClick={() => {
                                    onDeleteReceivable(rec.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="p-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded text-[10px] font-bold flex items-center transition-colors cursor-pointer"
                                  title="Confirmar eliminación"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="p-1 bg-white hover:bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] rounded text-[10px] transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setConfirmDeleteId(rec.id);
                                  setConfirmReopenId(null);
                                }}
                                className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-md transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Payment History Sub-row */}
                      {isExpanded && hasHistory && (
                        <tr className="bg-[#F8FAFC] border-b border-[#CBD5E1]">
                          <td colSpan={8} className="py-2.5 px-6">
                            <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 space-y-1.5 shadow-2xs">
                              <div className="flex justify-between items-center pb-1 border-b border-[#F1F5F9]">
                                <p className="text-xs font-bold text-[#334155] flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#006C49]" />
                                  Historial de Abonos / Cobros Realizados:
                                </p>
                                <span className="text-[11px] text-[#64748B]">
                                  Puedes eliminar un abono específico con el icono de papelera
                                </span>
                              </div>
                              <div className="space-y-1 pt-0.5">
                                {rec.paymentHistory?.map((entry, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs text-[#475569] py-1.5 px-2 rounded hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-none transition-colors">
                                    <span className="font-medium flex items-center gap-1.5">
                                      <span>📅 {entry.date}</span>
                                      <span>—</span>
                                      <span className="text-[#334155]">
                                        Ingreso a {entry.destinationMethod === 'bank_transfer' ? 'Cuenta Corriente' : 'Caja Gaveta'}
                                      </span>
                                      {entry.reference && (
                                        <span className="text-[#0284C7] text-[11px] font-semibold">({entry.reference})</span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-[#006C49] font-mono-num">
                                        +{formatCurrency(entry.amount, currencySymbol)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedHistory = (rec.paymentHistory || []).filter((_, i) => i !== idx);
                                          const newRemaining = Math.min(rec.totalAmount, rec.remainingAmount + entry.amount);
                                          const newStatus: ReceivableStatus = newRemaining >= rec.totalAmount
                                            ? 'pending'
                                            : newRemaining <= 0
                                              ? 'collected'
                                              : 'partial';
                                          onUpdateReceivable({
                                            ...rec,
                                            remainingAmount: newRemaining,
                                            status: newStatus,
                                            paymentHistory: updatedHistory,
                                          });
                                        }}
                                        className="p-1 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors cursor-pointer"
                                        title={`Anular/Eliminar solo el abono de ${formatCurrency(entry.amount, currencySymbol)}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <NewReceivableModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currencySymbol={currencySymbol}
        onAddReceivable={onAddReceivable}
      />

      <RecordCollectionModal
        isOpen={!!selectedReceivableForCollection}
        onClose={() => setSelectedReceivableForCollection(null)}
        receivable={selectedReceivableForCollection}
        currencySymbol={currencySymbol}
        onConfirmCollection={onRecordCollection}
      />
    </div>
  );
};
