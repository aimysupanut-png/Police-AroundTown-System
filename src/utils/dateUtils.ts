import { Officer, CaseLog, DutyLog } from '../types';

export interface WeeklyRange {
  startDate: Date;
  endDate: Date;
  startISO: string;
  endISO: string;
  label: string;
  shortLabel: string;
  formattedRange: string;
  weekNumber: number;
}

/**
 * Calculates the weekly boundary starting on Sunday 00:00:00 and ending on Saturday 23:59:59.999
 * @param refDate Base reference date (default: new Date())
 * @param weekOffset 0 for current week, -1 for previous week, +1 for next week
 */
export function getWeeklyRange(refDate: Date = new Date(), weekOffset: number = 0): WeeklyRange {
  const d = new Date(refDate.getTime());
  if (weekOffset !== 0) {
    d.setDate(d.getDate() + (weekOffset * 7));
  }

  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate Sunday 00:00:00
  const startDate = new Date(d);
  startDate.setDate(d.getDate() - dayOfWeek);
  startDate.setHours(0, 0, 0, 0);

  // Calculate Saturday 23:59:59.999
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  // Format Thai dates
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  };

  const startStr = startDate.toLocaleDateString('th-TH', formatOptions);
  const endStr = endDate.toLocaleDateString('th-TH', formatOptions);

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const monthName = startDate.toLocaleDateString('th-TH', { month: 'short' });

  // Calculate week number in month
  const weekNumber = Math.ceil(d.getDate() / 7);

  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
    label: `สัปดาห์นี้ (${startDay} - ${endDay} ${monthName})`,
    shortLabel: `อา. 00:00 - ส. 23:59`,
    formattedRange: `วันอาทิตย์ ${startStr} 00:00 — วันเสาร์ ${endStr} 23:59`,
    weekNumber
  };
}

/**
 * Checks if a given timestamp string falls within the weekly range (Sunday 00:00 - Saturday 23:59)
 */
export function isDateInWeeklyRange(dateInput: string | Date | undefined | null, range: WeeklyRange): boolean {
  if (!dateInput) return false;

  let targetDate: Date;
  if (typeof dateInput === 'string') {
    // Handle 'YYYY-MM-DD HH:mm' format
    const cleaned = dateInput.replace(' ', 'T');
    targetDate = new Date(cleaned);
    if (isNaN(targetDate.getTime())) {
      targetDate = new Date(dateInput);
    }
  } else {
    targetDate = dateInput;
  }

  if (isNaN(targetDate.getTime())) return false;

  const time = targetDate.getTime();
  return time >= range.startDate.getTime() && time <= range.endDate.getTime();
}

export interface OfficerCalculatedStats {
  duty_hours: number;
  total_cases: number;
  cases_normal: number;
  cases_take2: number;
  cases_red: number;
  citations_count: number;
  total_fines: number;
  total_duty_sessions: number;
}

/**
 * Computes metrics for an officer either for the specific Weekly Range or All-Time
 */
export function computeOfficerStats(
  officer: Officer,
  allCases: CaseLog[],
  allDutyLogs: DutyLog[],
  mode: 'week' | 'all',
  weeklyRange: WeeklyRange = getWeeklyRange()
): OfficerCalculatedStats {
  const officerCases = allCases.filter(c => c.officer_discord_id === officer.discord_id);
  const officerDuties = allDutyLogs.filter(d => d.officer_discord_id === officer.discord_id);

  if (mode === 'all') {
    // Return all-time stats (either cumulative from DB or computed from full logs)
    const normalCount = officerCases.filter(c => c.case_type === 'Normal').length;
    const take2Count = officerCases.filter(c => c.case_type === 'Take2').length;
    const redCount = officerCases.filter(c => c.case_type === 'Red').length;
    const totalCasesCount = officerCases.length || officer.total_cases || (normalCount + take2Count + redCount);
    
    const computedDutyMins = officerDuties.reduce((sum, d) => {
      if (d.duration_seconds !== undefined) return sum + (d.duration_seconds / 60);
      return sum + (d.duration_minutes || 0);
    }, 0);
    const dutyHours = computedDutyMins > 0 ? Number((computedDutyMins / 60).toFixed(2)) : (officer.duty_hours || 0);
    const totalFines = officerCases.reduce((sum, c) => sum + (c.fine_amount || 0), 0);

    return {
      duty_hours: dutyHours,
      total_cases: totalCasesCount,
      cases_normal: normalCount || officer.cases_normal || 0,
      cases_take2: take2Count || officer.cases_take2 || 0,
      cases_red: redCount || officer.cases_red || 0,
      citations_count: officer.citations_count || 0,
      total_fines: totalFines,
      total_duty_sessions: officerDuties.length
    };
  }

  // Filter strictly within Sunday 00:00 to Saturday 23:59
  const weeklyCases = officerCases.filter(c => isDateInWeeklyRange(c.timestamp, weeklyRange));
  const weeklyDuties = officerDuties.filter(d => isDateInWeeklyRange(d.clock_in, weeklyRange));

  const normalCount = weeklyCases.filter(c => c.case_type === 'Normal').length;
  const take2Count = weeklyCases.filter(c => c.case_type === 'Take2').length;
  const redCount = weeklyCases.filter(c => c.case_type === 'Red').length;
  const totalCasesCount = weeklyCases.length;

  const weeklyDutyMins = weeklyDuties.reduce((sum, d) => {
    if (d.duration_seconds !== undefined) return sum + (d.duration_seconds / 60);
    return sum + (d.duration_minutes || 0);
  }, 0);
  const dutyHours = Number((weeklyDutyMins / 60).toFixed(2));
  const totalFines = weeklyCases.reduce((sum, c) => sum + (c.fine_amount || 0), 0);

  return {
    duty_hours: dutyHours,
    total_cases: totalCasesCount,
    cases_normal: normalCount,
    cases_take2: take2Count,
    cases_red: redCount,
    citations_count: Math.round(normalCount * 0.4),
    total_fines: totalFines,
    total_duty_sessions: weeklyDuties.length
  };
}
