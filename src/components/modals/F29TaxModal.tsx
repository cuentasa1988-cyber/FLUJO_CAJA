import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Percent, 
  ArrowRight,
  ShieldCheck,
  Receipt,
  HelpCircle,
  X
} from 'lucide-react';
import { AppSettings, Transaction } from '../../types';
import { formatCurrency, applyCurrencyRules } from '../../utils/financial';

interface F29TaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  transactions: Transaction[];
  onAddTransaction?: (tx: Transaction) => void;
  defaultMonth?: string; // YYYY-MM
}

export const F29TaxModal: React.FC<F29TaxModalProps> = ({
  isOpen,
  onClose,
  settings,
  transactions,
  onAddTransaction,
  defaultMonth,
}) => {
  const currentMonthStr = useMemo(() => {
    return defaultMonth || new Date().toISOString().slice(0, 7);
  }, [defaultMonth]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [ppmRate, setPpmRate] = useState<number>(1.0); // 1.0% default PPM rate for Pro-Pyme
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState<string | null>(null);

  // Filter transactions belonging to the selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Tax calculations
  const taxMetrics = useMemo(() => {
    let salesGross = 0;
    let salesNet = 0;
    let salesNetAfectas = 0;
    let salesNetExentas = 0;
    let salesIvaDebito = 0;
    let salesCount = 0;

    let purchasesGross = 0;
    let purchasesNet = 0;
    let purchasesIvaCredito = 0;
    let purchasesCount = 0;

    let honorariosGross = 0;
    let honorariosRetentions = 0;
    let honorariosCount = 0;

    let nonTaxableExpenses = 0;

    for (const tx of monthTransactions) {
      if (tx.type === 'income') {
        salesGross += tx.grossAmount;
        salesCount++;
        const hasTax = tx.docType === 'factura' || tx.docType === 'boleta' || tx.hasFactura || (tx.ivaAmount !== undefined && tx.ivaAmount > 0);
        if (hasTax) {
          const iva = tx.ivaAmount || (tx.grossAmount - (tx.grossAmount / 1.19));
          const net = tx.grossAmount - iva;
          salesIvaDebito += iva;
          salesNetAfectas += net;
          salesNet += net;
        } else {
          salesNetExentas += tx.grossAmount;
          salesNet += tx.grossAmount;
        }
      } else if (tx.type === 'expense') {
        if (tx.docType === 'honorarios' || (tx.taxRetentionAmount && tx.taxRetentionAmount > 0)) {
          honorariosCount++;
          honorariosGross += tx.grossAmount;
          honorariosRetentions += (tx.taxRetentionAmount || (tx.grossAmount * (tx.taxRetentionRate || 15.25) / 100));
        } else if (tx.docType === 'factura' || tx.hasFactura || (tx.ivaAmount !== undefined && tx.ivaAmount > 0)) {
          purchasesCount++;
          purchasesGross += tx.grossAmount;
          const iva = tx.ivaAmount || (tx.grossAmount - (tx.grossAmount / 1.19));
          const net = tx.grossAmount - iva;
          purchasesIvaCredito += iva;
          purchasesNet += net;
        } else {
          nonTaxableExpenses += tx.grossAmount;
        }
      }
    }

    const ivaNetoAPagar = Math.max(0, salesIvaDebito - purchasesIvaCredito);
    const remanenteMes = Math.max(0, purchasesIvaCredito - salesIvaDebito);
    const ppmAmount = salesNet * (ppmRate / 100);
    const totalF29APagar = ivaNetoAPagar + ppmAmount + honorariosRetentions;

    return {
      salesGross: applyCurrencyRules(salesGross),
      salesNet: applyCurrencyRules(salesNet),
      salesNetAfectas: applyCurrencyRules(salesNetAfectas),
      salesNetExentas: applyCurrencyRules(salesNetExentas),
      salesIvaDebito: applyCurrencyRules(salesIvaDebito),
      salesCount,
      purchasesGross: applyCurrencyRules(purchasesGross),
      purchasesNet: applyCurrencyRules(purchasesNet),
      purchasesIvaCredito: applyCurrencyRules(purchasesIvaCredito),
      purchasesCount,
      honorariosGross: applyCurrencyRules(honorariosGross),
      honorariosRetentions: applyCurrencyRules(honorariosRetentions),
      honorariosCount,
      nonTaxableExpenses: applyCurrencyRules(nonTaxableExpenses),
      ivaNetoAPagar: applyCurrencyRules(ivaNetoAPagar),
      remanenteMes: applyCurrencyRules(remanenteMes),
      ppmAmount: applyCurrencyRules(ppmAmount),
      totalF29APagar: applyCurrencyRules(totalF29APagar),
    };
  }, [monthTransactions, ppmRate]);

  // Export CSV F29 breakdown
  const handleExportF29Csv = () => {
    const csvRows = [
      ['--- LIQUIDACIÓN FORMULARIO 29 (SII CHILE) ---'],
      ['Empresa', settings.businessName],
      ['Período Tributario', selectedMonth],
      ['Fecha de Generación', new Date().toLocaleDateString()],
      [],
      ['LÍNEA TRIBUTARIA', 'CÓDIGO SII', 'BASE IMPONIBLE (NETO)', 'TASA IMPOSITIVA', 'MONTO DETERMINADO'],
      ['1. Débito Fiscal (Ventas Afectas Boletas y Facturas)', 'Cód. [538/110]', taxMetrics.salesNetAfectas.toFixed(2), '19.0%', taxMetrics.salesIvaDebito.toFixed(2)],
      ...(taxMetrics.salesNetExentas > 0 ? [['1b. Ventas y Servicios Exentos o No Gravados', 'Cód. [142]', taxMetrics.salesNetExentas.toFixed(2), 'Exento', '0.00']] : []),
      ['2. Crédito Fiscal (Compras y Gastos con Factura)', 'Cód. [520]', taxMetrics.purchasesNet.toFixed(2), '19.0%', `-${taxMetrics.purchasesIvaCredito.toFixed(2)}`],
      ['3. Subtotal IVA del Período', taxMetrics.ivaNetoAPagar > 0 ? 'Cód. [89] (A Pagar)' : 'Cód. [77] (Remanente)', '-', '-', taxMetrics.ivaNetoAPagar > 0 ? taxMetrics.ivaNetoAPagar.toFixed(2) : `+${taxMetrics.remanenteMes.toFixed(2)} (A Favor)`],
      ['4. Pago Provisional Mensual (PPM Régimen ProPyme)', 'Cód. [152]', taxMetrics.salesNet.toFixed(2), `${ppmRate}%`, taxMetrics.ppmAmount.toFixed(2)],
      ['5. Retención Boletas de Honorarios 2ª Categoría', 'Cód. [151]', taxMetrics.honorariosGross.toFixed(2), '15.25%', taxMetrics.honorariosRetentions.toFixed(2)],
      [],
      ['TOTAL DETERMINADO A PAGAR EN FORMULARIO 29', 'Cód. [91]', '-', '-', taxMetrics.totalF29APagar.toFixed(2)],
      ['Vencimiento Legal', 'Día 20 del mes siguiente (Declaración por Internet sii.cl)'],
    ];

    const csvContent = csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `F29_Liquidacion_${selectedMonth}_${settings.businessName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Provision Tax Reserve into Ledger
  const handleProvisionTaxToLedger = () => {
    if (!onAddTransaction || taxMetrics.totalF29APagar <= 0) return;

    const newTx: Transaction = {
      id: `tx-f29-prov-${Date.now()}`,
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      concept: `Provisión F29 SII Período ${selectedMonth} (IVA: ${formatCurrency(taxMetrics.ivaNetoAPagar, settings.currencySymbol, 0)} + PPM: ${formatCurrency(taxMetrics.ppmAmount, settings.currencySymbol, 0)} + Ret: ${formatCurrency(taxMetrics.honorariosRetentions, settings.currencySymbol, 0)})`,
      category: 'taxes_sii',
      outflowMethod: 'bank_transfer',
      grossAmount: taxMetrics.totalF29APagar,
      feeAmount: 0,
      netAmount: taxMetrics.totalF29APagar,
    };

    onAddTransaction(newTx);
    setProvisionSuccessMsg(`¡Provisión tributaria de ${formatCurrency(taxMetrics.totalF29APagar, settings.currencySymbol, 0)} registrada exitosamente en el Libro Diario!`);
    setTimeout(() => {
      setProvisionSuccessMsg(null);
    }, 6000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F172A] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#6CF8BB]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Liquidación y Cumplimiento Tributario F29</span>
                <span className="text-[10px] uppercase tracking-wider bg-[#334155] text-[#94A3B8] px-2 py-0.5 rounded font-mono">
                  SII CHILE
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Borrador mensual para cálculo de IVA Débito, IVA Crédito, PPM y Retenciones
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1.5 rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {provisionSuccessMsg && (
          <div className="mx-6 mt-4 p-3 bg-[#DCFCE7] border border-[#86EFAC] text-[#006C49] rounded-lg text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{provisionSuccessMsg}</span>
            </div>
            <button onClick={() => setProvisionSuccessMsg(null)} className="text-[#006C49] font-bold">✕</button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Controls Bar: Period selector + PPM Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] border border-[#CBD5E1] p-4 rounded-lg">
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Mes Tributario a Liquidar:</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-md text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Tasa PPM ProPyme:</span>
                </span>
                <span className="text-[11px] text-[#64748B] font-mono font-bold">{ppmRate}% s/Venta Neta</span>
              </label>
              <div className="flex items-center gap-2">
                {[
                  { r: 0.25, label: '0.25%' },
                  { r: 0.5, label: '0.5%' },
                  { r: 1.0, label: '1.0% (Pyme)' },
                  { r: 1.5, label: '1.5%' },
                ].map((item) => (
                  <button
                    key={item.r}
                    type="button"
                    onClick={() => setPpmRate(item.r)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded border transition-all cursor-pointer ${
                      ppmRate === item.r
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Formulario 29 Line Item Breakdown */}
          <div className="border border-[#CBD5E1] rounded-lg overflow-hidden">
            <div className="bg-[#F1F5F9] px-4 py-2.5 border-b border-[#CBD5E1] flex justify-between items-center text-xs font-bold text-[#475569]">
              <span>LÍNEA TRIBUTARIA FORMULARIO 29</span>
              <span>CÁLCULO MONTO</span>
            </div>

            <div className="divide-y divide-[#E2E8F0] text-xs">
              
              {/* 1. IVA Débito (Ventas) */}
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-[#F8FAFC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#DCFCE7] text-[#006C49] px-1.5 py-0.5 rounded border border-[#86EFAC]">
                      Cód. [538/110]
                    </span>
                    <span className="font-bold text-[#0F172A]">1. Débito Fiscal (IVA 19% en Ventas)</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {taxMetrics.salesCount} ventas registradas • Base Neta Afecta: <strong className="text-[#0F172A]">{formatCurrency(taxMetrics.salesNetAfectas, settings.currencySymbol, 0)}</strong>
                    {taxMetrics.salesNetExentas > 0 && (
                      <span className="ml-1.5">
                        • Ventas Exentas (Cód. [142]): <strong className="text-[#0F172A]">{formatCurrency(taxMetrics.salesNetExentas, settings.currencySymbol, 0)}</strong>
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <span className="text-sm font-bold text-[#0F172A]">
                    +{formatCurrency(taxMetrics.salesIvaDebito, settings.currencySymbol, 0)}
                  </span>
                </div>
              </div>

              {/* 2. IVA Crédito (Compras) */}
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-[#F8FAFC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#EFF6FF] text-[#1E40AF] px-1.5 py-0.5 rounded border border-[#BFDBFE]">
                      Cód. [520]
                    </span>
                    <span className="font-bold text-[#0F172A]">2. Crédito Fiscal (IVA 19% en Compras con Factura)</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {taxMetrics.purchasesCount} facturas de compra • Costo Neto: <strong className="text-[#0F172A]">{formatCurrency(taxMetrics.purchasesNet, settings.currencySymbol, 0)}</strong>
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <span className="text-sm font-bold text-[#006C49]">
                    -{formatCurrency(taxMetrics.purchasesIvaCredito, settings.currencySymbol, 0)}
                  </span>
                </div>
              </div>

              {/* 3. Subtotal IVA Determinado */}
              <div className="p-4 bg-[#F8FAFC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded border border-[#CBD5E1]">
                      {taxMetrics.ivaNetoAPagar > 0 ? 'Cód. [89]' : 'Cód. [77]'}
                    </span>
                    <span className="font-bold text-[#0F172A]">
                      3. {taxMetrics.ivaNetoAPagar > 0 ? 'IVA Neto a Pagar' : 'Remanente de Crédito Fiscal a Favor'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {taxMetrics.ivaNetoAPagar > 0 
                      ? 'Diferencia de Débito sobre Crédito a pagar al Fisco' 
                      : 'Saldo a favor para descontar de las ventas del mes siguiente'}
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <span className={`text-base font-bold ${taxMetrics.ivaNetoAPagar > 0 ? 'text-[#DC2626]' : 'text-[#006C49]'}`}>
                    {taxMetrics.ivaNetoAPagar > 0 
                      ? formatCurrency(taxMetrics.ivaNetoAPagar, settings.currencySymbol, 0)
                      : `+${formatCurrency(taxMetrics.remanenteMes, settings.currencySymbol, 0)} (Remanente)`}
                  </span>
                </div>
              </div>

              {/* 4. PPM (Pago Provisional Mensual) */}
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-[#F8FAFC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                      Cód. [152]
                    </span>
                    <span className="font-bold text-[#0F172A]">4. PPM Pro-Pyme ({ppmRate}% sobre Venta Neta)</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Base Neta Imponible: <strong className="text-[#0F172A]">{formatCurrency(taxMetrics.salesNet, settings.currencySymbol, 0)}</strong> • Ahorro mensual para el Impuesto a la Renta
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <span className="text-sm font-bold text-[#0F172A]">
                    +{formatCurrency(taxMetrics.ppmAmount, settings.currencySymbol, 0)}
                  </span>
                </div>
              </div>

              {/* 5. Retenciones Honorarios 2a Categoria */}
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-[#F8FAFC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-[#F3E8FF] text-[#6B21A8] px-1.5 py-0.5 rounded border border-[#E9D5FF]">
                      Cód. [151]
                    </span>
                    <span className="font-bold text-[#0F172A]">5. Retención Honorarios (15.25% Segunda Categoría)</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {taxMetrics.honorariosCount} boletas de honorarios retenidas a profesionales independientes (Tasa legal vigente Ley 21.133)
                  </p>
                </div>
                <div className="text-right font-mono-num">
                  <span className="text-sm font-bold text-[#0F172A]">
                    +{formatCurrency(taxMetrics.honorariosRetentions, settings.currencySymbol, 0)}
                  </span>
                </div>
              </div>

            </div>

            {/* Total Liquidación Box */}
            <div className="bg-[#0F172A] text-white p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-[#334155] text-[#6CF8BB] px-2 py-0.5 rounded">
                    Cód. [91]
                  </span>
                  <span className="text-base font-bold tracking-tight">TOTAL A PAGAR FORMULARIO 29</span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Vencimiento: <strong>Día 20 del mes siguiente</strong> (Vía online en sii.cl con Pago Automático o Cupón)
                </p>
              </div>

              <div className="text-right font-mono-num w-full sm:w-auto">
                <span className="text-2xl font-bold text-[#6CF8BB]">
                  {formatCurrency(taxMetrics.totalF29APagar, settings.currencySymbol, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Legal Note */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#64748B] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#64748B] flex-shrink-0 mt-0.5" />
            <p>
              Este borrador consolida tus boletas y facturas emitidas y recibidas. Recuerda contrastarlo con el <strong>Registro de Compras y Ventas (RCV)</strong> de la oficina virtual del SII antes del día 20 para validar documentos no recibidos o notas de crédito.
            </p>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#CBD5E1] flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleExportF29Csv}
            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#006C49]" />
            <span>Descargar Borrador F29 (CSV)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onAddTransaction && taxMetrics.totalF29APagar > 0 && (
              <button
                type="button"
                onClick={handleProvisionTaxToLedger}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#006C49] hover:bg-[#005237] text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                title="Crea una transacción de provisión de impuestos para apartar este dinero en el libro diario"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Provisionar en Libro Diario</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
