import { DatePeriodFilter, PeriodMode } from '../types';

export const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentMonthString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getDefaultPeriodFilter = (): DatePeriodFilter => {
  const today = getTodayString();
  const curMonth = getCurrentMonthString();
  
  // First day of current month
  const firstDayOfMonth = `${curMonth}-01`;
  
  return {
    mode: 'month',
    selectedDate: today,
    startDate: firstDayOfMonth,
    endDate: today,
    selectedMonth: curMonth,
    startMonth: curMonth,
    endMonth: curMonth,
  };
};

export const getPresetPeriod = (preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all'): DatePeriodFilter => {
  const now = new Date();
  const todayStr = getTodayString();
  const curYear = now.getFullYear();
  const curMonthNum = now.getMonth() + 1;
  const curMonthStr = `${curYear}-${String(curMonthNum).padStart(2, '0')}`;

  switch (preset) {
    case 'today':
      return {
        mode: 'day',
        selectedDate: todayStr,
        startDate: todayStr,
        endDate: todayStr,
        selectedMonth: curMonthStr,
        startMonth: curMonthStr,
        endMonth: curMonthStr,
      };

    case 'this_week': {
      // Calculate Monday of current week
      const d = new Date(now);
      const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
      
      // Calculate Sunday (end of week)
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const monStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const sunStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      
      return {
        mode: 'day_range',
        selectedDate: todayStr,
        startDate: monStr,
        endDate: sunStr,
        selectedMonth: curMonthStr,
        startMonth: curMonthStr,
        endMonth: curMonthStr,
      };
    }

    case 'this_month': {
      const firstDay = `${curMonthStr}-01`;
      const lastDay = new Date(curYear, curMonthNum, 0).getDate();
      const lastDayStr = `${curMonthStr}-${String(lastDay).padStart(2, '0')}`;
      
      return {
        mode: 'month',
        selectedDate: todayStr,
        startDate: firstDay,
        endDate: lastDayStr,
        selectedMonth: curMonthStr,
        startMonth: curMonthStr,
        endMonth: curMonthStr,
      };
    }

    case 'last_month': {
      let lastMonthYear = curYear;
      let lastMonthNum = curMonthNum - 1;
      if (lastMonthNum === 0) {
        lastMonthNum = 12;
        lastMonthYear -= 1;
      }
      const lastMonthStr = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}`;
      const lastDayOfPrevMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate();

      return {
        mode: 'month',
        selectedDate: `${lastMonthStr}-01`,
        startDate: `${lastMonthStr}-01`,
        endDate: `${lastMonthStr}-${String(lastDayOfPrevMonth).padStart(2, '0')}`,
        selectedMonth: lastMonthStr,
        startMonth: lastMonthStr,
        endMonth: lastMonthStr,
      };
    }

    case 'this_year': {
      return {
        mode: 'month_range',
        selectedDate: todayStr,
        startDate: `${curYear}-01-01`,
        endDate: `${curYear}-12-31`,
        selectedMonth: curMonthStr,
        startMonth: `${curYear}-01`,
        endMonth: `${curYear}-12`,
      };
    }

    case 'all':
    default:
      return {
        mode: 'all',
        selectedDate: todayStr,
        startDate: '2020-01-01',
        endDate: '2030-12-31',
        selectedMonth: curMonthStr,
        startMonth: '2020-01',
        endMonth: '2030-12',
      };
  }
};

export const isDateInPeriod = (dateStr?: string, filter?: DatePeriodFilter): boolean => {
  if (!dateStr || !filter) return true;
  if (filter.mode === 'all') return true;

  if (filter.mode === 'day') {
    return dateStr === filter.selectedDate;
  }

  if (filter.mode === 'day_range') {
    if (filter.startDate && filter.endDate) {
      return dateStr >= filter.startDate && dateStr <= filter.endDate;
    }
    if (filter.startDate) return dateStr >= filter.startDate;
    if (filter.endDate) return dateStr <= filter.endDate;
    return true;
  }

  if (filter.mode === 'month') {
    if (!filter.selectedMonth) return true;
    return dateStr.startsWith(filter.selectedMonth);
  }

  if (filter.mode === 'month_range') {
    const monthKey = dateStr.substring(0, 7);
    if (filter.startMonth && filter.endMonth) {
      return monthKey >= filter.startMonth && monthKey <= filter.endMonth;
    }
    if (filter.startMonth) return monthKey >= filter.startMonth;
    if (filter.endMonth) return monthKey <= filter.endMonth;
    return true;
  }

  return true;
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const formatMonthLabel = (monthKey: string): string => {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx]} ${yearStr}`;
  }
  return monthKey;
};

export const getPeriodLabel = (filter: DatePeriodFilter): string => {
  if (!filter) return 'Todo el Historial';

  if (filter.mode === 'all') {
    return 'Todo el Historial';
  }

  if (filter.mode === 'day') {
    const [y, m, d] = filter.selectedDate.split('-');
    const monthIdx = parseInt(m, 10) - 1;
    const mName = monthIdx >= 0 && monthIdx < 12 ? MONTH_NAMES[monthIdx] : m;
    return `Día: ${d} de ${mName} ${y}`;
  }

  if (filter.mode === 'day_range') {
    return `Rango: ${filter.startDate || 'Inicio'} al ${filter.endDate || 'Fin'}`;
  }

  if (filter.mode === 'month') {
    return `Mes: ${formatMonthLabel(filter.selectedMonth)}`;
  }

  if (filter.mode === 'month_range') {
    return `Periodo: ${formatMonthLabel(filter.startMonth)} a ${formatMonthLabel(filter.endMonth)}`;
  }

  return 'Periodo Activo';
};
