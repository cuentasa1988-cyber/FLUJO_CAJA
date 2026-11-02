import React, { useState, useMemo } from 'react';
import { X, Plus, Calendar, FileText, User, DollarSign, AlertCircle, Layers, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Receivable, PaymentChannel } from '../../types';
import { getLocalDateString, formatCurrency } from '../../utils/financial';

interface NewReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  onAddReceivable: (receivable: Receivable | Receivable[]) => void;
}

export const NewReceivableModal: React.FC<NewReceivableModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  onAddReceivable,
}) => {
  if (!isOpen) return null;

  const todayStr = getLocalDateString();
  
  // Default due date to +15 days from today
  const defaultDueDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return getLocalDateString(d);
  })();

  const [clientName, setClientName] = useState<string>('');
  const [concept, setConcept] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [docType, setDocType] = useState<'factura' | 'boleta' | 'sin_doc'>('factura');
  const [docNumber, setDocNumber] = useState<string>('');
  const [paymentMethodExpected, setPaymentMethodExpected] = useState<PaymentChannel>('bank_transfer');
  const [hasFactura, setHasFactura] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Installments state
  const [enableInstallments, setEnableInstallments] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [installmentFrequency, setInstallmentFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [hasInitialPayment, setHasInitialPayment] = useState<boolean>(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number | ''>('');

  const handleDocTypeChange = (type: 'factura' | 'boleta' | 'sin_doc') => {
    setDocType(type);
    setHasFactura(type === 'factura');
  };

  const handleQuickDays = (days: number) => {
    const base = issueDate ? new Date(issueDate + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + days);
    setDueDate(getLocalDateString(base));
  };

  // Calculate installments preview
  const calculatedInstallments = useMemo(() => {
    const total = Number(totalAmount) || 0;
    if (total <= 0 || !enableInstallments || installmentCount <= 1) return [];

    const initial = hasInitialPayment ? (Number(initialPaymentAmount) || 0) : 0;
    const remainingToSplit = Math.max(0, total - initial);
    const countToGenerate = hasInitialPayment ? Math.max(1, installmentCount - 1) : installmentCount;
    const baseAmountPerInstallment = countToGenerate > 0 ? Math.floor(remainingToSplit / countToGenerate) : 0;
    const remainder = remainingToSplit - (baseAmountPerInstallment * countToGenerate);

    const list: {
      number: number;
      totalCount: number;
      amount: number;
      dueDate: string;
      isInitialPaid: boolean;
      label: string;
    }[] = [];

    const baseDate = issueDate ? new Date(issueDate + 'T12:00:00') : new Date();

    // If there's an initial payment made today
    if (hasInitialPayment && initial > 0) {
      list.push({
        number: 1,
        totalCount: installmentCount,
        amount: initial,
        dueDate: issueDate || todayStr,
        isInitialPaid: true,
        label: `Cuota 1/${installmentCount} (Abono inicial hoy)`,
      });
    }

    // Remaining installments
    for (let i = 0; i < countToGenerate; i++) {
      const instNum = (hasInitialPayment && initial > 0) ? (i + 2) : (i + 1);
      const instDueDate = new Date(baseDate);

      if (installmentFrequency === 'monthly') {
        const step = hasInitialPayment ? (i + 1) : i;
        instDueDate.setMonth(instDueDate.getMonth() + step);
      } else if (installmentFrequency === 'biweekly') {
        const step = hasInitialPayment ? (i + 1) : i;
        instDueDate.setDate(instDueDate.getDate() + (step * 15));
      } else {
        const step = hasInitialPayment ? (i + 1) : i;
        instDueDate.setDate(instDueDate.getDate() + (step * 7));
      }

      // Add remainder pennies to the first pending installment
      const instAmount = (i === 0) ? (baseAmountPerInstallment + remainder) : baseAmountPerInstallment;

      list.push({
        number: instNum,
        totalCount: installmentCount,
        amount: instAmount,
        dueDate: getLocalDateString(instDueDate),
        isInitialPaid: false,
        label: `Cuota ${instNum}/${installmentCount}`,
      });
    }

    return list;
  }, [totalAmount, enableInstallments, installmentCount, installmentFrequency, hasInitialPayment, initialPaymentAmount, issueDate, todayStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Debes ingresar el nombre del cliente');
      return;
    }
    if (!concept.trim()) {
      setError('Debes ingresar un concepto o descripción');
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      setError('El monto total debe ser mayor a 0');
      return;
    }

    if (enableInstallments && installmentCount > 1) {
      const now = Date.now();
      const newRecs: Receivable[] = calculatedInstallments.map((inst, index) => {
        const isPaid = inst.isInitialPaid;
        return {
          id: `rec-${now}-${index}`,
          clientName: clientName.trim(),
          concept: `[Cuota ${inst.number}/${inst.totalCount}] ${concept.trim()}`,
          totalAmount: inst.amount,
          remainingAmount: isPaid ? 0 : inst.amount,
          installmentCount: inst.totalCount,
          currentInstallment: inst.number,
          dueDate: inst.dueDate,
          issueDate: issueDate || todayStr,
          status: isPaid ? 'collected' : 'pending',
          docType,
          docNumber: docNumber.trim() ? `${docNumber.trim()} (C${inst.number})` : undefined,
          paymentMethodExpected,
          hasFactura: docType === 'factura' ? true : hasFactura,
          notes: notes.trim() || undefined,
          paymentHistory: isPaid ? [{
            id: `pay-init-${now}`,
            date: issueDate || todayStr,
            amount: inst.amount,
            destinationMethod: 'bank_transfer',
            reference: 'Abono inicial al emitir venta',
          }] : undefined,
        };
      });

      onAddReceivable(newRecs);
      onClose();
      return;
    }

    if (!dueDate) {
      setError('Debes seleccionar una fecha de vencimiento');
      return;
    }

    const newRec: Receivable = {
      id: `rec-${Date.now()}`,
      clientName: clientName.trim(),
      concept: concept.trim(),
      totalAmount: Number(totalAmount),
      remainingAmount: Number(totalAmount),
      dueDate,
      issueDate: issueDate || todayStr,
      status: 'pending',
      docType,
      docNumber: docNumber.trim() || undefined,
      paymentMethodExpected,
      hasFactura: docType === 'factura' ? true : hasFactura,
      notes: notes.trim() || undefined,
    };

    onAddReceivable(newRec);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A]/50 z-50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-white border border-[#CBD5E1] rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#0284C7] uppercase">
              Cuentas por Cobrar
            </span>
            <h3 className="text-base font-bold text-[#0F172A]">
              Nueva Venta a Crédito / Cobro Pendiente
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Nombre del Cliente o Empresa *
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Ej. Comercial Los Alerces SpA"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setError('');
                }}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Concept */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Concepto / Detalle de la Venta *
            </label>
            <input
              type="text"
              placeholder="Ej. Factura 1089 - Lote insumos y despacho"
              value={concept}
              onChange={(e) => {
                setConcept(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
              required
            />
          </div>

          {/* Total Amount & Doc Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Monto Total por Cobrar ({currencySymbol}) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0"
                  value={totalAmount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setTotalAmount(val);
                    if (enableInstallments && hasInitialPayment && val !== '') {
                      setInitialPaymentAmount(Math.round(Number(val) / (installmentCount || 3)));
                    }
                    setError('');
                  }}
                  className="w-full pl-8 pr-3 py-2 text-sm font-bold text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Tipo de Documento
              </label>
              <select
                value={docType}
                onChange={(e) => handleDocTypeChange(e.target.value as any)}
                className="w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none bg-white"
              >
                <option value="factura">Factura de Venta (Afecta a IVA)</option>
                <option value="boleta">Boleta de Venta</option>
                <option value="sin_doc">Sin Documento / Fiado Informal</option>
              </select>
            </div>
          </div>

          {/* Doc Number & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                N° de Folio / Factura / Boleta
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Ej. F-1089"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Método de Cobro Esperado
              </label>
              <select
                value={paymentMethodExpected}
                onChange={(e) => setPaymentMethodExpected(e.target.value as PaymentChannel)}
                className="w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none bg-white"
              >
                <option value="bank_transfer">Transferencia Bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="debit_card">Tarjeta Débito</option>
                <option value="credit_card">Tarjeta Crédito</option>
              </select>
            </div>
          </div>

          {/* Installments Option Selector */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0284C7]" />
                <span className="text-xs font-bold text-[#0F172A]">Modalidad de Cobro</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="radio"
                    name="installmentMode"
                    checked={!enableInstallments}
                    onChange={() => setEnableInstallments(false)}
                    className="text-[#0284C7] focus:ring-[#0284C7]"
                  />
                  <span>1 solo pago</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[#0284C7] font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="installmentMode"
                    checked={enableInstallments}
                    onChange={() => setEnableInstallments(true)}
                    className="text-[#0284C7] focus:ring-[#0284C7]"
                  />
                  <span>En Cuotas</span>
                </label>
              </div>
            </div>

            {enableInstallments && (
              <div className="pt-2 border-t border-[#E2E8F0] space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">
                      Cantidad de Cuotas
                    </label>
                    <select
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10))}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] border border-[#CBD5E1] rounded-md bg-white focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    >
                      <option value={2}>2 Cuotas</option>
                      <option value={3}>3 Cuotas (30, 60 y 90 días)</option>
                      <option value={4}>4 Cuotas</option>
                      <option value={5}>5 Cuotas</option>
                      <option value={6}>6 Cuotas</option>
                      <option value={10}>10 Cuotas</option>
                      <option value={12}>12 Cuotas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] mb-1">
                      Frecuencia
                    </label>
                    <select
                      value={installmentFrequency}
                      onChange={(e) => setInstallmentFrequency(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] border border-[#CBD5E1] rounded-md bg-white focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    >
                      <option value="monthly">Mensual (Cada 30 días)</option>
                      <option value="biweekly">Quincenal (Cada 15 días)</option>
                      <option value="weekly">Semanal (Cada 7 días)</option>
                    </select>
                  </div>
                </div>

                {/* Has Initial Payment today? */}
                <div className="pt-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasInitialPayment}
                      onChange={(e) => {
                        setHasInitialPayment(e.target.checked);
                        if (e.target.checked && totalAmount) {
                          setInitialPaymentAmount(Math.round(Number(totalAmount) / installmentCount));
                        }
                      }}
                      className="rounded text-[#0284C7] focus:ring-[#0284C7]"
                    />
                    <span>¿El cliente pagó un abono inicial hoy ({todayStr})?</span>
                  </label>

                  {hasInitialPayment && (
                    <div className="mt-2 pl-6">
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Monto del Abono Inicial Pagado Hoy ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="0"
                        value={initialPaymentAmount}
                        onChange={(e) => setInitialPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs font-bold text-[#006C49] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Installments Visual Preview */}
                {calculatedInstallments.length > 0 && (
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[11px] font-bold text-[#334155] block mb-1.5">
                      📅 Distribución de Cuotas en el Calendario:
                    </span>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {calculatedInstallments.map((inst, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded border ${
                          inst.isInitialPaid 
                            ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#065F46]' 
                            : 'bg-white border-[#E2E8F0] text-[#0F172A]'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {inst.isInitialPaid ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-[#0284C7]" />
                            )}
                            <span className="font-semibold">{inst.label}</span>
                            <span className="text-[#64748B] text-[11px]">({inst.dueDate})</span>
                          </div>
                          <span className="font-bold font-mono-num">
                            {formatCurrency(inst.amount, currencySymbol, 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Issue Date & Due Date (if single payment) */}
          {!enableInstallments && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    Fecha de Emisión
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-[#334155]">
                      Fecha Límite de Cobro *
                    </label>
                  </div>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Quick Due Date Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#64748B] font-medium">Plazo rápido:</span>
                <button
                  type="button"
                  onClick={() => handleQuickDays(7)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] rounded border border-[#CBD5E1] cursor-pointer"
                >
                  +7 días
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDays(15)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] rounded border border-[#CBD5E1] cursor-pointer"
                >
                  +15 días
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDays(30)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] rounded border border-[#CBD5E1] cursor-pointer"
                >
                  +30 días
                </button>
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Observaciones o Condiciones de Cobro (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ej. Contactar a tesorería de cliente 3 días antes del vencimiento"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#0284C7] focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] p-2.5 rounded-md border border-[#FCA5A5]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-md transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>
                {enableInstallments ? `Guardar ${calculatedInstallments.length} Cuotas` : 'Guardar Cuenta por Cobrar'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

