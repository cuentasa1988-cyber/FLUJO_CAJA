import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  Coins, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Trash2,
  PieChart as PieIcon,
  Percent,
  Calculator,
  Lock,
  Sparkles
} from 'lucide-react';
import { 
  AppSettings, 
  Transaction, 
  Partner, 
  DatePeriodFilter 
} from '../../types';
import { 
  formatCurrency, 
  calculatePocketsActualVsTarget 
} from '../../utils/financial';
import { 
  getDefaultPeriodFilter, 
  isDateInPeriod, 
  getPeriodLabel 
} from '../../utils/dateFilter';

interface ProfitDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  transactions: Transaction[];
  onAddTransaction: (tx: Transaction) => void;
  onUpdatePartners?: (partners: Partner[]) => void;
  defaultPeriodFilter?: DatePeriodFilter;
}

export const ProfitDistributionModal: React.FC<ProfitDistributionModalProps> = ({
  isOpen,
  onClose,
  settings,
  transactions,
  onAddTransaction,
  onUpdatePartners,
  defaultPeriodFilter
}) => {
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>(() => defaultPeriodFilter || getDefaultPeriodFilter());
  const [distributionMode, setDistributionMode] = useState<'quarterly_profit' | 'owner_salary' | 'custom'>('quarterly_profit');
  
  // Base Pool to distribute (customizable or loaded from period net profit)
  const [distributionAmountStr, setDistributionAmountStr] = useState<string>('');
  const [retainReservePct, setRetainReservePct] = useState<number>(50); // Standard Profit First: 50% stays in Emergency Vault, 50% distributes to partners
  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Partners state (from settings or fallback)
  const [partners, setPartners] = useState<Partner[]>(() => {
    if (settings.partners && settings.partners.length > 0) {
      return settings.partners;
    }
    return [
      { id: 'p-1', name: 'Socio Principal / Fundador', equityPct: 60, role: 'Socio Operador' },
      { id: 'p-2', name: 'Socio Co-Fundador', equityPct: 40, role: 'Socio Capitalista' }
    ];
  });

  // Calculate actual pocket data for the period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => isDateInPeriod(t.date, periodFilter));
  }, [transactions, periodFilter]);

  const pockets = useMemo(() => {
    return calculatePocketsActualVsTarget(periodTransactions, settings.pocketConfig);
  }, [periodTransactions, settings.pocketConfig]);

  // Total net profit in pocket or calculated
  const availableProfitPool = pockets.actual.profit > 0 
    ? pockets.actual.profit 
    : pockets.theoretical.profit;
    
  const availableOwnerPool = pockets.actual.owner > 0
    ? pockets.actual.owner
    : pockets.theoretical.owner;

  const currentModePool = distributionMode === 'quarterly_profit' ? availableProfitPool : availableOwnerPool;

  // Initialize distribution amount with the available theoretical/actual profit when opened
  React.useEffect(() => {
    if (isOpen) {
      if (distributionMode === 'quarterly_profit') {
        const defaultPool = availableProfitPool > 0 ? availableProfitPool : 1000000;
        setDistributionAmountStr(defaultPool.toFixed(0));
      } else if (distributionMode === 'owner_salary') {
        const defaultOwner = availableOwnerPool > 0 ? availableOwnerPool : 800000;
        setDistributionAmountStr(defaultOwner.toFixed(0));
      }
      setSuccessMsg(null);
    }
  }, [isOpen, distributionMode, availableProfitPool, availableOwnerPool]);

  if (!isOpen) return null;

  const totalPool = parseFloat(distributionAmountStr) || 0;
  
  // Under Profit First: 
  // For quarterly profit distribution: retainReservePct (e.g. 50%) goes to permanent emergency reserve, remainder goes to partners.
  const reserveRetainedAmount = distributionMode === 'quarterly_profit' 
    ? Math.round((totalPool * retainReservePct) / 100) 
    : 0;
    
  const netDistributableToPartners = totalPool - reserveRetainedAmount;

  // Total partner equity check
  const totalEquity = partners.reduce((sum, p) => sum + (p.equityPct || 0), 0);

  // Partner distribution breakdown
  const partnerPayouts = partners.map(p => {
    const share = (p.equityPct / (totalEquity || 100));
    const payoutAmount = Math.round(netDistributableToPartners * share);
    return {
      ...p,
      sharePct: p.equityPct,
      payoutAmount
    };
  });

  // Handle partner updates
  const handlePartnerEquityChange = (id: string, newPct: number) => {
    const updated = partners.map(p => p.id === id ? { ...p, equityPct: newPct } : p);
    setPartners(updated);
    if (onUpdatePartners) {
      onUpdatePartners(updated);
    }
  };

  const handleAddPartner = () => {
    const newPartner: Partner = {
      id: `p-${Date.now()}`,
      name: `Socio ${partners.length + 1}`,
      equityPct: 0,
      role: 'Socio'
    };
    const updated = [...partners, newPartner];
    setPartners(updated);
    if (onUpdatePartners) {
      onUpdatePartners(updated);
    }
  };

  const handleRemovePartner = (id: string) => {
    if (partners.length <= 1) return;
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    if (onUpdatePartners) {
      onUpdatePartners(updated);
    }
  };

  // Register payout in ledger
  const handleExecutePayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPool <= 0) return;

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (distributionMode === 'quarterly_profit') {
      // 1. If reserve retained > 0, register as profit vault
      if (reserveRetainedAmount > 0) {
        onAddTransaction({
          id: `tx-prof-res-${Date.now()}`,
          type: 'expense',
          date: today,
          time: nowTime,
          concept: `Fondo de Emergencia (Retención ${retainReservePct}% Profit First - ${getPeriodLabel(periodFilter)})`,
          category: 'profit_distribution',
          outflowMethod: 'bank_transfer',
          grossAmount: reserveRetainedAmount,
          feeAmount: 0,
          netAmount: reserveRetainedAmount,
          notes: `Retención para fondo de reserva y solvencia empresarial`
        });
      }

      // 2. Register payout for each partner
      partnerPayouts.forEach((p, idx) => {
        if (p.payoutAmount > 0) {
          onAddTransaction({
            id: `tx-partner-payout-${Date.now()}-${idx}`,
            type: 'partner_withdrawal',
            date: today,
            time: nowTime,
            concept: `Retiro de Utilidades Socios: ${p.name} (${p.equityPct}%)`,
            category: 'profit_distribution',
            outflowMethod: 'bank_transfer',
            grossAmount: p.payoutAmount,
            feeAmount: 0,
            netAmount: p.payoutAmount,
            notes: `Liquidación de dividendos/utilidades trimestrales (${getPeriodLabel(periodFilter)})`
          });
        }
      });

      setSuccessMsg(`¡Liquidación de utilidades procesada con éxito! Se registraron los retiros de los socios y la retención del fondo.`);
    } else {
      // Owner salary / standard draw
      partnerPayouts.forEach((p, idx) => {
        if (p.payoutAmount > 0) {
          onAddTransaction({
            id: `tx-owner-draw-${Date.now()}-${idx}`,
            type: 'expense',
            date: today,
            time: nowTime,
            concept: `Sueldo/Retiro del Dueño: ${p.name}`,
            category: 'owner_draw',
            outflowMethod: 'bank_transfer',
            grossAmount: p.payoutAmount,
            feeAmount: 0,
            netAmount: p.payoutAmount,
            notes: notes || `Compensación mensual según Profit First`
          });
        }
      });
      setSuccessMsg(`¡Sueldos y retiros operativos registrados en el Libro Diario!`);
    }

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Export CSV summary of distribution
  const handleExportCSV = () => {
    const rows = [
      ['--- ACTA DE DISTRIBUCIÓN DE UTILIDADES Y RETIROS (PROFIT FIRST) ---'],
      ['Fecha de Emisión', new Date().toLocaleDateString('es-CL')],
      ['Período Evaluado', getPeriodLabel(periodFilter)],
      ['Modo de Liquidación', distributionMode === 'quarterly_profit' ? 'Distribución Trimestral de Utilidades' : 'Sueldo/Compensación de Socios'],
      ['Pozo Total a Distribuir', totalPool.toFixed(0)],
      ['Retención Fondo de Emergencia (' + retainReservePct + '%)', reserveRetainedAmount.toFixed(0)],
      ['Monto Líquido para Socios', netDistributableToPartners.toFixed(0)],
      [],
      ['Socio / Beneficiario', 'Rol', 'Participación (%)', 'Monto a Transferir ($)'],
      ...partnerPayouts.map(p => [
        p.name,
        p.role || 'Socio',
        `${p.equityPct}%`,
        p.payoutAmount.toFixed(0)
      ]),
      [],
      ['Firmado digitalmente por Administración y Socios']
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Distribucion_Utilidades_Socios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-[#CBD5E1] max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#006C49] text-white flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                  Distribución de Utilidades y Retiros de Socios
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#006C49] border border-[#86EFAC]">
                  Profit First
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Cálculo de dividendos trimestrales, reserva de emergencia y retiros por % accionario
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-md hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDistributionMode('quarterly_profit')}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3 ${
                distributionMode === 'quarterly_profit'
                  ? 'border-[#006C49] bg-[#F0FDF4] ring-1 ring-[#006C49]'
                  : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
              }`}
            >
              <TrendingUp className={`w-5 h-5 mt-0.5 shrink-0 ${distributionMode === 'quarterly_profit' ? 'text-[#006C49]' : 'text-[#64748B]'}`} />
              <div>
                <span className="font-bold text-[#0F172A] block text-xs">Distribución Trimestral de Ganancias</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Regla Profit First: 50% retención para fondo de emergencia y 50% dividendos a socios.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDistributionMode('owner_salary')}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3 ${
                distributionMode === 'owner_salary'
                  ? 'border-[#3B82F6] bg-[#EFF6FF] ring-1 ring-[#3B82F6]'
                  : 'border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]'
              }`}
            >
              <Users className={`w-5 h-5 mt-0.5 shrink-0 ${distributionMode === 'owner_salary' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} />
              <div>
                <span className="font-bold text-[#0F172A] block text-xs">Sueldo / Retiro Operativo del Dueño</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Compensación mensual directa del bolsillo "Sueldo Dueño" ({settings.pocketConfig.ownerPay}% meta).
                </p>
              </div>
            </button>
          </div>

          {/* Amount & Reserve Split Bar */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <label className="block font-bold text-[#0F172A] text-xs uppercase tracking-wider mb-1">
                  Pozo Disponible para Reparto ({getPeriodLabel(periodFilter)})
                </label>
                <p className="text-[11px] text-[#64748B]">
                  Bolsillo acumulado en el período: <strong className="text-[#0F172A]">{formatCurrency(currentModePool, settings.currencySymbol, 0)}</strong>
                </p>
              </div>

              <div className="relative flex items-center w-full sm:w-60">
                <span className="absolute left-0 top-0 bottom-0 px-3 bg-[#E2E8F0] border-r border-[#CBD5E1] flex items-center text-xs text-[#0F172A] font-bold rounded-l-md">
                  {settings.currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={distributionAmountStr}
                  onChange={(e) => setDistributionAmountStr(e.target.value)}
                  placeholder="0"
                  className="w-full pl-10 pr-3 py-2 text-base font-bold text-right bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none font-mono-num"
                />
              </div>
            </div>

            {/* If Quarterly Profit: Show 50/50 Reserve Retain Slider */}
            {distributionMode === 'quarterly_profit' && (
              <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#006C49]" />
                    <span className="font-semibold text-[#0F172A]">Retención para Fondo de Emergencia:</span>
                    <span className="font-bold text-[#006C49] font-mono-num">{retainReservePct}%</span>
                  </div>
                  <div className="text-[#64748B] font-mono-num">
                    A Socios: <strong className="text-[#0F172A]">{100 - retainReservePct}%</strong> ({formatCurrency(netDistributableToPartners, settings.currencySymbol, 0)})
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={retainReservePct}
                  onChange={(e) => setRetainReservePct(parseInt(e.target.value))}
                  className="w-full h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#006C49]"
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 bg-white border border-[#CBD5E1] rounded-md flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">Queda en Bóveda Empresa</span>
                      <span className="text-sm font-bold text-[#006C49] font-mono-num">
                        {formatCurrency(reserveRetainedAmount, settings.currencySymbol, 0)}
                      </span>
                    </div>
                    <Lock className="w-4 h-4 text-[#006C49]" />
                  </div>

                  <div className="p-2.5 bg-white border border-[#CBD5E1] rounded-md flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748B] block">A Repartir a Socios</span>
                      <span className="text-sm font-bold text-[#0F172A] font-mono-num">
                        {formatCurrency(netDistributableToPartners, settings.currencySymbol, 0)}
                      </span>
                    </div>
                    <Users className="w-4 h-4 text-[#3B82F6]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Partner Cap Table & Payout Breakdown */}
          <div className="border border-[#CBD5E1] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="p-3.5 bg-[#F1F5F9] border-b border-[#CBD5E1] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-[#0F172A]" />
                <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
                  Tabla de Socios y Reparto por Participación
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  totalEquity === 100 
                    ? 'bg-[#DCFCE7] text-[#006C49]' 
                    : 'bg-[#FEF2F2] text-[#DC2626]'
                }`}>
                  Total Participación: {totalEquity}% {totalEquity !== 100 && '(Ajustar a 100%)'}
                </span>
                <button
                  type="button"
                  onClick={handleAddPartner}
                  className="px-2 py-1 bg-white hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[11px] font-semibold text-[#0F172A] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir Socio</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {partners.map((partner, index) => {
                const payout = partnerPayouts.find(p => p.id === partner.id);
                return (
                  <div key={partner.id} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-7 h-7 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {index + 1}
                      </div>
                      <div className="space-y-1 flex-1">
                        <input
                          type="text"
                          value={partner.name}
                          onChange={(e) => {
                            const updated = partners.map(p => p.id === partner.id ? { ...p, name: e.target.value } : p);
                            setPartners(updated);
                            if (onUpdatePartners) onUpdatePartners(updated);
                          }}
                          className="font-semibold text-[#0F172A] bg-transparent border-b border-transparent hover:border-[#CBD5E1] focus:border-[#0F172A] focus:bg-white px-1 py-0.5 rounded outline-none text-xs w-full max-w-xs"
                          placeholder="Nombre del Socio"
                        />
                        <input
                          type="text"
                          value={partner.role || ''}
                          onChange={(e) => {
                            const updated = partners.map(p => p.id === partner.id ? { ...p, role: e.target.value } : p);
                            setPartners(updated);
                            if (onUpdatePartners) onUpdatePartners(updated);
                          }}
                          className="text-[11px] text-[#64748B] bg-transparent border-b border-transparent hover:border-[#CBD5E1] focus:border-[#0F172A] focus:bg-white px-1 py-0.5 rounded outline-none block w-full max-w-xs"
                          placeholder="Rol (ej. Fundador, Operador)"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Equity % input */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-[#64748B] uppercase font-bold">Participación:</label>
                        <div className="relative flex items-center w-20">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={partner.equityPct}
                            onChange={(e) => handlePartnerEquityChange(partner.id, parseFloat(e.target.value) || 0)}
                            className="w-full pr-5 pl-2 py-1 bg-white border border-[#CBD5E1] rounded text-right font-mono-num font-bold text-xs text-[#0F172A] focus:border-[#0F172A] outline-none"
                          />
                          <span className="absolute right-1.5 text-[11px] text-[#64748B] font-bold">%</span>
                        </div>
                      </div>

                      {/* Calculated Payout */}
                      <div className="text-right min-w-[120px]">
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">A Transferir:</span>
                        <span className="text-sm font-bold text-[#006C49] font-mono-num">
                          {formatCurrency(payout?.payoutAmount || 0, settings.currencySymbol, 0)}
                        </span>
                      </div>

                      {partners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePartner(partner.id)}
                          className="text-[#94A3B8] hover:text-[#DC2626] p-1 transition-colors cursor-pointer"
                          title="Eliminar socio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legal / Sound Accounting Note */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[11px] text-[#64748B] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#006C49] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Principio Profit First:</strong> La distribución de utilidades premia el riesgo del inversionista. Al apartar el 50% en la reserva de solvencia antes de retirar, garantizas que la empresa nunca quede ilíquida tras el reparto de dividendos.
            </p>
          </div>

          {successMsg && (
            <div className="p-3 bg-[#DCFCE7] border border-[#86EFAC] text-[#006C49] rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#0F172A] rounded-md font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006C49]" />
            <span>Exportar Acta Liquidación (CSV)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] rounded-md font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleExecutePayout}
              disabled={totalPool <= 0 || totalEquity !== 100}
              className={`px-5 py-2 rounded-md font-bold text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                totalPool > 0 && totalEquity === 100
                  ? 'bg-[#006C49] hover:bg-[#005438]'
                  : 'bg-[#94A3B8] opacity-60 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar y Registrar Retiros en Libro Diario</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
