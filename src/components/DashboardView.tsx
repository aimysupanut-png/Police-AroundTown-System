import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Clock, 
  FileText, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Plus, 
  Filter, 
  Calendar, 
  Award, 
  ChevronRight, 
  Search,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Zap,
  Activity,
  DollarSign,
  UserCheck,
  UserX,
  Timer,
  BarChart3,
  Users,
  ShieldCheck,
  Briefcase,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Minus
} from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { Officer, CaseLog, DutyLog, ActivityTraining } from '../types';

interface DashboardViewProps {
  currentUser: Officer;
  cases: CaseLog[];
  dutyLogs: DutyLog[];
  officers?: Officer[];
  activities?: ActivityTraining[];
  onNavigateToDiscordSync?: () => void;
  onNavigateToCreateCase?: () => void;
  onNavigateToCases?: () => void;
  onToggleDuty: () => void;
  onSelectCase: (c: CaseLog) => void;
}

export type TimeFilterPeriod = 'week' | 'month' | 'all';

// Helper to parse any case timestamp safely
function parseCaseTimestamp(c: CaseLog): number {
  if (c.created_at) {
    const t = new Date(c.created_at.replace(' ', 'T')).getTime();
    if (!isNaN(t)) return t;
  }
  if (c.incident_date) {
    const timePart = c.incident_time || '00:00:00';
    const t = new Date(`${c.incident_date}T${timePart}`).getTime();
    if (!isNaN(t)) return t;
  }
  if (c.timestamp) {
    const t = new Date(c.timestamp.replace(' ', 'T')).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

// Helper to parse any duty log timestamp safely
function parseDutyTimestamp(d: DutyLog): number {
  if (d.clock_in_timestamp) return d.clock_in_timestamp;
  if (d.clock_in_iso) {
    const t = new Date(d.clock_in_iso).getTime();
    if (!isNaN(t)) return t;
  }
  if (d.clock_in) {
    const t = new Date(d.clock_in.replace(' ', 'T')).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  cases,
  dutyLogs,
  officers = [],
  activities = [],
  onNavigateToDiscordSync,
  onNavigateToCreateCase,
  onNavigateToCases,
  onToggleDuty,
  onSelectCase,
}) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilterPeriod>('week');
  const [caseSearch, setCaseSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [liveDutyDuration, setLiveDutyDuration] = useState<string>('00:00:00');
  const [adminViewMode, setAdminViewMode] = useState<'station' | 'personal'>('station');

  const isLeaderOrAdmin = 
    currentUser.role === 'Leader' || 
    currentUser.role === 'Admin' || 
    currentUser.rank === 'ผู้บัญชาการตำรวจ' || 
    currentUser.rank === 'รองผู้บัญชาการตำรวจ';

  const isOnDuty = currentUser.status === 'On Duty' || currentUser.status === 'In Action';
  const myDutyLogsAll = dutyLogs.filter(d => d.officer_discord_id === currentUser.discord_id);
  const activeDuty = myDutyLogsAll.find(d => d.is_active);

  // Live stopwatch for active duty session
  useEffect(() => {
    if (isOnDuty && activeDuty) {
      let startMs = activeDuty.clock_in_timestamp;
      if (!startMs && activeDuty.clock_in_iso) {
        startMs = new Date(activeDuty.clock_in_iso).getTime();
      }
      if (!startMs && activeDuty.clock_in) {
        startMs = new Date(activeDuty.clock_in.replace(' ', 'T')).getTime();
        if (isNaN(startMs)) {
          startMs = new Date(activeDuty.clock_in).getTime();
        }
      }
      if (!startMs || isNaN(startMs)) {
        startMs = Date.now();
      }

      const updateLiveTimer = () => {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs!) / 1000));
        const hrs = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
        const mins = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        setLiveDutyDuration(`${hrs}:${mins}:${secs}`);
      };

      updateLiveTimer();
      const interval = setInterval(updateLiveTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setLiveDutyDuration('00:00:00');
    }
  }, [isOnDuty, activeDuty]);

  // =========================================================================
  // STRICT TIME RANGE CALCULATION (WEEK | MONTH | ALL)
  // =========================================================================
  const timeRanges = useMemo(() => {
    const now = new Date();
    const currentEnd = now.getTime();

    // 1. WEEK Range: Monday 00:00:00 to Now
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0).getTime();
    const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
    const prevWeekEnd = weekStart - 1;

    // 2. MONTH Range: 1st of month 00:00:00 to Now
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
    const prevMonthEnd = monthStart - 1;

    return {
      week: {
        current: { start: weekStart, end: currentEnd, label: 'สัปดาห์นี้' },
        prior: { start: prevWeekStart, end: prevWeekEnd, label: 'สัปดาห์ก่อน' }
      },
      month: {
        current: { start: monthStart, end: currentEnd, label: 'เดือนนี้' },
        prior: { start: prevMonthStart, end: prevMonthEnd, label: 'เดือนก่อน' }
      },
      all: {
        current: { start: 0, end: Infinity, label: 'ทั้งหมด' },
        prior: null
      }
    };
  }, []);

  const activeRange = timeRanges[timeFilter];

  // =========================================================================
  // RBAC SCOPE: All Station vs Personal Scope
  // =========================================================================
  const scopedCases = useMemo(() => {
    if (isLeaderOrAdmin && adminViewMode === 'station') {
      return cases;
    }
    // Regular Officer or Personal Mode: only cases where user is creator or tagged helper
    return cases.filter(c => 
      c.officer_discord_id === currentUser.discord_id ||
      c.created_by === currentUser.discord_id ||
      (c.helpers && c.helpers.some(h => h.user_id === currentUser.discord_id || (h as any).discord_id === currentUser.discord_id))
    );
  }, [cases, currentUser.discord_id, isLeaderOrAdmin, adminViewMode]);

  const scopedDutyLogs = useMemo(() => {
    if (isLeaderOrAdmin && adminViewMode === 'station') {
      return dutyLogs;
    }
    return dutyLogs.filter(d => d.officer_discord_id === currentUser.discord_id);
  }, [dutyLogs, currentUser.discord_id, isLeaderOrAdmin, adminViewMode]);

  // =========================================================================
  // FILTERED DATA BY ACTIVE TIME RANGE
  // =========================================================================
  const casesInCurrentPeriod = useMemo(() => {
    return scopedCases.filter(c => {
      const ts = parseCaseTimestamp(c);
      if (timeFilter === 'all') return true;
      return ts >= activeRange.current.start && ts <= activeRange.current.end;
    });
  }, [scopedCases, timeFilter, activeRange]);

  const casesInPriorPeriod = useMemo(() => {
    if (!activeRange.prior) return [];
    return scopedCases.filter(c => {
      const ts = parseCaseTimestamp(c);
      return ts >= activeRange.prior!.start && ts <= activeRange.prior!.end;
    });
  }, [scopedCases, activeRange]);

  const dutyLogsInCurrentPeriod = useMemo(() => {
    return scopedDutyLogs.filter(d => {
      const ts = parseDutyTimestamp(d);
      if (timeFilter === 'all') return true;
      return ts >= activeRange.current.start && ts <= activeRange.current.end;
    });
  }, [scopedDutyLogs, timeFilter, activeRange]);

  const dutyLogsInPriorPeriod = useMemo(() => {
    if (!activeRange.prior) return [];
    return scopedDutyLogs.filter(d => {
      const ts = parseDutyTimestamp(d);
      return ts >= activeRange.prior!.start && ts <= activeRange.prior!.end;
    });
  }, [scopedDutyLogs, activeRange]);

  // Calculate duty hours for period
  const dutyHoursCurrentPeriod = useMemo(() => {
    let totalSec = 0;
    dutyLogsInCurrentPeriod.forEach(d => {
      if (d.is_active && d.clock_in_timestamp) {
        totalSec += Math.max(0, Math.floor((Date.now() - d.clock_in_timestamp) / 1000));
      } else if (d.duration_seconds !== undefined) {
        totalSec += d.duration_seconds;
      } else if (d.duration_minutes) {
        totalSec += d.duration_minutes * 60;
      }
    });
    return parseFloat((totalSec / 3600).toFixed(1));
  }, [dutyLogsInCurrentPeriod]);

  const dutyHoursPriorPeriod = useMemo(() => {
    let totalSec = 0;
    dutyLogsInPriorPeriod.forEach(d => {
      if (d.duration_seconds !== undefined) {
        totalSec += d.duration_seconds;
      } else if (d.duration_minutes) {
        totalSec += d.duration_minutes * 60;
      }
    });
    return parseFloat((totalSec / 3600).toFixed(1));
  }, [dutyLogsInPriorPeriod]);

  // Case category breakdown in active period
  const normalCases = casesInCurrentPeriod.filter(c => c.case_type === 'Normal' || c.type === 'NORMAL').length;
  const take2Cases = casesInCurrentPeriod.filter(c => c.case_type === 'Take2' || c.type === 'TAKE2').length;
  const redCases = casesInCurrentPeriod.filter(c => c.case_type === 'Red' || c.type === 'RED_CASE').length;

  const normalCasesPrior = casesInPriorPeriod.filter(c => c.case_type === 'Normal' || c.type === 'NORMAL').length;
  const take2CasesPrior = casesInPriorPeriod.filter(c => c.case_type === 'Take2' || c.type === 'TAKE2').length;
  const redCasesPrior = casesInPriorPeriod.filter(c => c.case_type === 'Red' || c.type === 'RED_CASE').length;

  const totalFines = casesInCurrentPeriod.reduce((sum, c) => sum + (c.fine_amount || 0), 0);
  const totalFinesPrior = casesInPriorPeriod.reduce((sum, c) => sum + (c.fine_amount || 0), 0);

  const resolvedCasesCount = casesInCurrentPeriod.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
  const openCasesCount = casesInCurrentPeriod.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length;
  const clearanceRate = casesInCurrentPeriod.length > 0 
    ? Math.round((resolvedCasesCount / casesInCurrentPeriod.length) * 100) 
    : 100;

  // Active officers on duty
  const activeOfficersCount = officers.filter(o => o.status === 'On Duty' || o.status === 'In Action').length;

  // Estimated compensation/payroll for period
  const estimatedPayroll = useMemo(() => {
    return normalCases * 1000 + take2Cases * 2500 + redCases * 5000 + Math.round(dutyHoursCurrentPeriod * 350);
  }, [normalCases, take2Cases, redCases, dutyHoursCurrentPeriod]);

  // Helper for trend calculations
  const getTrendData = (currentVal: number, priorVal: number) => {
    if (timeFilter === 'all' || !activeRange.prior) {
      return { text: 'ไม่มีข้อมูลสำหรับเปรียบเทียบ', diff: 0, direction: 'neutral' as const };
    }
    if (priorVal === 0 && currentVal === 0) {
      return { text: 'ไม่มีข้อมูลสำหรับเปรียบเทียบ', diff: 0, direction: 'neutral' as const };
    }
    if (priorVal === 0 && currentVal > 0) {
      return { text: '+100% (ข้อมูลใหม่ในงวดนี้)', diff: 100, direction: 'up' as const };
    }
    if (priorVal > 0) {
      const pct = ((currentVal - priorVal) / priorVal) * 100;
      const sign = pct >= 0 ? '+' : '';
      const periodName = timeFilter === 'week' ? 'สัปดาห์ก่อน' : 'เดือนก่อน';
      return {
        text: `${sign}${pct.toFixed(1)}% จาก${periodName}`,
        diff: pct,
        direction: pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('neutral' as const)
      };
    }
    return { text: 'ไม่มีข้อมูลสำหรับเปรียบเทียบ', diff: 0, direction: 'neutral' as const };
  };

  const caseTrend = getTrendData(casesInCurrentPeriod.length, casesInPriorPeriod.length);
  const dutyTrend = getTrendData(dutyHoursCurrentPeriod, dutyHoursPriorPeriod);
  const finesTrend = getTrendData(totalFines, totalFinesPrior);

  // Filtered cases for list display
  const filteredCasesList = useMemo(() => {
    return casesInCurrentPeriod.filter(c => {
      const query = caseSearch.toLowerCase();
      const matchSearch = 
        (c.case_number || '').toLowerCase().includes(query) ||
        (c.title || '').toLowerCase().includes(query) ||
        (c.suspect_name || '').toLowerCase().includes(query) ||
        (c.officer_name || '').toLowerCase().includes(query);
      
      const cType = c.case_type || (c.type === 'RED_CASE' ? 'Red' : c.type === 'TAKE2' ? 'Take2' : 'Normal');
      const matchType = typeFilter === 'all' || cType.toLowerCase() === typeFilter.toLowerCase();
      return matchSearch && matchType;
    });
  }, [casesInCurrentPeriod, caseSearch, typeFilter]);

  // Top Officers Leaderboard in Current Period (for Admin View)
  const topOfficersInPeriod = useMemo(() => {
    if (!isLeaderOrAdmin) return [];
    const officerMap: Record<string, { officer: Officer; caseCount: number; dutyHours: number; totalFines: number }> = {};
    
    officers.forEach(off => {
      officerMap[off.discord_id] = {
        officer: off,
        caseCount: 0,
        dutyHours: 0,
        totalFines: 0
      };
    });

    casesInCurrentPeriod.forEach(c => {
      const creatorId = c.created_by || c.officer_discord_id;
      if (creatorId && officerMap[creatorId]) {
        officerMap[creatorId].caseCount += 1;
        officerMap[creatorId].totalFines += (c.fine_amount || 0);
      }
    });

    dutyLogsInCurrentPeriod.forEach(d => {
      if (officerMap[d.officer_discord_id]) {
        const sec = d.duration_seconds || (d.duration_minutes ? d.duration_minutes * 60 : 0);
        officerMap[d.officer_discord_id].dutyHours += sec / 3600;
      }
    });

    return Object.values(officerMap)
      .sort((a, b) => b.caseCount - a.caseCount || b.dutyHours - a.dutyHours)
      .slice(0, 5);
  }, [isLeaderOrAdmin, officers, casesInCurrentPeriod, dutyLogsInCurrentPeriod]);

  // Daily Chart Data for the Selected Period
  const chartPoints = useMemo(() => {
    if (timeFilter === 'week') {
      const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
      return days.map((dayName, idx) => {
        // Calculate date of this day in current week
        const d = new Date(activeRange.current.start + idx * 24 * 60 * 60 * 1000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

        const dayCases = casesInCurrentPeriod.filter(c => {
          const ts = parseCaseTimestamp(c);
          return ts >= dayStart && ts <= dayEnd;
        }).length;

        const dayDutySec = dutyLogsInCurrentPeriod.filter(l => {
          const ts = parseDutyTimestamp(l);
          return ts >= dayStart && ts <= dayEnd;
        }).reduce((acc, l) => acc + (l.duration_seconds || (l.duration_minutes ? l.duration_minutes * 60 : 0)), 0);

        return {
          label: dayName,
          dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
          cases: dayCases,
          dutyHours: parseFloat((dayDutySec / 3600).toFixed(1)),
        };
      });
    }

    if (timeFilter === 'month') {
      // 4 Week buckets in the month
      return [
        { label: 'สัปดาห์ 1 (1-7)', cases: 0, dutyHours: 0 },
        { label: 'สัปดาห์ 2 (8-14)', cases: 0, dutyHours: 0 },
        { label: 'สัปดาห์ 3 (15-21)', cases: 0, dutyHours: 0 },
        { label: 'สัปดาห์ 4 (22-สิ้นเดือน)', cases: 0, dutyHours: 0 },
      ].map((b, idx) => {
        const startDay = idx * 7 + 1;
        const endDay = idx === 3 ? 31 : (idx + 1) * 7;
        const cCount = casesInCurrentPeriod.filter(c => {
          const d = new Date(parseCaseTimestamp(c));
          return d.getDate() >= startDay && d.getDate() <= endDay;
        }).length;

        const dHours = dutyLogsInCurrentPeriod.filter(l => {
          const d = new Date(parseDutyTimestamp(l));
          return d.getDate() >= startDay && d.getDate() <= endDay;
        }).reduce((acc, l) => acc + (l.duration_seconds || (l.duration_minutes ? l.duration_minutes * 60 : 0)), 0) / 3600;

        return {
          label: b.label,
          dateStr: `ช่วงที่ ${idx + 1}`,
          cases: cCount,
          dutyHours: parseFloat(dHours.toFixed(1)),
        };
      });
    }

    // ALL: Recent months
    return [
      { label: 'ม.ค.', cases: 0, dutyHours: 0 },
      { label: 'ก.พ.', cases: 0, dutyHours: 0 },
      { label: 'มี.ค.', cases: 0, dutyHours: 0 },
      { label: 'เม.ย.', cases: 0, dutyHours: 0 },
      { label: 'พ.ค.', cases: 0, dutyHours: 0 },
      { label: 'มิ.ย.', cases: 0, dutyHours: 0 },
    ].map((m, idx) => {
      const cCount = casesInCurrentPeriod.filter(c => new Date(parseCaseTimestamp(c)).getMonth() === idx).length;
      const dHours = dutyLogsInCurrentPeriod.filter(l => new Date(parseDutyTimestamp(l)).getMonth() === idx)
        .reduce((acc, l) => acc + (l.duration_seconds || (l.duration_minutes ? l.duration_minutes * 60 : 0)), 0) / 3600;
      return {
        label: m.label,
        dateStr: `เดือน ${idx + 1}`,
        cases: cCount,
        dutyHours: parseFloat(dHours.toFixed(1)),
      };
    });
  }, [timeFilter, activeRange, casesInCurrentPeriod, dutyLogsInCurrentPeriod]);

  const maxChartCases = Math.max(1, ...chartPoints.map(p => p.cases));

  const formatDutyDuration = (d: DutyLog) => {
    if (d.is_active) return liveDutyDuration;
    const sec = d.duration_seconds !== undefined ? d.duration_seconds : Math.round((d.duration_minutes || 0) * 60);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const hourDecimal = ((d.duration_minutes || (sec / 60)) / 60).toFixed(2);
    if (hrs > 0) return `${hrs} ชม. ${mins} นาที (${hourDecimal} ชม.)`;
    if (mins > 0) return `${mins} นาที ${s} วิ (${hourDecimal} ชม.)`;
    return `${s} วินาที (${hourDecimal} ชม.)`;
  };

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND BAR: TIME RANGE FILTER & RBAC VIEW TOGGLE */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#090d16]/90 border border-slate-800 backdrop-blur-xl shadow-xl">
        
        {/* Left: Time Period Selector (WEEK | MONTH | ALL) */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">ช่วงเวลาข้อมูล:</span>
          </div>

          <div className="flex bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            <button
              id="dash-filter-week-btn"
              onClick={() => setTimeFilter('week')}
              className={`px-3.5 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                timeFilter === 'week'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>สัปดาห์นี้</span>
              <span className="text-[10px] font-mono opacity-70">WEEK</span>
            </button>

            <button
              id="dash-filter-month-btn"
              onClick={() => setTimeFilter('month')}
              className={`px-3.5 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                timeFilter === 'month'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>เดือนนี้</span>
              <span className="text-[10px] font-mono opacity-70">MONTH</span>
            </button>

            <button
              id="dash-filter-all-btn"
              onClick={() => setTimeFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>ทั้งหมด</span>
              <span className="text-[10px] font-mono opacity-70">ALL</span>
            </button>
          </div>
        </div>

        {/* Right: RBAC Admin View Toggle (Station vs Personal) */}
        {isLeaderOrAdmin ? (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-400 font-medium hidden lg:inline">มุมมองข้อมูล:</span>
            <div className="flex bg-slate-950/90 p-1 rounded-xl border border-amber-500/30 text-xs shadow-inner">
              <button
                id="dash-view-station-btn"
                onClick={() => setAdminViewMode('station')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                  adminViewMode === 'station'
                    ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/50 shadow-sm shadow-amber-950/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>ภาพรวมทั้งสถานี</span>
              </button>

              <button
                id="dash-view-personal-btn"
                onClick={() => setAdminViewMode('personal')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                  adminViewMode === 'personal'
                    ? 'bg-blue-500/25 text-blue-300 font-bold border border-blue-500/50 shadow-sm shadow-blue-950/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span>งานส่วนบุคคล</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>MDT PERSONAL TELEMETRY &bull; #{currentUser.badge_number}</span>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. OFFICER HERO BANNER & STATUS */}
      {/* ========================================================================= */}
      <div className="bento-card bento-card-gold relative overflow-hidden p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        
        {/* Transparent Futuristic Watermark Emblem (Strictly no box or background) */}
        <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none hidden md:block">
          <AnimatedLogo size="hero" animate={true} colorCycling={true} lightSweep={false} spectrumSpeed={10} />
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          {/* Avatar & Officer Details */}
          <div className="flex items-center space-x-5">
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.officer_name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-2 ring-amber-500/40 shadow-xl"
              />
              <span className={`absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-lg text-[10px] font-black font-mono shadow-md border ${
                isOnDuty 
                  ? 'bg-emerald-500/90 text-slate-950 border-emerald-400' 
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {isOnDuty ? '10-8 ON DUTY' : '10-7 OFF DUTY'}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentUser.officer_name}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                  Badge #{currentUser.badge_number}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 font-mono font-bold text-xs border border-rose-500/40">
                  {currentUser.callsign}
                </span>
                {isLeaderOrAdmin && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-bold text-xs border border-indigo-500/40">
                    {adminViewMode === 'station' ? 'STATION COMMAND' : 'PERSONAL MODE'}
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <span className="text-amber-400">{currentUser.rank}</span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-slate-400">{currentUser.department}</span>
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-500">Discord ID:</span> 
                  <span className="font-mono text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">{currentUser.discord_id}</span>
                </span>
                <span>&bull;</span>
                <span>ช่วงเวลาที่แสดง: <strong className="text-cyan-300">{activeRange.current.label}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
            {/* Create Case Button */}
            {onNavigateToCreateCase && (
              <button
                id="dash-create-case-btn"
                onClick={onNavigateToCreateCase}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 h-10 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-950/50 border border-blue-400/30 hover:border-blue-400/60 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-blue-100 flex-shrink-0" />
                <span>ลงเคสใหม่</span>
              </button>
            )}

            {/* Case History Button */}
            {onNavigateToCases && (
              <button
                id="dash-cases-history-btn"
                onClick={onNavigateToCases}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 h-10 px-4 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-sm"
              >
                <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>ประวัติคดี</span>
              </button>
            )}

            {/* Toggle Duty Button */}
            <button
              id="dash-toggle-duty-btn"
              onClick={onToggleDuty}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                isOnDuty
                  ? 'bg-rose-950/80 hover:bg-rose-900/90 text-rose-200 hover:text-white border border-rose-500/50 shadow-rose-950/40'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-500/50 shadow-emerald-950/30'
              }`}
            >
              {isOnDuty ? (
                <>
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400"></span>
                  </span>
                  <UserX className="w-4 h-4 text-rose-300 flex-shrink-0" />
                  <span>ออกเวร</span>
                  <span className="font-mono bg-rose-900/60 px-2 py-0.5 rounded text-[11px] text-rose-200 border border-rose-500/40 font-bold ml-0.5">
                    {liveDutyDuration}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
                  <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>เข้าเวร</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DYNAMIC METRIC CARDS (REAL DATA & TRENDS FROM CHOSEN PERIOD) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        {/* 1. Total Cases in Period Tile */}
        <div className="bento-card bento-card-gold p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">คดีใน{activeRange.current.label}</span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-3xl font-black font-mono text-amber-300 tracking-tight">
                {casesInCurrentPeriod.length}
              </span>
              <span className="text-xs font-medium text-slate-400">คดี</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className={`inline-flex items-center gap-0.5 font-mono font-bold ${
              caseTrend.direction === 'up' 
                ? 'text-emerald-400' 
                : caseTrend.direction === 'down' 
                ? 'text-rose-400' 
                : 'text-slate-400'
            }`}>
              {caseTrend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
              {caseTrend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              {caseTrend.direction === 'neutral' && <Minus className="w-3 h-3" />}
              <span>{caseTrend.text}</span>
            </span>
          </div>
        </div>

        {/* 2. Duty Hours in Period Tile */}
        <div className="bento-card bento-card-blue p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">ชั่วโมงเวรใน{activeRange.current.label}</span>
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {dutyHoursCurrentPeriod}
              </span>
              <span className="text-xs font-medium text-slate-400">ชม.</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className={`inline-flex items-center gap-0.5 font-mono font-bold ${
              dutyTrend.direction === 'up' 
                ? 'text-emerald-400' 
                : dutyTrend.direction === 'down' 
                ? 'text-rose-400' 
                : 'text-slate-400'
            }`}>
              {dutyTrend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
              {dutyTrend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              {dutyTrend.direction === 'neutral' && <Minus className="w-3 h-3" />}
              <span>{dutyTrend.text}</span>
            </span>
          </div>
        </div>

        {/* 3. Normal Cases in Period */}
        <div className="bento-card p-4 border-blue-500/30 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300">เคสปกติ (Normal)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30">
                ฿1,000
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-3xl font-black font-mono text-blue-400 tracking-tight">{normalCases}</span>
              <span className="text-xs font-medium text-slate-400">เคส</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>งวดก่อน: {normalCasesPrior}</span>
            <span className="text-blue-300 font-bold">฿{(normalCases * 1000).toLocaleString()}</span>
          </div>
        </div>

        {/* 4. TAKE2 Cases in Period */}
        <div className="bento-card p-4 border-amber-500/30 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300">TAKE2 (แก้ตัว)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                ฿2,500
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-3xl font-black font-mono text-amber-400 tracking-tight">{take2Cases}</span>
              <span className="text-xs font-medium text-slate-400">เคส</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>งวดก่อน: {take2CasesPrior}</span>
            <span className="text-amber-300 font-bold">฿{(take2Cases * 2500).toLocaleString()}</span>
          </div>
        </div>

        {/* 5. Red Cases (High Risk) Tile */}
        <div className="bento-card bento-card-crimson p-4 shadow-lg col-span-2 sm:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-300">คดีแดง (High Risk)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                ฿5,000
              </span>
            </div>
            <div className="mt-3 flex items-baseline space-x-1.5">
              <span className="text-3xl font-black font-mono text-rose-400 tracking-tight">{redCases}</span>
              <span className="text-xs font-medium text-slate-400">เคส</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>งวดก่อน: {redCasesPrior}</span>
            <span className="text-rose-300 font-bold">฿{(redCases * 5000).toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVITY TREND CHART & TELEMETRY BREAKDOWN */}
      {/* ========================================================================= */}
      <div className="bento-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                แนวโน้มการรับคดีและชั่วโมงเวร ({activeRange.current.label})
              </h3>
              <p className="text-[11px] text-slate-400">
                สถิติแจกแจงตามช่วงเวลาจริง ({chartPoints.length} ช่วงเวลา)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span>จำนวนคดี (เคส)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded bg-emerald-400" />
              <span>ชั่วโมงเวร (ชม.)</span>
            </span>
          </div>
        </div>

        {/* Graphical Bar/Telemetry representation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2">
          {chartPoints.map((pt, i) => {
            const barHeightPct = Math.max(12, Math.round((pt.cases / maxChartCases) * 100));
            return (
              <div key={i} className="flex flex-col items-center justify-end p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 group hover:border-cyan-500/40 transition-colors">
                <div className="w-full flex items-baseline justify-between text-[10px] font-mono text-slate-400">
                  <span className="text-amber-400 font-bold">{pt.cases} คดี</span>
                  <span className="text-emerald-400">{pt.dutyHours}h</span>
                </div>

                <div className="w-full h-24 bg-slate-900 rounded-lg overflow-hidden flex items-end p-1 relative">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400 rounded-md transition-all duration-500 group-hover:brightness-125"
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>

                <div className="text-center">
                  <span className="text-xs font-bold text-slate-200 block">{pt.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">{pt.dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MAIN BENTO LAYOUT: CASE RECORDS TABLE (8 COLS) + TELEMETRY SIDEBAR (4 COLS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Case Explorer & Filter */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bento-card p-5 space-y-4">
            
            {/* Header & Count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>บันทึกคดีในช่วง{activeRange.current.label}</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                    {filteredCasesList.length} คดี
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLeaderOrAdmin && adminViewMode === 'station'
                    ? 'แสดงคดีทั้งหมดของสถานีตำรวจนครบาล ATPD'
                    : `แสดงเฉพาะคดีที่คุณเป็นผู้สร้างหรือมีส่วนร่วม`}
                </p>
              </div>

              {/* Status summary pills */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  เคลียร์แล้ว: {resolvedCasesCount}
                </span>
                <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  รอดำเนินการ: {openCasesCount}
                </span>
              </div>
            </div>

            {/* Search & Category Filter Pills */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขคดี, ชื่อผู้ต้องหา, ข้อหา, เจ้าหน้าที่..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex space-x-2 overflow-x-auto pb-1 sm:pb-0">
                {['all', 'Normal', 'Take2', 'Red'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      typeFilter.toLowerCase() === type.toLowerCase()
                        ? type === 'Red' 
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50' 
                          : type === 'Take2' 
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50' 
                          : type === 'Normal' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50' 
                          : 'bg-slate-700 text-white'
                        : 'bg-slate-900/90 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {type === 'all' ? 'ทุกประเภท' : type === 'Normal' ? 'เคสปกติ' : type === 'Take2' ? 'TAKE2' : 'คดีแดง'}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Cases List */}
          <div className="space-y-3">
            {filteredCasesList.length === 0 ? (
              <div className="bento-card p-12 text-center text-slate-500 space-y-2">
                <FileText className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                <p className="text-xs font-medium">ไม่พบคดีความในช่วงเวลา {activeRange.current.label} ตามเงื่อนไขที่ค้นหา</p>
                <p className="text-[11px] text-slate-600">ลองเปลี่ยนช่วงเวลาเป็น "ทั้งหมด (ALL)" เพื่อดูข้อมูลย้อนหลัง</p>
              </div>
            ) : (
              filteredCasesList.map((c) => {
                const cType = c.case_type || (c.type === 'RED_CASE' ? 'Red' : c.type === 'TAKE2' ? 'Take2' : 'Normal');
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c)}
                    className="bento-card p-4 hover:border-amber-500/40 hover:bg-slate-900/70 transition-all cursor-pointer group shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase font-mono border ${
                            cType === 'Red'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : cType === 'Take2'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}>
                            {cType === 'Red' ? 'คดีแดง' : cType === 'Take2' ? 'TAKE2' : 'เคสปกติ'}
                          </span>
                          
                          <span className="text-xs font-mono font-bold text-slate-300">{c.case_number}</span>

                          {c.status && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              c.status === 'RESOLVED' || c.status === 'CLOSED'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}>
                              {c.status}
                            </span>
                          )}

                          {c.created_by !== currentUser.discord_id && c.officer_discord_id !== currentUser.discord_id && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              ผู้ร่วมปฏิบัติงาน
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {c.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>ผู้ต้องหา: <strong className="text-slate-200">{c.suspect_name || '-'}</strong></span>
                          <span>&bull;</span>
                          <span>เจ้าหน้าที่: <strong className="text-slate-300">{c.created_by_name || c.officer_name || 'System'}</strong></span>
                          <span>&bull;</span>
                          <span>ค่าปรับ: <strong className="text-amber-400 font-mono">฿{(c.fine_amount || 0).toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="text-right space-y-1 pl-2">
                        <span className="text-[11px] font-mono text-slate-500 block">
                          {c.incident_date || (c.created_at ? c.created_at.slice(0, 10) : '-')}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/80 inline-block">
                          {c.discord_channel || '#case-logs'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Dedicated Telemetry & Admin Leaderboard */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. Dedicated Duty Terminal Card */}
          <div className="bento-card p-5 border-slate-700/80 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            
            {/* Officer Header Info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">OFFICER DUTY STATUS</span>
                <p className="text-xs font-bold text-white leading-tight">
                  {currentUser.rank} {currentUser.officer_name}
                </p>
                <span className="text-[10px] font-mono text-amber-400 font-bold">Badge #{currentUser.badge_number}</span>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                isOnDuty 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950' 
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                {isOnDuty ? '● ON DUTY' : '● OFF DUTY'}
              </span>
            </div>

            {/* Main Duty Status Display */}
            <div className="py-4 space-y-3.5">
              <div className={`p-4 rounded-2xl border text-center transition-all ${
                isOnDuty 
                  ? 'bg-gradient-to-b from-emerald-950/40 to-slate-950/80 border-emerald-500/40 shadow-inner' 
                  : 'bg-slate-950/70 border-slate-800'
              }`}>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isOnDuty ? 'กำลังปฏิบัติหน้าที่ในเวรปัจจุบัน' : 'สถานะปัจจุบัน: ออกเวรเรียบร้อยแล้ว'}
                </p>
                <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tracking-wider text-white">
                  {isOnDuty ? (
                    <span className="text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                      {liveDutyDuration}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xl font-sans font-bold">00:00:00</span>
                  )}
                </div>
                {isOnDuty && activeDuty && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    เวลาเข้าเวร: {activeDuty.clock_in}
                  </p>
                )}
              </div>

              {/* Duty Toggle Action CTA Button inside Card */}
              <button
                id="duty-card-action-btn"
                onClick={onToggleDuty}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 ${
                  isOnDuty
                    ? 'bg-gradient-to-r from-rose-900/80 to-red-950/90 hover:from-rose-600 hover:to-red-700 text-rose-100 hover:text-white border border-rose-500/40 shadow-rose-950/40'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
                }`}
              >
                {isOnDuty ? (
                  <>
                    <Timer className="w-4 h-4 text-rose-300" />
                    <span>ลงชื่อออกเวร</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>ลงชื่อเข้าเวร</span>
                  </>
                )}
              </button>

              {/* Mini Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ชั่วโมงเวร ({activeRange.current.label})</span>
                  <span className="text-sm font-mono font-bold text-amber-300">{dutyHoursCurrentPeriod} ชม.</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">รอบเข้าเวร ({activeRange.current.label})</span>
                  <span className="text-sm font-mono font-bold text-blue-400">{dutyLogsInCurrentPeriod.length} ครั้ง</span>
                </div>
              </div>
            </div>

            {/* Recent Duty History Section */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> บันทึกเวรใน{activeRange.current.label}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{dutyLogsInCurrentPeriod.length} รายการ</span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {dutyLogsInCurrentPeriod.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-3 text-center">ยังไม่มีประวัติการเข้าเวรใน{activeRange.current.label}</p>
                ) : (
                  dutyLogsInCurrentPeriod.slice(0, 5).map((d) => (
                    <div key={d.id} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          d.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {d.is_active ? 'กำลังปฏิบัติหน้าที่' : 'สิ้นสุดเวร'}
                        </span>
                        <span className="font-mono text-amber-300 font-bold text-[10px]">
                          {d.is_active ? 'Active' : formatDutyDuration(d)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        <span>เข้า: {d.clock_in.slice(11, 16) || d.clock_in}</span>
                        {d.clock_out && <span> &bull; ออก: {d.clock_out.slice(11, 16) || d.clock_out}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* 2. Top Officers Leaderboard in Period (If Admin in Station Mode) */}
          {isLeaderOrAdmin && adminViewMode === 'station' && topOfficersInPeriod.length > 0 && (
            <div className="bento-card p-5 space-y-3.5 border-amber-500/30">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    อันดับเจ้าหน้าที่ปฏิบัติงานสูงสุด ({activeRange.current.label})
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-500">TOP 5</span>
              </div>

              <div className="space-y-2">
                {topOfficersInPeriod.map((item, idx) => (
                  <div key={item.officer.discord_id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold font-mono text-[10px] ${
                        idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <img src={item.officer.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      <div>
                        <span className="font-bold text-white text-[11px] block leading-tight">{item.officer.officer_name}</span>
                        <span className="text-[10px] font-mono text-slate-500">#{item.officer.badge_number} &bull; {item.officer.rank}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <span className="text-amber-300 font-bold block">{item.caseCount} คดี</span>
                      <span className="text-[10px] text-slate-500">{item.dutyHours.toFixed(1)} ชม.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Estimated Payroll / Compensation for Period */}
          <div className="bento-card bento-card-gold p-5 space-y-3.5">
            <div className="flex items-center space-x-2 pb-2 border-b border-amber-500/20">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                ประมาณการค่าตอบแทน ({activeRange.current.label})
              </h4>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>ค่าคดีปกติ ({normalCases} เคส):</span>
                <span className="font-mono text-amber-400">฿{(normalCases * 1000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าคดี TAKE2 ({take2Cases} เคส):</span>
                <span className="font-mono text-amber-400">฿{(take2Cases * 2500).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าคดีแดง ({redCases} เคส):</span>
                <span className="font-mono text-rose-400 font-bold">฿{(redCases * 5000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>เบี้ยเลี้ยงชั่วโมงเวร ({dutyHoursCurrentPeriod} ชม.):</span>
                <span className="font-mono text-emerald-400 font-bold">฿{Math.round(dutyHoursCurrentPeriod * 350).toLocaleString()}</span>
              </div>
              <div className="pt-2.5 border-t border-slate-700/80 flex justify-between font-bold text-sm">
                <span className="text-white">รวมประมาณการ:</span>
                <span className="font-mono text-amber-300 text-base">
                  ฿{estimatedPayroll.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
