import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Info,
  Calendar,
  Clock,
  Receipt,
  FileText,
  UserPlus,
  UserMinus,
  Percent,
  Building2,
  Wallet
} from 'lucide-react';
import { 
  AppSettings, 
  ExpenseCategory, 
  OutflowMethod, 
  PaymentChannel, 
  Transaction 
} from '../../types';
import { 
  calculatePaymentFee, 
  calculatePocketAllocation, 
  formatCurrency 
} from '../../utils/financial';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  settings: AppSettings;
  onUpdateTransaction: (tx: Transaction) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  settings,
  onUpdateTransaction,
}) => {
  const [type, setType] = useState<'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal'>('income');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('12:00');
  const [concept, setConcept] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [docNumber, setDocNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>('credit_card');
  const [category, setCategory] = useState<ExpenseCategory>('raw_materials');
  const [outflowMethod, setOutflowMethod] = useState<OutflowMethod>('cash_drawer');
  const [docType, setDocType] = useState<'boleta' | 'factura' | 'honorarios' | 'sin_doc'>('boleta');
  const [retentionRate, setRetentionRate] = useState<number>(15.25);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'income');
      setDate(transaction.date || new Date().toISOString().split('T')[0]);
      setTime(transaction.time || '12:00');
      setConcept(transaction.concept || '');
      setAmountStr(String(transaction.grossAmount || ''));
      setDocNumber(transaction.docNumber || '');
      setPaymentMethod(transaction.paymentMethod || 'credit_card');
      setCategory(transaction.category || 'raw_materials');
      setOutflowMethod(transaction.outflowMethod || 'bank_transfer');
      setRetentionRate(transaction.taxRetentionRate || 15.25);
      
      if (transaction.docType) {
        setDocType(transaction.docType);
      } else if (transaction.hasFactura) {
        setDocType('factura');
      } else {
        setDocType(transaction.type === 'income' ? 'boleta' : 'sin_doc');
      }

      setNotes(transaction.notes || '');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const grossNum = parseFloat(amountStr) || 0;
  
  // Calculate Fee & Net
  const { fee: calculatedFee, net: calculatedNet } = type === 'income'
    ? calculatePaymentFee(grossNum, paymentMethod, settings.feeConfig)
    : { fee: 0, net: grossNum };

  // Calculate IVA 19%
  const hasIva = (type === 'income' && (docType === 'boleta' || docType === 'factura')) ||
                 (type === 'expense' && docType === 'factura');
  const ivaAmount = hasIva && grossNum > 0 ? (grossNum - (grossNum / 1.19)) : 0;
  const netCostWithoutIva = type === 'expense' && docType === 'factura' && grossNum > 0 ? (grossNum / 1.19) : grossNum;

  // Honorarios
  const isHonorarios = type === 'expense' && docType === 'honorarios';
  const taxRetentionAmount = isHonorarios && grossNum > 0 ? Math.round(grossNum * (retentionRate / 100)) : 0;
  const netDisbursedHonorarios = isHonorarios ? (grossNum - taxRetentionAmount) : grossNum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (grossNum <= 0 || !concept.trim()) return;

    const pocketAlloc = type === 'income' 
      ? calculatePocketAllocation(calculatedNet, settings.pocketConfig) 
      : undefined;

    const updatedTx: Transaction = {
      ...transaction,
      type,
      date,
      time,
      concept: concept.trim(),
      grossAmount: grossNum,
      docType: (type === 'income' || type === 'expense') ? docType : undefined,
      docNumber: docNumber.trim() || undefined,
      hasFactura: docType === 'factura' || (type === 'income' && docType === 'boleta'),
      ivaAmount: hasIva ? ivaAmount : 0,
      netCostAmount: type === 'expense' && docType === 'factura' ? netCostWithoutIva : undefined,
      taxRetentionRate: isHonorarios ? retentionRate : undefined,
      taxRetentionAmount: isHonorarios ? taxRetentionAmount : undefined,
      feeAmount: type === 'income' ? calculatedFee : 0,
      netAmount: type === 'income' ? calculatedNet : isHonorarios ? netDisbursedHonorarios : grossNum,
      notes: notes.trim() || undefined,
      ...(type === 'income' 
        ? { paymentMethod, pocketAllocation: pocketAlloc, category: undefined, outflowMethod: undefined } 
        : type === 'expense'
        ? { category, outflowMethod, paymentMethod: undefined, pocketAllocation: undefined }
        : { paymentMethod: outflowMethod === 'cash_drawer' ? 'cash' : 'bank_transfer', outflowMethod, category: undefined, pocketAllocation: undefined }),
    };

    onUpdateTransaction(updatedTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-[#CBD5E1] overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-md ${
              type === 'income' ? 'bg-[#DCFCE7] text-[#006C49]' : 
              type === 'expense' ? 'bg-[#FEE2E2] text-[#DC2626]' :
              type === 'capital_contribution' ? 'bg-[#BAE6FD] text-[#0284C7]' :
              'bg-[#DDD6FE] text-[#7C3AED]'
            }`}>
              {type === 'income' && <ArrowDownLeft className="w-4 h-4" />}
              {type === 'expense' && <ArrowUpRight className="w-4 h-4" />}
              {type === 'capital_contribution' && <UserPlus className="w-4 h-4" />}
              {type === 'partner_withdrawal' && <UserMinus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">
                Modificar Registro
              </h3>
              <p className="text-xs text-[#64748B]">
                ID: {transaction.id}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          
          {/* Tipo Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#F1F5F9] p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setType('income');
                setDocType('boleta');
              }}
              className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === 'income' ? 'bg-[#006C49] text-white shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Ingreso (Venta)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setDocType('factura');
              }}
              className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === 'expense' ? 'bg-[#DC2626] text-white shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Egreso (Gasto)
            </button>
            <button
              type="button"
              onClick={() => setType('capital_contribution')}
              className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === 'capital_contribution' ? 'bg-[#0284C7] text-white shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Aporte Socio
            </button>
            <button
              type="button"
              onClick={() => setType('partner_withdrawal')}
              className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                type === 'partner_withdrawal' ? 'bg-[#7C3AED] text-white shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Retiro Socio
            </button>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Fecha</label>
              <div className="relative flex items-center">
                <Calendar className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Hora</label>
              <div className="relative flex items-center">
                <Clock className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5" />
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none font-mono-num"
                />
              </div>
            </div>
          </div>

          {/* Concepto & Doc Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#475569] mb-1">Concepto / Glosa</label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Folio / N° Doc.</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Ej: 14520"
                className="w-full px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none font-mono-num"
              />
            </div>
          </div>

          {/* Documento Tributario */}
          {(type === 'income' || type === 'expense') && (
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Documento Tributario</label>
              {type === 'income' ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocType('boleta')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'boleta' ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#006C49] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Boleta Electrónica</div>
                    <div className="text-[10px] opacity-80">(IVA 19%)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType('factura')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'factura' ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#006C49] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Factura Venta</div>
                    <div className="text-[10px] opacity-80">(IVA 19%)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType('sin_doc')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'sin_doc' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#0F172A] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Sin Documento</div>
                    <div className="text-[10px] opacity-80">(Sin IVA)</div>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocType('factura')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'factura' ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Factura Compra</div>
                    <div className="text-[10px] opacity-80">(IVA Crédito 19%)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType('honorarios')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'honorarios' ? 'bg-[#F3E8FF] border-[#D8B4FE] text-[#6B21A8] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Boleta Honorarios</div>
                    <div className="text-[10px] opacity-80">(Retención {retentionRate}%)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType('sin_doc')}
                    className={`p-2 rounded-md border text-center cursor-pointer transition-all ${
                      docType === 'sin_doc' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#0F172A] font-bold' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    <div className="text-xs">Boleta / Vale</div>
                    <div className="text-[10px] opacity-80">(Sin IVA Crédito)</div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Income Channel */}
          {type === 'income' && (
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Canal de Cobro</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentChannel)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
              >
                <option value="debit_card">Tarjeta Débito ({settings.feeConfig.debitRate}%)</option>
                <option value="credit_card">Tarjeta Crédito ({settings.feeConfig.creditRate}%)</option>
                <option value="prepaid_card">Prepago ({settings.feeConfig.prepaidRate}%)</option>
                <option value="delivery_app">Delivery ({settings.feeConfig.deliveryAppRate}%)</option>
                <option value="bank_transfer">Transferencia Bancaria (0%)</option>
                <option value="cash">Efectivo en Caja (0%)</option>
              </select>
            </div>
          )}

          {/* Expense Category */}
          {type === 'expense' && (
            <div>
              <label className="block font-semibold text-[#475569] mb-1">Categoría de Gasto</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
              >
                <option value="raw_materials">Materia Prima / Insumos</option>
                <option value="packaging">Envases y Desechables</option>
                <option value="shipping">Fletes de Reposición</option>
                <option value="rent">Arriendo y Gastos Comunes</option>
                <option value="utilities">Servicios Básicos</option>
                <option value="payroll_daily">Sueldos y Turnos</option>
                <option value="software_services">Software y Comisiones POS</option>
                <option value="accounting_legal">Servicios Contables y Legales / Honorarios</option>
                <option value="marketing">Marketing y Publicidad</option>
                <option value="minor_expenses">Gastos Menores / Caja Chica</option>
                <option value="other_expense">Otros Gastos</option>
                <option value="taxes_sii">F29 SII</option>
                <option value="taxes_previred">Previred</option>
                <option value="capex_machinery">Inversión / Maquinaria</option>
              </select>
            </div>
          )}

          {/* Outflow Method / Destination Account */}
          {(type === 'expense' || type === 'capital_contribution' || type === 'partner_withdrawal') && (
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                {type === 'capital_contribution' ? 'Cuenta de Destino' :
                 type === 'partner_withdrawal' ? 'Cuenta de Origen' : 'Medio de Pago'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center p-2 rounded-md border font-semibold cursor-pointer ${
                  outflowMethod === 'bank_transfer' ? 'bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8]' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                }`}>
                  <input
                    type="radio"
                    name="editOutflow"
                    value="bank_transfer"
                    checked={outflowMethod === 'bank_transfer'}
                    onChange={() => setOutflowMethod('bank_transfer')}
                    className="sr-only"
                  />
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  Banco
                </label>
                <label className={`flex items-center justify-center p-2 rounded-md border font-semibold cursor-pointer ${
                  outflowMethod === 'cash_drawer' ? 'bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8]' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                }`}>
                  <input
                    type="radio"
                    name="editOutflow"
                    value="cash_drawer"
                    checked={outflowMethod === 'cash_drawer'}
                    onChange={() => setOutflowMethod('cash_drawer')}
                    className="sr-only"
                  />
                  <Wallet className="w-3.5 h-3.5 mr-1.5" />
                  Caja Chica
                </label>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Monto ({settings.currencySymbol})
            </label>
            <input
              type="number"
              step={settings.currency === 'CLP' ? "1" : "0.01"}
              min={settings.currency === 'CLP' ? "1" : "0.01"}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] font-bold text-right focus:outline-none font-mono-num"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold rounded-md transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold rounded-md transition-colors cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
