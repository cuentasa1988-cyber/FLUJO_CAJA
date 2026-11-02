import React, { useState } from 'react';
import { X, CheckCircle2, Building2, Coins, Calendar, Clock, FileText } from 'lucide-react';
import { Receivable, OutflowMethod } from '../../types';
import { formatCurrency, getLocalDateString, getLocalTimeString } from '../../utils/financial';

interface RecordCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  receivable: Receivable | null;
  currencySymbol: string;
  onConfirmCollection: (
    receivable: Receivable,
    amount: number,
    destinationMethod: OutflowMethod,
    date: string,
    time: string,
    reference?: string
  ) => void;
}

export const RecordCollectionModal: React.FC<RecordCollectionModalProps> = ({
  isOpen,
  onClose,
  receivable,
  currencySymbol,
  onConfirmCollection,
}) => {
  if (!isOpen || !receivable) return null;

  const [amount, setAmount] = useState<number>(receivable.remainingAmount);
  const [destinationMethod, setDestinationMethod] = useState<OutflowMethod>('bank_transfer');
  const [collectionDate, setCollectionDate] = useState<string>(getLocalDateString());
  const [collectionTime, setCollectionTime] = useState<string>(getLocalTimeString());
  const [reference, setReference] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('El monto a cobrar debe ser mayor a 0');
      return;
    }
    if (amount > receivable.remainingAmount) {
      setError(`El monto no puede exceder el saldo pendiente (${formatCurrency(receivable.remainingAmount, currencySymbol)})`);
      return;
    }

    onConfirmCollection(
      receivable,
      amount,
      destinationMethod,
      collectionDate,
      collectionTime,
      reference.trim() || undefined
    );
    onClose();
  };

  const isFullPayment = amount >= receivable.remainingAmount;

  return (
    <div className="fixed inset-0 bg-[#0F172A]/50 z-50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-white border border-[#CBD5E1] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#006C49] uppercase">
              Cobranza Real a Cliente
            </span>
            <h3 className="text-base font-bold text-[#0F172A]">
              Registrar Cobro / Abono
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Info Banner of Receivable */}
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-3.5 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-[#166534] uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-bold text-[#0F172A]">{receivable.clientName}</p>
                <p className="text-xs text-[#475569]">{receivable.concept}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-[#166534] uppercase tracking-wider">Saldo Pendiente</p>
                <p className="text-base font-extrabold text-[#006C49]">
                  {formatCurrency(receivable.remainingAmount, currencySymbol)}
                </p>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-[#334155]">
                Monto que ingresa ({currencySymbol}) *
              </label>
              <button
                type="button"
                onClick={() => setAmount(receivable.remainingAmount)}
                className="text-[11px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                Cobrar total pendiente ({formatCurrency(receivable.remainingAmount, currencySymbol)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64748B]">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="1"
                step="any"
                max={receivable.remainingAmount}
                value={amount || ''}
                onChange={(e) => {
                  setAmount(parseFloat(e.target.value) || 0);
                  setError('');
                }}
                className="w-full pl-8 pr-3 py-2 text-base font-bold text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#006C49] focus:outline-none"
                required
              />
            </div>
            {isFullPayment ? (
              <p className="text-[11px] text-[#006C49] font-medium mt-1">
                ✔ Esta cuenta quedará totalmente saldada y marcada como cobrada.
              </p>
            ) : (
              <p className="text-[11px] text-[#D97706] font-medium mt-1">
                Quedará un saldo pendiente de {formatCurrency(receivable.remainingAmount - amount, currencySymbol)}.
              </p>
            )}
          </div>

          {/* Destination: Where does the money enter? */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1.5">
              ¿A dónde entra el dinero? *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDestinationMethod('bank_transfer')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  destinationMethod === 'bank_transfer'
                    ? 'border-[#0284C7] bg-[#F0F9FF] ring-2 ring-[#0284C7]/20'
                    : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
                }`}
              >
                <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${destinationMethod === 'bank_transfer' ? 'text-[#0284C7]' : 'text-[#64748B]'}`} />
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">Cuenta Corriente</p>
                  <p className="text-[11px] text-[#64748B]">Transferencia / Depósito</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDestinationMethod('cash_drawer')}
                className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  destinationMethod === 'cash_drawer'
                    ? 'border-[#006C49] bg-[#F0FDF4] ring-2 ring-[#006C49]/20'
                    : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
                }`}
              >
                <Coins className={`w-4 h-4 mt-0.5 shrink-0 ${destinationMethod === 'cash_drawer' ? 'text-[#006C49]' : 'text-[#64748B]'}`} />
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">Caja Registradora</p>
                  <p className="text-[11px] text-[#64748B]">Gaveta de Efectivo</p>
                </div>
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              💡 Al confirmar, el sistema registrará automáticamente el ingreso real sumándolo a tu saldo.
            </p>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Fecha de cobro
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#006C49] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">
                Hora
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="time"
                  value={collectionTime}
                  onChange={(e) => setCollectionTime(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#006C49] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Reference / Note */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Referencia / Comprobante (Opcional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Ej. N° Operación bancaria 94812"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-md focus:ring-2 focus:ring-[#006C49] focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] p-2 rounded-md border border-[#FCA5A5]">
              {error}
            </p>
          )}

          {/* Footer Actions */}
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
              className="px-4 py-2 bg-[#006C49] hover:bg-[#005538] text-white text-xs font-bold rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Ingreso de Dinero</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
