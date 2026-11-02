import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ClockAlert, 
  Clock, 
  DollarSign, 
  Info,
  Receipt,
  FileText,
  AlertCircle,
  UserPlus,
  UserMinus,
  Wallet,
  Building2,
  Percent
} from 'lucide-react';
import { 
  AppSettings, 
  ExpenseCategory, 
  OutflowMethod, 
  PaymentChannel, 
  Payable, 
  Transaction 
} from '../../types';
import { 
  calculatePaymentFee, 
  calculatePocketAllocation, 
  formatCurrency,
  getLocalDateString,
  getLocalTimeString
} from '../../utils/financial';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onAddTransaction: (tx: Transaction) => void;
  onAddPayable: (p: Payable | Payable[]) => void;
  initialType?: 'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal' | 'payable';
  initialDate?: string;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  settings,
  onAddTransaction,
  onAddPayable,
  initialType,
  initialDate,
}) => {
  const [modalType, setModalType] = useState<'income' | 'expense' | 'capital_contribution' | 'partner_withdrawal' | 'payable'>('income');

  // Common State
  const [date, setDate] = useState<string>(() => getLocalDateString());
  const [time, setTime] = useState<string>(() => getLocalTimeString());
  const [concept, setConcept] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [docNumber, setDocNumber] = useState<string>('');

  // Document Type:
  // Income: 'boleta' | 'factura' | 'sin_doc'
  // Expense: 'factura' | 'honorarios' | 'sin_doc'
  const [docType, setDocType] = useState<'boleta' | 'factura' | 'honorarios' | 'sin_doc'>('boleta');
  const [retentionRate, setRetentionRate] = useState<number>(15.25); // Tasa legal retención honorarios SII (Ley 21.133)

  // Income specific
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>('credit_card');

  // Expense specific
  const [category, setCategory] = useState<ExpenseCategory>('raw_materials');
  const [outflowMethod, setOutflowMethod] = useState<OutflowMethod>('bank_transfer');

  // Payable specific
  const [vendor, setVendor] = useState<string>('');
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [dueDate, setDueDate] = useState<string>(() => getLocalDateString());

  useEffect(() => {
    if (isOpen) {
      const currentType = initialType || 'income';
      setModalType(currentType);
      setDate(initialDate || getLocalDateString());
      setTime(getLocalTimeString());
      setConcept('');
      setAmountStr('');
      setDocNumber('');
      setDocType(currentType === 'expense' ? 'factura' : 'boleta');
      setRetentionRate(15.25);
    }
  }, [isOpen, initialType, initialDate]);

  if (!isOpen) return null;

  const grossNum = parseFloat(amountStr) || 0;

  // Comisiones pasarelas (Solo para ingresos con tarjeta / app)
  const { fee: calculatedFee, net: calculatedNet } = calculatePaymentFee(
    grossNum, 
    paymentMethod, 
    settings.feeConfig
  );

  // IVA Calculations:
  // 1. Ingreso con Boleta o Factura: IVA Débito recaudado (19% incluido en el total cobrado)
  // 2. Egreso con Factura: IVA Crédito a favor (19% incluido en el total pagado)
  const hasIva = (modalType === 'income' && (docType === 'boleta' || docType === 'factura')) ||
                 (modalType === 'expense' && docType === 'factura');
  const ivaAmount = hasIva && grossNum > 0 ? (grossNum - (grossNum / 1.19)) : 0;
  const netCostWithoutIva = modalType === 'expense' && docType === 'factura' && grossNum > 0 
    ? (grossNum / 1.19) 
    : grossNum;

  // Boleta de Honorarios calculation
  const isHonorarios = modalType === 'expense' && docType === 'honorarios';
  const taxRetentionAmount = isHonorarios && grossNum > 0 ? Math.round(grossNum * (retentionRate / 100)) : 0;
  const netDisbursedHonorarios = isHonorarios ? (grossNum - taxRetentionAmount) : grossNum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (grossNum <= 0) return;

    if (modalType === 'income') {
      if (!concept.trim()) return;
      const pocketAlloc = calculatePocketAllocation(calculatedNet, settings.pocketConfig);
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'income',
        date,
        time,
        concept: concept.trim(),
        paymentMethod,
        docType,
        docNumber: docNumber.trim() || undefined,
        hasFactura: docType === 'factura' || docType === 'boleta',
        ivaAmount,
        grossAmount: grossNum,
        feeAmount: calculatedFee,
        netAmount: calculatedNet, // Líquido real que entra a la cuenta/caja
        pocketAllocation: pocketAlloc,
      };
      onAddTransaction(newTx);
    } else if (modalType === 'expense') {
      if (!concept.trim()) return;
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'expense',
        date,
        time,
        concept: concept.trim(),
        category,
        outflowMethod,
        docType,
        docNumber: docNumber.trim() || undefined,
        hasFactura: docType === 'factura',
        ivaAmount: docType === 'factura' ? ivaAmount : 0,
        netCostAmount: docType === 'factura' ? netCostWithoutIva : grossNum,
        taxRetentionRate: isHonorarios ? retentionRate : undefined,
        taxRetentionAmount: isHonorarios ? taxRetentionAmount : undefined,
        grossAmount: grossNum, // Gasto total contabilizado
        feeAmount: 0,
        netAmount: isHonorarios ? netDisbursedHonorarios : grossNum, // Salida real de liquidez bancaria/caja
      };
      onAddTransaction(newTx);
    } else if (modalType === 'capital_contribution') {
      if (!concept.trim()) return;
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'capital_contribution',
        date,
        time,
        concept: concept.trim(),
        paymentMethod: outflowMethod === 'cash_drawer' ? 'cash' : 'bank_transfer',
        outflowMethod,
        docNumber: docNumber.trim() || undefined,
        grossAmount: grossNum,
        feeAmount: 0,
        netAmount: grossNum, // Dinero que ingresa al banco o caja
        notes: `Aporte de Socio / Inyección de Capital (${outflowMethod === 'cash_drawer' ? 'Caja Efectivo' : 'Banco'})`,
      };
      onAddTransaction(newTx);
    } else if (modalType === 'partner_withdrawal') {
      if (!concept.trim()) return;
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'partner_withdrawal',
        date,
        time,
        concept: concept.trim(),
        paymentMethod: outflowMethod === 'cash_drawer' ? 'cash' : 'bank_transfer',
        outflowMethod,
        docNumber: docNumber.trim() || undefined,
        grossAmount: grossNum,
        feeAmount: 0,
        netAmount: grossNum, // Salida de liquidez
        notes: `Retiro de Socio / Utilidades (${outflowMethod === 'cash_drawer' ? 'Caja Efectivo' : 'Banco'})`,
      };
      onAddTransaction(newTx);
    } else if (modalType === 'payable') {
      if (!vendor.trim()) return;
      const count = installmentCount || 1;
      const now = Date.now();
      const baseDate = dueDate ? new Date(dueDate + 'T12:00:00') : (date ? new Date(date + 'T12:00:00') : new Date());

      if (count > 1) {
        const baseAmount = Math.floor(grossNum / count);
        const remainder = grossNum - (baseAmount * count);
        const payList: Payable[] = [];

        for (let i = 0; i < count; i++) {
          const instDate = new Date(baseDate);
          instDate.setMonth(instDate.getMonth() + i);
          const instAmount = i === 0 ? (baseAmount + remainder) : baseAmount;

          payList.push({
            id: `pay-${now}-${i}`,
            vendor: vendor.trim(),
            concept: `[Cuota ${i + 1}/${count}] ${concept.trim() || 'Compromiso a pagar'}`,
            totalAmount: instAmount,
            remainingAmount: instAmount,
            installmentCount: count,
            currentInstallment: i + 1,
            dueDate: getLocalDateString(instDate),
            status: 'pending',
            category,
            autoDeductInProjection: true,
            hasFactura: docType === 'factura',
            notes: docNumber ? `Doc N°: ${docNumber} (Cuota ${i + 1}/${count})` : undefined,
          });
        }
        onAddPayable(payList);
      } else {
        const newP: Payable = {
          id: `pay-${now}`,
          vendor: vendor.trim(),
          concept: concept.trim() || 'Compromiso a pagar',
          totalAmount: grossNum,
          remainingAmount: grossNum,
          installmentCount: 1,
          currentInstallment: 1,
          dueDate: dueDate || date,
          status: 'pending',
          category,
          autoDeductInProjection: true,
          hasFactura: docType === 'factura',
          notes: docNumber ? `Doc N°: ${docNumber}` : undefined,
        };
        onAddPayable(newP);
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl p-5 sm:p-6 max-w-xl w-full shadow-2xl border border-[#CBD5E1] relative my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-4 pr-8">
          <h3 className="text-lg font-bold text-[#0F172A]">
            {modalType === 'income' && 'Registrar Nuevo Ingreso / Venta'}
            {modalType === 'expense' && 'Registrar Nuevo Egreso / Compra'}
            {modalType === 'capital_contribution' && 'Aporte de Socio (Inyección de Capital)'}
            {modalType === 'partner_withdrawal' && 'Retiro de Socio (Utilidades / Fondos)'}
            {modalType === 'payable' && 'Registrar Cuenta por Pagar'}
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            {modalType === 'income' && 'El dinero cobrado ingresará a tu banco o caja descontando la comisión del canal.'}
            {modalType === 'expense' && 'El pago saldrá de tu banco o caja chica, desglosando IVA crédito o retención de honorarios.'}
            {modalType === 'capital_contribution' && 'Inyección de dinero a tu empresa. No se computa como venta ni distorsiona tu margen operativo.'}
            {modalType === 'partner_withdrawal' && 'Salida de dinero de la empresa para el socio. No se considera costo o gasto operacional.'}
            {modalType === 'payable' && 'Compromiso de deuda a futuro que afectará tus proyecciones y flujo de caja.'}
          </p>
        </div>

        {/* Mode Selector - Clean, Full-Width Responsive Tabs without Truncation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 bg-[#F1F5F9] p-1.5 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => {
              setModalType('income');
              setDocType('boleta');
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modalType === 'income'
                ? 'bg-[#006C49] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#86EFAC]" />
            <span className="whitespace-nowrap">Ingreso</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalType('expense');
              setDocType('factura');
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modalType === 'expense'
                ? 'bg-[#DC2626] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FCA5A5]" />
            <span className="whitespace-nowrap">Egreso / Gasto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalType('capital_contribution');
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modalType === 'capital_contribution'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#BAE6FD]" />
            <span className="whitespace-nowrap">Aporte Socio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalType('partner_withdrawal');
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              modalType === 'partner_withdrawal'
                ? 'bg-[#7C3AED] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            <UserMinus className="w-3.5 h-3.5 text-[#DDD6FE]" />
            <span className="whitespace-nowrap">Retiro Socio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalType('payable');
              setDocType('factura');
            }}
            className={`py-2 px-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              modalType === 'payable'
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
            }`}
          >
            <ClockAlert className="w-3.5 h-3.5 text-[#93C5FD]" />
            <span className="whitespace-nowrap">Cta. por Pagar</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1">
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Hora</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="12:00"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-mono-num"
              />
            </div>
          </div>

          {/* Vendor for Payables */}
          {modalType === 'payable' && (
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Proveedor / Entidad</label>
              <input
                type="text"
                placeholder="Ej: Distribuidora Central / Arrendador"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
              />
            </div>
          )}

          {/* Concept / Glosa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                {modalType === 'income' && 'Concepto / Glosa de Venta'}
                {modalType === 'expense' && 'Concepto / Detalle de Compra'}
                {modalType === 'capital_contribution' && 'Nombre Socio / Detalle del Aporte'}
                {modalType === 'partner_withdrawal' && 'Nombre Socio / Detalle del Retiro'}
                {modalType === 'payable' && 'Glosa del Compromiso'}
              </label>
              <input
                type="text"
                placeholder={
                  modalType === 'income' ? 'Ej: Venta de platos / Pedido mostrador #45' :
                  modalType === 'expense' ? 'Ej: Compra de pimentón e insumos / Arriendo local' :
                  modalType === 'capital_contribution' ? 'Ej: Aporte capital socio fundador Juan Pérez' :
                  modalType === 'partner_withdrawal' ? 'Ej: Retiro mensual utilidades socio Juan Pérez' :
                  'Ej: Factura insumos a 30 días'
                }
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
              />
            </div>

            {/* Document / Folio Number */}
            {(modalType === 'income' || modalType === 'expense' || modalType === 'payable') && (
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  N° Folio / Doc. <span className="text-[#94A3B8] font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: 14520"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-mono-num"
                />
              </div>
            )}
          </div>

          {/* Document Type Selector for Income, Expense and Payables */}
          {(modalType === 'income' || modalType === 'expense' || modalType === 'payable') && (
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Documento Tributario (Chile / SII)
              </label>
              {modalType === 'income' ? (
                <div className="grid grid-cols-3 gap-2">
                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'boleta' ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#006C49] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeIncome"
                      value="boleta"
                      checked={docType === 'boleta'}
                      onChange={() => setDocType('boleta')}
                      className="sr-only"
                    />
                    <Receipt className="w-4 h-4 mb-0.5" />
                    <span className="text-xs">Boleta Electrónica</span>
                    <span className="text-[10px] opacity-80">(IVA Débito 19%)</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'factura' ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#006C49] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeIncome"
                      value="factura"
                      checked={docType === 'factura'}
                      onChange={() => setDocType('factura')}
                      className="sr-only"
                    />
                    <FileText className="w-4 h-4 mb-0.5" />
                    <span className="text-xs">Factura Venta</span>
                    <span className="text-[10px] opacity-80">(A empresas 19%)</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'sin_doc' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#0F172A] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeIncome"
                      value="sin_doc"
                      checked={docType === 'sin_doc'}
                      onChange={() => setDocType('sin_doc')}
                      className="sr-only"
                    />
                    <span className="text-xs font-semibold pt-1">Sin Documento</span>
                    <span className="text-[10px] opacity-80">(Sin IVA)</span>
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'factura' ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeExpense"
                      value="factura"
                      checked={docType === 'factura'}
                      onChange={() => setDocType('factura')}
                      className="sr-only"
                    />
                    <FileText className="w-4 h-4 mb-0.5" />
                    <span className="text-xs">Factura de Compra</span>
                    <span className="text-[10px] text-[#B45309] font-medium">(IVA Crédito 19%)</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'honorarios' ? 'bg-[#F3E8FF] border-[#D8B4FE] text-[#6B21A8] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeExpense"
                      value="honorarios"
                      checked={docType === 'honorarios'}
                      onChange={() => setDocType('honorarios')}
                      className="sr-only"
                    />
                    <Percent className="w-4 h-4 mb-0.5 text-[#9333EA]" />
                    <span className="text-xs">Boleta Honorarios</span>
                    <span className="text-[10px] text-[#7E22CE] font-medium">(Retención {retentionRate}%)</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-md border text-center cursor-pointer transition-all ${
                    docType === 'sin_doc' ? 'bg-[#F1F5F9] border-[#94A3B8] text-[#0F172A] font-bold shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                  }`}>
                    <input
                      type="radio"
                      name="docTypeExpense"
                      value="sin_doc"
                      checked={docType === 'sin_doc'}
                      onChange={() => setDocType('sin_doc')}
                      className="sr-only"
                    />
                    <Receipt className="w-4 h-4 mb-0.5" />
                    <span className="text-xs">Boleta / Vale</span>
                    <span className="text-[10px] opacity-80">(Gasto sin IVA)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Retention Rate Config for Honorarios */}
          {modalType === 'expense' && docType === 'honorarios' && (
            <div className="bg-[#FAF5FF] border border-[#E9D5FF] p-2.5 rounded-lg flex items-center justify-between text-xs">
              <span className="text-[#6B21A8] font-semibold flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                Tasa de Retención Legal SII:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.25"
                  value={retentionRate}
                  onChange={(e) => setRetentionRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-white border border-[#D8B4FE] rounded text-right font-bold text-[#6B21A8] text-xs focus:outline-none"
                />
                <span className="font-bold text-[#6B21A8]">%</span>
              </div>
            </div>
          )}

          {/* Channel for Income */}
          {modalType === 'income' && (
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Canal de Cobro (Comisión y Retención Automática)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentChannel)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-medium"
              >
                <option value="debit_card">Tarjeta de Débito ({settings.feeConfig.debitRate}% com. retenida)</option>
                <option value="credit_card">Tarjeta de Crédito ({settings.feeConfig.creditRate}% com. retenida)</option>
                <option value="prepaid_card">Tarjeta Prepago ({settings.feeConfig.prepaidRate}% com. retenida)</option>
                <option value="delivery_app">Apps de Delivery ({settings.feeConfig.deliveryAppRate}% com. retenida)</option>
                <option value="bank_transfer">Transferencia Bancaria Directa (0% com. - entra 100%)</option>
                <option value="cash">Efectivo en Caja (0% com. - entra 100%)</option>
              </select>
            </div>
          )}

          {/* Expense Category */}
          {(modalType === 'expense' || modalType === 'payable') && (
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Clasificación de Costo / Gasto</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-medium"
              >
                <optgroup label="1. Costos Directos (Variables)">
                  <option value="raw_materials">Materia Prima / Insumos principales (pimentón, carnes, etc.)</option>
                  <option value="packaging">Envases y Desechables (Packaging)</option>
                  <option value="shipping">Fletes de compra / Reposición</option>
                </optgroup>
                <optgroup label="2. Gastos Operativos (Fijos / OPEX)">
                  <option value="rent">Arriendo y Gastos Comunes</option>
                  <option value="utilities">Servicios Básicos (Luz, Agua, Gas, Internet)</option>
                  <option value="payroll_daily">Sueldos y Turnos</option>
                  <option value="software_services">Software, Hosting y Comisiones POS</option>
                  <option value="accounting_legal">Servicios Contables y Legales / Honorarios</option>
                  <option value="marketing">Marketing y Publicidad</option>
                  <option value="minor_expenses">Gastos menores / Caja chica</option>
                  <option value="other_expense">Otros Gastos</option>
                </optgroup>
                <optgroup label="3. Impuestos y Leyes Sociales">
                  <option value="taxes_sii">F29 SII (Pago mensual IVA Neto + PPM + Retenciones)</option>
                  <option value="taxes_previred">Previred (Cotizaciones Previsionales)</option>
                </optgroup>
                <optgroup label="4. Inversiones (CAPEX)">
                  <option value="capex_machinery">Compra de maquinaria / Equipamiento</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* Method of Outflow / Destination Account for Expense, Capital & Withdrawal */}
          {(modalType === 'expense' || modalType === 'capital_contribution' || modalType === 'partner_withdrawal') && (
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                {modalType === 'capital_contribution' ? 'Cuenta de Destino del Dinero' :
                 modalType === 'partner_withdrawal' ? 'Cuenta de Origen del Dinero' :
                 'Medio de Pago del Egreso'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center p-2 rounded-md border text-xs font-semibold cursor-pointer transition-all ${
                  outflowMethod === 'bank_transfer' ? 'bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8] shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                }`}>
                  <input
                    type="radio"
                    name="modalOutflow"
                    value="bank_transfer"
                    checked={outflowMethod === 'bank_transfer'}
                    onChange={() => setOutflowMethod('bank_transfer')}
                    className="sr-only"
                  />
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Cuenta Bancaria</span>
                </label>
                <label className={`flex items-center justify-center p-2 rounded-md border text-xs font-semibold cursor-pointer transition-all ${
                  outflowMethod === 'cash_drawer' ? 'bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8] shadow-xs' : 'bg-white border-[#CBD5E1] text-[#64748B]'
                }`}>
                  <input
                    type="radio"
                    name="modalOutflow"
                    value="cash_drawer"
                    checked={outflowMethod === 'cash_drawer'}
                    onChange={() => setOutflowMethod('cash_drawer')}
                    className="sr-only"
                  />
                  <Wallet className="w-3.5 h-3.5 mr-1.5" />
                  <span>Caja Chica (Efectivo)</span>
                </label>
              </div>
            </div>
          )}

          {/* Payables fields */}
          {modalType === 'payable' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">N° de Cuotas</label>
                <input
                  type="number"
                  min="1"
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Fecha Vencimiento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Capital Contribution & Partner Withdrawal Guidance Box */}
          {modalType === 'capital_contribution' && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3 text-xs text-[#0369A1] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#0284C7]">
                <Info className="w-4 h-4" />
                <span>Tratamiento Financiero de Aporte de Socio:</span>
              </div>
              <p className="leading-relaxed">
                Este dinero <strong>se sumará inmediatamente al saldo disponible</strong> de tu {outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Cuenta Bancaria'}. 
                <strong> No tributa IVA ni altera tus ingresos operacionales</strong>, manteniendo tu margen de ventas 100% fiel a la operación comercial.
              </p>
            </div>
          )}

          {modalType === 'partner_withdrawal' && (
            <div className="bg-[#FAF5FF] border border-[#E9D5FF] rounded-lg p-3 text-xs text-[#6B21A8] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#7C3AED]">
                <Info className="w-4 h-4" />
                <span>Tratamiento Financiero de Retiro de Socio:</span>
              </div>
              <p className="leading-relaxed">
                Este retiro <strong>descuenta liquidez directa</strong> de tu {outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Cuenta Bancaria'}. 
                <strong> No se computa como gasto o costo del restaurante</strong>, protegiendo tu cálculo de margen operacional y EBITDA.
              </p>
            </div>
          )}

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              {modalType === 'income' && 'Total Cobrado al Cliente (Bruto)'}
              {modalType === 'expense' && (isHonorarios ? 'Monto Bruto Boleta de Honorarios' : 'Total Factura / Boleta Pagada')}
              {modalType === 'capital_contribution' && 'Monto Aportado por el Socio'}
              {modalType === 'partner_withdrawal' && 'Monto Retirado por el Socio'}
              {modalType === 'payable' && 'Monto Total Pasivo / Deuda'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-0 top-0 bottom-0 px-3 bg-[#F1F5F9] border-r border-[#CBD5E1] flex items-center text-xs text-[#64748B] font-bold rounded-l-md">
                {settings.currencySymbol}
              </span>
              <input
                type="number"
                step={settings.currency === 'CLP' ? "1" : "0.01"}
                min={settings.currency === 'CLP' ? "1" : "0.01"}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={settings.currency === 'CLP' ? "0" : "0.00"}
                required
                className="w-full pl-10 pr-3 py-2 text-sm font-bold text-right bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-2 focus:ring-[#0F172A] focus:outline-none font-mono-num"
              />
            </div>
          </div>

          {/* Financial Breakdown Preview */}
          {grossNum > 0 && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Desglose Financiero y Bancario</span>
              </div>

              {modalType === 'income' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[#64748B] font-mono-num">
                    <span>Total Cobrado (con IVA):</span>
                    <span className="font-semibold text-[#0F172A]">{formatCurrency(grossNum, settings.currencySymbol)}</span>
                  </div>

                  {calculatedFee > 0 && (
                    <div className="flex justify-between text-[#EF4444] font-mono-num">
                      <span>- Comisión Retenida por Pasarela (No entra a cuenta):</span>
                      <span className="font-bold">-{formatCurrency(calculatedFee, settings.currencySymbol)}</span>
                    </div>
                  )}

                  {docType !== 'sin_doc' && (
                    <div className="flex justify-between text-[#B45309] font-mono-num bg-[#FEF3C7]/40 p-1.5 rounded border border-[#FDE68A]">
                      <span>IVA Débito 19% (Recaudado para F29 - Sí entra al banco):</span>
                      <span className="font-bold">+{formatCurrency(ivaAmount, settings.currencySymbol, 0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-[#0F172A] pt-1.5 border-t border-[#CBD5E1] font-mono-num bg-white p-2 rounded border border-[#E2E8F0]">
                    <span className="text-[#006C49]">💰 Líquido Efectivo Depositado en Banco / Caja:</span>
                    <span className="text-[#006C49] text-sm">{formatCurrency(calculatedNet, settings.currencySymbol)}</span>
                  </div>
                </div>
              )}

              {modalType === 'expense' && (
                <div className="space-y-1.5">
                  {isHonorarios ? (
                    <>
                      <div className="flex justify-between text-[#64748B] font-mono-num">
                        <span>Gasto Bruto Honorarios:</span>
                        <span className="font-bold text-[#0F172A]">{formatCurrency(grossNum, settings.currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between text-[#7E22CE] font-mono-num bg-[#F3E8FF]/60 p-1.5 rounded border border-[#D8B4FE]">
                        <span>Retención SII ({retentionRate}% a enterar en F29):</span>
                        <span className="font-bold">-{formatCurrency(taxRetentionAmount, settings.currencySymbol, 0)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[#DC2626] pt-1.5 border-t border-[#CBD5E1] font-mono-num bg-white p-2 rounded border border-[#E2E8F0]">
                        <span>💸 Salida Real de Dinero Pagada al Profesional:</span>
                        <span className="text-sm">-{formatCurrency(netDisbursedHonorarios, settings.currencySymbol)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-[#DC2626] font-mono-num font-bold">
                        <span>Salida Real de Dinero ({outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Banco'}):</span>
                        <span>-{formatCurrency(grossNum, settings.currencySymbol)}</span>
                      </div>

                      {docType === 'factura' && (
                        <>
                          <div className="flex justify-between text-[#0F172A] font-mono-num pt-1 border-t border-[#E2E8F0]">
                            <span>Costo Neto Real de la Empresa (sin IVA):</span>
                            <span className="font-semibold">{formatCurrency(netCostWithoutIva, settings.currencySymbol, 0)}</span>
                          </div>
                          <div className="flex justify-between text-[#006C49] font-mono-num bg-[#DCFCE7]/40 p-1.5 rounded border border-[#86EFAC]">
                            <span>IVA Crédito 19% (A favor de la empresa para F29):</span>
                            <span className="font-bold">+{formatCurrency(ivaAmount, settings.currencySymbol, 0)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {modalType === 'capital_contribution' && (
                <div className="space-y-1 text-[#0369A1] font-mono-num font-bold flex justify-between">
                  <span>Incremento directo en {outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Cuenta Bancaria'}:</span>
                  <span className="text-sm">+{formatCurrency(grossNum, settings.currencySymbol)}</span>
                </div>
              )}

              {modalType === 'partner_withdrawal' && (
                <div className="space-y-1 text-[#7C3AED] font-mono-num font-bold flex justify-between">
                  <span>Descuento directo en {outflowMethod === 'cash_drawer' ? 'Caja Chica' : 'Cuenta Bancaria'}:</span>
                  <span className="text-sm">-{formatCurrency(grossNum, settings.currencySymbol)}</span>
                </div>
              )}

              {modalType === 'payable' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[#475569] font-mono-num font-bold">
                    <span>Compromiso Total a Pagar:</span>
                    <span className="text-[#0F172A] text-sm">{formatCurrency(grossNum, settings.currencySymbol)}</span>
                  </div>

                  {installmentCount > 1 && (
                    <div className="flex justify-between text-[#2563EB] font-mono-num bg-[#EFF6FF] p-1.5 rounded border border-[#BFDBFE]">
                      <span>Esquema de Pago ({installmentCount} cuotas):</span>
                      <span className="font-bold">
                        {installmentCount} cuotas de ~{formatCurrency(Math.round(grossNum / installmentCount), settings.currencySymbol, 0)}
                      </span>
                    </div>
                  )}

                  {docType === 'factura' && ivaAmount > 0 && (
                    <div className="flex justify-between text-[#006C49] font-mono-num bg-[#DCFCE7]/40 p-1.5 rounded border border-[#86EFAC]">
                      <span>IVA Crédito a recuperar en F29:</span>
                      <span className="font-bold">+{formatCurrency(ivaAmount, settings.currencySymbol, 0)}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0] flex items-center gap-1">
                    <ClockAlert className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>Se programará en el <strong>Calendario de Vencimientos</strong> y en la <strong>Proyección de Flujo de Caja</strong>.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
