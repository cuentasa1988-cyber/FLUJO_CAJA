import React from 'react';
import { 
  Calendar, 
  CalendarDays, 
  CalendarRange, 
  ChevronLeft, 
  ChevronRight, 
  History,
  Clock,
  ArrowRight
} from 'lucide-react';
import { DatePeriodFilter, PeriodMode } from '../../types';
import { 
  getPresetPeriod, 
  getTodayString, 
  getCurrentMonthString,
  formatMonthLabel 
} from '../../utils/dateFilter';

interface PeriodFilterBarProps {
  filter: DatePeriodFilter;
  onChangeFilter: (newFilter: DatePeriodFilter) => void;
  className?: string;
  showAllOption?: boolean;
}

export const PeriodFilterBar: React.FC<PeriodFilterBarProps> = ({
  filter,
  onChangeFilter,
  className = '',
  showAllOption = true,
}) => {
  const todayStr = getTodayString();
  const currentMonthStr = getCurrentMonthString();

  // Mode switcher
  const handleSetMode = (mode: PeriodMode) => {
    onChangeFilter({
      ...filter,
      mode,
    });
  };

  // Preset click
  const handleApplyPreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all') => {
    onChangeFilter(getPresetPeriod(preset));
  };

  // Day navigation (+1 day, -1 day)
  const handleShiftDay = (delta: number) => {
    const d = new Date(filter.selectedDate || todayStr);
    d.setDate(d.getDate() + delta);
    const newDateStr = d.toISOString().split('T')[0];
    onChangeFilter({
      ...filter,
      mode: 'day',
      selectedDate: newDateStr,
      startDate: newDateStr,
      endDate: newDateStr,
    });
  };

  // Month navigation (+1 month, -1 month)
  const handleShiftMonth = (delta: number) => {
    const cur = filter.selectedMonth || currentMonthStr;
    const [yStr, mStr] = cur.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    const newMonthStr = `${y}-${String(m).padStart(2, '0')}`;
    onChangeFilter({
      ...filter,
      mode: 'month',
      selectedMonth: newMonthStr,
      startMonth: newMonthStr,
      endMonth: newMonthStr,
    });
  };

  const isToday = filter.mode === 'day' && filter.selectedDate === todayStr;
  const isThisMonth = filter.mode === 'month' && filter.selectedMonth === currentMonthStr;

  // Week boundary check
  const currentWeekPreset = React.useMemo(() => getPresetPeriod('this_week'), []);
  const isThisWeek = filter.mode === 'day_range' && 
    filter.startDate === currentWeekPreset.startDate && 
    filter.endDate === currentWeekPreset.endDate;

  // Format a friendly text next to date picker
  const getFriendlyDayText = (dateStr: string) => {
    if (dateStr === todayStr) return 'Hoy';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const dayNum = parseInt(parts[2], 10);
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthNum = parseInt(parts[1], 10) - 1;
      return `${dayNum} ${months[monthNum] || ''}`;
    }
    return '';
  };

  return (
    <div id="period-filter-bar" className={`bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-xs space-y-2.5 ${className}`}>
      {/* Upper Row: Mode Tabs & Quick Presets */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2.5">
        {/* Simplified Mode Selector */}
        <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-md">
          <button
            id="filter-mode-day"
            type="button"
            onClick={() => handleSetMode('day')}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              filter.mode === 'day'
                ? 'bg-white text-[#0F172A] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#006C49]" />
            <span>Día</span>
          </button>

          <button
            id="filter-mode-month"
            type="button"
            onClick={() => handleSetMode('month')}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              filter.mode === 'month'
                ? 'bg-white text-[#0F172A] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Mes</span>
          </button>

          <button
            id="filter-mode-range"
            type="button"
            onClick={() => handleSetMode(filter.mode === 'month_range' ? 'month_range' : 'day_range')}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              filter.mode === 'day_range' || filter.mode === 'month_range'
                ? 'bg-white text-[#0F172A] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Rango</span>
          </button>

          {showAllOption && (
            <button
              id="filter-mode-all"
              type="button"
              onClick={() => handleSetMode('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                filter.mode === 'all'
                  ? 'bg-white text-[#0F172A] shadow-xs border border-[#CBD5E1]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Todo</span>
            </button>
          )}
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#64748B] mr-1 hidden sm:inline">
            Atajos:
          </span>

          <button
            id="preset-today"
            type="button"
            onClick={() => handleApplyPreset('today')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
              isToday
                ? 'bg-[#006C49] border-[#006C49] text-white shadow-xs'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white hover:text-[#0F172A]'
            }`}
          >
            Hoy
          </button>

          <button
            id="preset-this-week"
            type="button"
            onClick={() => handleApplyPreset('this_week')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
              isThisWeek
                ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xs'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white hover:text-[#0F172A]'
            }`}
          >
            Esta Semana
          </button>

          <button
            id="preset-this-month"
            type="button"
            onClick={() => handleApplyPreset('this_month')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
              isThisMonth
                ? 'bg-[#0F172A] border-[#0F172A] text-white shadow-xs'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white hover:text-[#0F172A]'
            }`}
          >
            Este Mes
          </button>

          <button
            id="preset-last-month"
            type="button"
            onClick={() => handleApplyPreset('last_month')}
            className="px-2.5 py-1 text-xs font-semibold rounded-md border bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white hover:text-[#0F172A] transition-all cursor-pointer"
          >
            Mes Anterior
          </button>

          <button
            id="preset-this-year"
            type="button"
            onClick={() => handleApplyPreset('this_year')}
            className="px-2.5 py-1 text-xs font-semibold rounded-md border bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white hover:text-[#0F172A] transition-all cursor-pointer hidden md:inline-block"
          >
            Año Actual
          </button>
        </div>
      </div>

      {/* Lower Row: Specific Interactive Date Controls (Clean, minimal, no duplicate labels) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F5F9]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Day Mode Picker */}
          {filter.mode === 'day' && (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-prev-day"
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="p-1.5 bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[#475569] transition-colors cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-md px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-[#006C49]" />
                <input
                  id="input-selected-date"
                  type="date"
                  value={filter.selectedDate}
                  onChange={(e) => onChangeFilter({
                    ...filter,
                    selectedDate: e.target.value,
                    startDate: e.target.value,
                    endDate: e.target.value,
                  })}
                  className="text-xs font-bold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <button
                id="btn-next-day"
                type="button"
                onClick={() => handleShiftDay(1)}
                className="p-1.5 bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[#475569] transition-colors cursor-pointer"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Month Mode Picker */}
          {filter.mode === 'month' && (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-prev-month"
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="p-1.5 bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[#475569] transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-md px-2.5 py-1">
                <CalendarDays className="w-3.5 h-3.5 text-[#D97706]" />
                <input
                  id="input-selected-month"
                  type="month"
                  value={filter.selectedMonth}
                  onChange={(e) => onChangeFilter({
                    ...filter,
                    selectedMonth: e.target.value,
                    startMonth: e.target.value,
                    endMonth: e.target.value,
                  })}
                  className="text-xs font-bold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <button
                id="btn-next-month"
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="p-1.5 bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] rounded text-[#475569] transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Range Mode Picker */}
          {(filter.mode === 'day_range' || filter.mode === 'month_range') && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-0.5 rounded text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => onChangeFilter({ ...filter, mode: 'day_range' })}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    filter.mode === 'day_range' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
                  }`}
                >
                  Por Días
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFilter({ ...filter, mode: 'month_range' })}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    filter.mode === 'month_range' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B]'
                  }`}
                >
                  Por Meses
                </button>
              </div>

              {filter.mode === 'day_range' ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-md px-2 py-1">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">Desde</span>
                    <input
                      type="date"
                      value={filter.startDate}
                      onChange={(e) => onChangeFilter({ ...filter, startDate: e.target.value })}
                      className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-md px-2 py-1">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">Hasta</span>
                    <input
                      type="date"
                      value={filter.endDate}
                      onChange={(e) => onChangeFilter({ ...filter, endDate: e.target.value })}
                      className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-md px-2 py-1">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">Desde</span>
                    <input
                      type="month"
                      value={filter.startMonth}
                      onChange={(e) => onChangeFilter({ ...filter, startMonth: e.target.value })}
                      className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-md px-2 py-1">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">Hasta</span>
                    <input
                      type="month"
                      value={filter.endMonth}
                      onChange={(e) => onChangeFilter({ ...filter, endMonth: e.target.value })}
                      className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All History Mode */}
          {filter.mode === 'all' && (
            <div className="text-xs text-[#475569] font-medium flex items-center gap-1.5 py-1">
              <History className="w-3.5 h-3.5 text-[#006C49]" />
              <span>Mostrando todos los registros sin filtro de fecha</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
