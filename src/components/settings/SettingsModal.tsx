import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  RotateCcw, 
  Trash2, 
  Save, 
  DollarSign, 
  Percent, 
  Building, 
  Download, 
  Upload,
  AlertTriangle,
  CheckCircle2,
  Users,
  Plus
} from 'lucide-react';
import { AppSettings, Partner } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllData: (customBalances?: { bank?: number; cashDrawer?: number; businessName?: string }) => void;
  onResetDemoData?: () => void;
}

interface FormState {
  businessName: string;
  currency: string;
  currencySymbol: string;
  startingBankBalance: string;
  startingCashDrawer: string;
  targetOperatingMarginPct: string;
  feeConfig: {
    debitRate: string;
    prepaidRate: string;
    creditRate: string;
    deliveryAppRate: string;
  };
  pocketConfig: {
    profit: string;
    taxes: string;
    ownerPay: string;
    opEx: string;
  };
  partners: Partner[];
}

const mapSettingsToForm = (s: AppSettings): FormState => ({
  businessName: s.businessName || '',
  currency: s.currency || 'USD',
  currencySymbol: s.currencySymbol || '$',
  startingBankBalance: s.startingBankBalance === 0 ? '' : String(s.startingBankBalance),
  startingCashDrawer: s.startingCashDrawer === 0 ? '' : String(s.startingCashDrawer),
  targetOperatingMarginPct: s.targetOperatingMarginPct !== undefined ? String(s.targetOperatingMarginPct) : '25',
  feeConfig: {
    debitRate: String(s.feeConfig.debitRate ?? 1.5),
    prepaidRate: String(s.feeConfig.prepaidRate ?? 1.2),
    creditRate: String(s.feeConfig.creditRate ?? 2.8),
    deliveryAppRate: String(s.feeConfig.deliveryAppRate ?? 22.0),
  },
  pocketConfig: {
    profit: String(s.pocketConfig.profit ?? 10),
    taxes: String(s.pocketConfig.taxes ?? 15),
    ownerPay: String(s.pocketConfig.ownerPay ?? 35),
    opEx: String(s.pocketConfig.opEx ?? 40),
  },
  partners: s.partners && s.partners.length > 0 ? s.partners : [
    { id: 'partner-1', name: 'Socio Principal / Fundador', equityPct: 60, role: 'Socio Operador' },
    { id: 'partner-2', name: 'Socio Co-Fundador', equityPct: 40, role: 'Socio Capitalista' }
  ],
});

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearAllData,
  onResetDemoData,
}) => {
  const [formData, setFormData] = useState<FormState>(() => mapSettingsToForm(settings));
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'demo' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearBankBalance, setClearBankBalance] = useState<string>('0');
  const [clearCashBalance, setClearCashBalance] = useState<string>('0');

  useEffect(() => {
    if (isOpen) {
      setFormData(mapSettingsToForm(settings));
      setConfirmAction(null);
      setImportError(null);
      setClearBankBalance('0');
      setClearCashBalance('0');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSettings: AppSettings = {
      businessName: formData.businessName.trim() || 'Mi Empresa',
      currency: formData.currency,
      currencySymbol: formData.currencySymbol.trim() || '$',
      startingBankBalance: parseFloat(formData.startingBankBalance) || 0,
      startingCashDrawer: parseFloat(formData.startingCashDrawer) || 0,
      targetOperatingMarginPct: formData.targetOperatingMarginPct.trim() !== '' && !isNaN(parseFloat(formData.targetOperatingMarginPct))
        ? parseFloat(formData.targetOperatingMarginPct)
        : undefined,
      feeConfig: {
        debitRate: parseFloat(formData.feeConfig.debitRate) || 0,
        prepaidRate: parseFloat(formData.feeConfig.prepaidRate) || 0,
        creditRate: parseFloat(formData.feeConfig.creditRate) || 0,
        deliveryAppRate: parseFloat(formData.feeConfig.deliveryAppRate) || 0,
        stripeFixedFee: settings.feeConfig.stripeFixedFee ?? 0.30,
      },
      pocketConfig: {
        profit: parseFloat(formData.pocketConfig.profit) || 0,
        taxes: parseFloat(formData.pocketConfig.taxes) || 0,
        ownerPay: parseFloat(formData.pocketConfig.ownerPay) || 0,
        opEx: parseFloat(formData.pocketConfig.opEx) || 0,
        reserveMonthsTarget: settings.pocketConfig.reserveMonthsTarget ?? 3,
      },
      partners: formData.partners,
    };
    // Force write to localStorage to avoid React state-render race conditions with pure utility functions
    localStorage.setItem('cashflow_settings_v1', JSON.stringify(parsedSettings));
    onSaveSettings(parsedSettings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleExportAll = () => {
    const backupData = {
      settings: localStorage.getItem('cashflow_settings_v1'),
      transactions: localStorage.getItem('cashflow_transactions_v1'),
      payables: localStorage.getItem('cashflow_payables_v1'),
      receivables: localStorage.getItem('cashflow_receivables_v1'),
      closures: localStorage.getItem('cashflow_closures_v1'),
      scenario: localStorage.getItem('cashflow_scenario_v1'),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CashFlow_Pro_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.settings) localStorage.setItem('cashflow_settings_v1', json.settings);
        if (json.transactions) localStorage.setItem('cashflow_transactions_v1', json.transactions);
        if (json.payables) localStorage.setItem('cashflow_payables_v1', json.payables);
        if (json.receivables) localStorage.setItem('cashflow_receivables_v1', json.receivables);
        if (json.closures) localStorage.setItem('cashflow_closures_v1', json.closures);
        if (json.scenario) localStorage.setItem('cashflow_scenario_v1', json.scenario);
        try {
          window.location.reload();
        } catch {
          // fallback if in strict iframe
          onClose();
        }
      } catch (err) {
        setImportError('El archivo seleccionado no contiene un formato de respaldo JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteClearAll = () => {
    const bank = parseFloat(clearBankBalance) || 0;
    const cash = parseFloat(clearCashBalance) || 0;
    onClearAllData({ bank, cashDrawer: cash });
    setFormData(prev => ({
      ...prev,
      startingBankBalance: String(bank),
      startingCashDrawer: String(cash),
    }));
    setConfirmAction(null);
    onClose();
  };

  const handleExecuteResetDemo = () => {
    if (onResetDemoData) {
      onResetDemoData();
      setConfirmAction(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl border border-[#CBD5E1] max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#94A3B8] hover:text-[#0F172A] p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-[#0F172A]" />
          <h3 className="text-base font-bold text-[#0F172A]">
            Configuración del Sistema
          </h3>
        </div>
        <p className="text-xs text-[#64748B] mb-5">
          Ajusta tasas de comisión, porcentajes de los 4 bolsillos, monedas y saldos iniciales
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          
          {/* General & Currency */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
              Datos Generales y Moneda
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Nombre de la Empresa</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Símbolo de Moneda</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.currencySymbol}
                    onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                    placeholder="$"
                    className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A]"
                  />
                  <select
                    value={formData.currency}
                    onChange={(e) => {
                      const curr = e.target.value;
                      let sym = '$';
                      if (curr === 'EUR') sym = '€';
                      if (curr === 'PEN') sym = 'S/.';
                      if (curr === 'GBP') sym = '£';
                      setFormData({ ...formData, currency: curr, currencySymbol: sym });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CLP">CLP ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="MXN">MXN ($)</option>
                    <option value="COP">COP ($)</option>
                    <option value="ARS">ARS ($)</option>
                    <option value="PEN">PEN (S/.)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Saldo Inicial Banco</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.startingBankBalance}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({ ...formData, startingBankBalance: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A] tnum focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Fondo Fijo Inicial Caja (Arqueo)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formData.startingCashDrawer}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({ ...formData, startingCashDrawer: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A] tnum focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
            </div>

            {/* Target Operating Margin % */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <label className="block font-semibold text-[#475569] mb-1 flex items-center justify-between">
                <span>Meta de Margen Operativo (%)</span>
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="25.0"
                value={formData.targetOperatingMarginPct}
                onChange={(e) => setFormData({ ...formData, targetOperatingMarginPct: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded text-[#0F172A] tnum focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
              />
              <p className="text-[10px] text-[#64748B] mt-0.5">
                Meta de rentabilidad operativa esperada para comparar en el Panel Principal (por defecto 25%).
              </p>
            </div>
          </div>

          {/* Automatic Payment Channel Fees */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
              Comisiones Automáticas por Canal de Cobro
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Tarjeta Débito (%)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.feeConfig.debitRate}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    feeConfig: { ...formData.feeConfig, debitRate: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Tarjeta Prepago (%)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.feeConfig.prepaidRate}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    feeConfig: { ...formData.feeConfig, prepaidRate: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Tarjeta Crédito (%)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.feeConfig.creditRate}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    feeConfig: { ...formData.feeConfig, creditRate: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Apps Delivery (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={formData.feeConfig.deliveryAppRate}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    feeConfig: { ...formData.feeConfig, deliveryAppRate: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4 Bolsillos (Profit First) Config */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
              Sistema de Distribución ("4 Bolsillos / Profit First")
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Ganancia / Fondo (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.pocketConfig.profit}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    pocketConfig: { ...formData.pocketConfig, profit: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Provisión Impuestos (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.pocketConfig.taxes}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    pocketConfig: { ...formData.pocketConfig, taxes: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Sueldo del Dueño (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.pocketConfig.ownerPay}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    pocketConfig: { ...formData.pocketConfig, ownerPay: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#475569] mb-1 font-semibold">Costos Operativos (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.pocketConfig.opEx}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({
                    ...formData,
                    pocketConfig: { ...formData.pocketConfig, opEx: e.target.value }
                  })}
                  className="w-full px-2 py-1.5 bg-white border border-[#CBD5E1] rounded text-right font-mono-num focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Total suma porcentajes: {(parseFloat(formData.pocketConfig.profit) || 0) + (parseFloat(formData.pocketConfig.taxes) || 0) + (parseFloat(formData.pocketConfig.ownerPay) || 0) + (parseFloat(formData.pocketConfig.opEx) || 0)}% (Ideal = 100%)
            </p>
          </div>

          {/* Socios y Participación Accionaria (Equity Cap Table) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0F172A]" />
                  <span>Socios y Participación (% Equity)</span>
                </h4>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Define los socios que reciben utilidades según su porcentaje de participación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newPartner: Partner = {
                    id: `partner-${Date.now()}`,
                    name: `Socio ${formData.partners.length + 1}`,
                    equityPct: 0,
                    role: 'Socio'
                  };
                  setFormData({ ...formData, partners: [...formData.partners, newPartner] });
                }}
                className="px-2.5 py-1 bg-white hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[11px] font-semibold text-[#0F172A] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Añadir Socio</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {formData.partners.map((partner, index) => (
                <div key={partner.id} className="flex items-center gap-2 bg-white p-2.5 rounded border border-[#CBD5E1]">
                  <span className="w-5 h-5 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    placeholder="Nombre del Socio"
                    value={partner.name}
                    onChange={(e) => {
                      const updated = formData.partners.map(p => p.id === partner.id ? { ...p, name: e.target.value } : p);
                      setFormData({ ...formData, partners: updated });
                    }}
                    className="flex-1 px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs text-[#0F172A] focus:border-[#0F172A] outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Rol (ej. Operador)"
                    value={partner.role || ''}
                    onChange={(e) => {
                      const updated = formData.partners.map(p => p.id === partner.id ? { ...p, role: e.target.value } : p);
                      setFormData({ ...formData, partners: updated });
                    }}
                    className="w-32 px-2 py-1 bg-white border border-[#CBD5E1] rounded text-xs text-[#64748B] focus:border-[#0F172A] outline-none"
                  />
                  <div className="relative flex items-center w-20">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="%"
                      value={partner.equityPct}
                      onChange={(e) => {
                        const updated = formData.partners.map(p => p.id === partner.id ? { ...p, equityPct: parseFloat(e.target.value) || 0 } : p);
                        setFormData({ ...formData, partners: updated });
                      }}
                      className="w-full pr-4 pl-2 py-1 bg-white border border-[#CBD5E1] rounded text-right font-mono-num font-bold text-xs text-[#0F172A] focus:border-[#0F172A] outline-none"
                    />
                    <span className="absolute right-1 text-[10px] text-[#64748B] font-bold">%</span>
                  </div>
                  {formData.partners.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = formData.partners.filter(p => p.id !== partner.id);
                        setFormData({ ...formData, partners: updated });
                      }}
                      className="text-[#94A3B8] hover:text-[#DC2626] p-1 transition-colors cursor-pointer"
                      title="Eliminar socio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <span className="text-[#64748B]">Suma total de participación:</span>
              <span className={`font-bold font-mono-num ${
                formData.partners.reduce((sum, p) => sum + (p.equityPct || 0), 0) === 100 
                  ? 'text-[#006C49]' 
                  : 'text-[#DC2626]'
              }`}>
                {formData.partners.reduce((sum, p) => sum + (p.equityPct || 0), 0)}% (Ideal = 100%)
              </span>
            </div>
          </div>

          {/* Backup & Data Management */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3">
            <h4 className="font-bold text-[#0F172A] text-xs uppercase tracking-wider">
              Gestión de Datos
            </h4>

            {importError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md text-xs text-[#DC2626] flex items-center justify-between">
                <span>{importError}</span>
                <button 
                  type="button" 
                  onClick={() => setImportError(null)} 
                  className="font-bold text-[#DC2626] ml-2 text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Confirmation Box for Clear All Data */}
            {confirmAction === 'clear' && (
              <div className="p-4 bg-[#FFF1F2] border-2 border-[#F43F5E] rounded-lg space-y-4 animate-fade-in shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#FEE2E2] rounded-full shrink-0">
                    <AlertTriangle className="w-5 h-5 text-[#E11D48]" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-[#9F1239]">
                      ¿Vaciar todos los datos y empezar de cero en toda la app?
                    </h5>
                    <p className="text-xs text-[#BE123C] mt-1 leading-relaxed">
                      Esta acción eliminará de forma permanente <strong>todas las transacciones</strong> (ingresos, gastos, retiros), <strong>cuentas por pagar</strong>, <strong>cuentas por cobrar</strong> y <strong>arqueos de caja</strong>. Los reportes y el período se sincronizarán limpios a la fecha de hoy.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FECDD3]">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="px-3.5 py-1.5 bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded text-xs font-semibold text-[#475569] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteClearAll}
                    className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, vaciar todo y empezar desde 0</span>
                  </button>
                </div>
              </div>
            )}

            {confirmAction === null && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmAction('clear')}
                  className="px-4 py-2 bg-[#FEF2F2] border border-[#FCA5A5] hover:bg-[#FEE2E2] rounded text-xs font-semibold text-[#DC2626] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Vaciar todos los datos (Empezar de cero)</span>
                </button>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-md font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{savedSuccess ? '¡Guardado!' : 'Guardar Cambios'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
