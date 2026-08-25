import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Download, 
  Plus, 
  Edit3, 
  Trash2,
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Award, 
  Shield,
  Activity,
  History,
  Sparkles,
  SortAsc,
  LayoutGrid,
  List,
  Filter,
  Eye,
  Phone,
  Calendar,
  Layers,
  UserCheck,
  ChevronDown,
  UserX,
  FileSpreadsheet,
  Building2,
  Briefcase,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Officer, CaseLog, DutyLog, AnomalyLog, OfficerRank, OfficerRole, OfficerStatus } from '../types';
import { RosterImageScannerModal } from './RosterImageScannerModal';
import { OfficerExistenceCheckerModal } from './OfficerExistenceCheckerModal';

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

interface AllOfficersDirectoryViewProps {
  currentUser: Officer;
  officers: Officer[];
  cases: CaseLog[];
  dutyLogs: DutyLog[];
  anomalies: AnomalyLog[];
  onAddOfficer: (officerData: Partial<Officer>) => void;
  onUpdateOfficer: (discordId: string, officerData: Partial<Officer>) => void;
  onDeleteOfficer?: (discordId: string) => void;
  onRefreshData?: () => void;
  onReorderAZ?: () => void;
  onSelectCase?: (c: CaseLog) => void;
}

const RANKS: OfficerRank[] = [
  'ผู้บัญชาการตำรวจ',
  'รองผู้บัญชาการตำรวจ',
  'ครูฝึก',
  'สารวัตร',
  'หมวด',
  'จ่า',
  'นักเรียนตำรวจ'
];

export const AllOfficersDirectoryView: React.FC<AllOfficersDirectoryViewProps> = ({
  currentUser,
  officers,
  cases,
  dutyLogs,
  anomalies,
  onAddOfficer,
  onUpdateOfficer,
  onDeleteOfficer,
  onRefreshData,
  onReorderAZ,
  onSelectCase
}) => {
  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'rank'>('grid');

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilterPeriod>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'badge' | 'name' | 'rank' | 'duty' | 'cases'>('badge');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals & Active Selections
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showCheckerModal, setShowCheckerModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [viewingDossier, setViewingDossier] = useState<Officer | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // New officer form state
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newBadgeNumber, setNewBadgeNumber] = useState('');
  const [newRank, setNewRank] = useState<OfficerRank>('นักเรียนตำรวจ');
  const [newRole, setNewRole] = useState<OfficerRole>('Member');
  const [newPhone, setNewPhone] = useState('555-0199');
  const [newDiscordId, setNewDiscordId] = useState('');

  // Time Ranges Calculation (Week | Month | All)
  const timeRanges = useMemo(() => {
    const now = new Date();
    const currentEnd = now.getTime();

    // 1. WEEK Range: Monday 00:00:00 to Now
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0).getTime();

    // 2. MONTH Range: 1st of month 00:00:00 to Now
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();

    return {
      week: { start: weekStart, end: currentEnd, label: 'สัปดาห์นี้' },
      month: { start: monthStart, end: currentEnd, label: 'เดือนนี้' },
      all: { start: 0, end: Infinity, label: 'ทั้งหมด' }
    };
  }, []);

  const activeRange = timeRanges[timeFilter];

  // Cases filtered by selected time range
  const scopedCases = useMemo(() => {
    if (timeFilter === 'all') return cases;
    return cases.filter(c => {
      const ts = parseCaseTimestamp(c);
      if (ts === 0) return true; // fallback if untracked
      return ts >= activeRange.start && ts <= activeRange.end;
    });
  }, [cases, timeFilter, activeRange]);

  // Duty logs filtered by selected time range
  const scopedDutyLogs = useMemo(() => {
    if (timeFilter === 'all') return dutyLogs;
    return dutyLogs.filter(d => {
      const ts = parseDutyTimestamp(d);
      if (ts === 0) return true;
      return ts >= activeRange.start && ts <= activeRange.end;
    });
  }, [dutyLogs, timeFilter, activeRange]);

  // Compute aggregated stats per officer based on scoped data
  const officerStatsMap = useMemo(() => {
    const map = new Map<string, { dutyHours: number; totalCases: number; normalCases: number; take2Cases: number; redCases: number }>();

    officers.forEach(o => {
      if (timeFilter === 'all') {
        map.set(o.discord_id, {
          dutyHours: o.duty_hours,
          totalCases: o.total_cases,
          normalCases: o.cases_normal,
          take2Cases: o.cases_take2,
          redCases: o.cases_red
        });
      } else {
        // Compute from scoped logs
        const offDuty = scopedDutyLogs.filter(d => d.officer_discord_id === o.discord_id);
        const hours = offDuty.reduce((sum, d) => sum + (Number(d.duration_hours) || 0), 0);

        const offCases = scopedCases.filter(c => 
          c.officer_discord_id === o.discord_id || 
          c.created_by === o.discord_id ||
          (c.helpers && c.helpers.some(h => h.user_id === o.discord_id || (h as any).discord_id === o.discord_id))
        );
        const normal = offCases.filter(c => (c.type === 'NORMAL' || c.case_type === 'Normal')).length;
        const take2 = offCases.filter(c => (c.type === 'TAKE2' || c.case_type === 'Take2')).length;
        const red = offCases.filter(c => (c.type === 'RED_CASE' || c.case_type === 'Red')).length;

        map.set(o.discord_id, {
          dutyHours: Number(hours.toFixed(1)),
          totalCases: offCases.length,
          normalCases: normal,
          take2Cases: take2,
          redCases: red
        });
      }
    });

    return map;
  }, [officers, scopedCases, scopedDutyLogs, timeFilter]);

  // Overall Statistics calculation
  const totalCount = officers.length;
  const onDutyCount = officers.filter(o => o.status === 'On Duty' || o.status === 'In Action').length;
  const offDutyCount = officers.filter(o => o.status === 'Off Duty').length;
  const highCommandCount = officers.filter(o => o.role === 'Leader' || o.role === 'Admin').length;
  const totalStationHours = useMemo(() => {
    let total = 0;
    officers.forEach(o => {
      const stats = officerStatsMap.get(o.discord_id);
      total += stats ? stats.dutyHours : o.duty_hours;
    });
    return total;
  }, [officers, officerStatsMap]);
  const totalStationCases = scopedCases.length;

  // Rank distribution count (สถิติจำนวนตำรวจในแต่ละยศ)
  const rankCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    RANKS.forEach(r => { counts[r] = 0; });
    officers.forEach(o => {
      if (counts[o.rank] !== undefined) {
        counts[o.rank]++;
      } else {
        counts[o.rank] = (counts[o.rank] || 0) + 1;
      }
    });
    return counts;
  }, [officers]);

  // Helper to compute lowest available positive integer badge number >= 1
  const getLowestAvailableBadge = (officerList: Officer[]): string => {
    const occupied = new Set<number>();
    officerList.forEach(o => {
      const n = parseInt(o.badge_number, 10);
      if (!isNaN(n) && n > 0) occupied.add(n);
    });
    let candidate = 1;
    while (occupied.has(candidate)) {
      candidate++;
    }
    return candidate < 10 ? `0${candidate}` : `${candidate}`;
  };

  // Open add modal and calculate lowest vacant badge number
  const handleOpenAddModal = () => {
    const nextBadge = getLowestAvailableBadge(officers);
    setNewBadgeNumber(nextBadge);
    setNewOfficerName('');
    setNewRank('นักเรียนตำรวจ');
    setNewRole('Member');
    setNewPhone('555-0199');
    setNewDiscordId('');
    setShowAddModal(true);
  };

  // Filtered & Sorted Officers
  const filteredOfficers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return officers
      .filter((o) => {
        // Search term check
        const matchSearch = 
          !term ||
          o.officer_name.toLowerCase().includes(term) ||
          o.badge_number.includes(term) ||
          o.callsign.toLowerCase().includes(term) ||
          o.rank.toLowerCase().includes(term) ||
          (o.phone_number && o.phone_number.includes(term)) ||
          o.discord_id.includes(term);

        // Rank check
        const matchRank = selectedRank === 'All' || o.rank === selectedRank;

        // Status check
        const matchStatus = 
          selectedStatus === 'All' ||
          (selectedStatus === 'On Duty' && (o.status === 'On Duty' || o.status === 'In Action')) ||
          (selectedStatus === 'Off Duty' && o.status === 'Off Duty');

        // Role check
        const matchRole = selectedRole === 'All' || o.role === selectedRole;

        return matchSearch && matchRank && matchStatus && matchRole;
      })
      .sort((a, b) => {
        let cmp = 0;
        const statsA = officerStatsMap.get(a.discord_id) || { dutyHours: a.duty_hours, totalCases: a.total_cases };
        const statsB = officerStatsMap.get(b.discord_id) || { dutyHours: b.duty_hours, totalCases: b.total_cases };

        if (sortBy === 'badge') {
          cmp = parseInt(a.badge_number || '0', 10) - parseInt(b.badge_number || '0', 10);
        } else if (sortBy === 'name') {
          cmp = a.officer_name.localeCompare(b.officer_name, 'th', { sensitivity: 'base' });
        } else if (sortBy === 'duty') {
          cmp = statsB.dutyHours - statsA.dutyHours;
        } else if (sortBy === 'cases') {
          cmp = statsB.totalCases - statsA.totalCases;
        } else if (sortBy === 'rank') {
          const rankWeight: Record<OfficerRank, number> = {
            'ผู้บัญชาการตำรวจ': 7,
            'รองผู้บัญชาการตำรวจ': 6,
            'ครูฝึก': 5,
            'สารวัตร': 4,
            'หมวด': 3,
            'จ่า': 2,
            'นักเรียนตำรวจ': 1
          };
          cmp = (rankWeight[b.rank] || 0) - (rankWeight[a.rank] || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [officers, searchTerm, selectedRank, selectedStatus, selectedRole, sortBy, sortOrder, officerStatsMap]);

  // Export to Excel / CSV
  const handleExportRoster = (format: 'xlsx' | 'csv') => {
    const exportData = filteredOfficers.map(o => {
      const stats = officerStatsMap.get(o.discord_id) || {
        dutyHours: o.duty_hours,
        normalCases: o.cases_normal,
        take2Cases: o.cases_take2,
        redCases: o.cases_red,
        totalCases: o.total_cases
      };

      return {
        'Badge': `#${o.badge_number}`,
        'ชื่อ-สกุล': o.officer_name,
        'รหัสวิทยุ (Callsign)': o.callsign,
        'ยศ (Rank)': o.rank,
        'บทบาท (Role)': o.role,
        'สถานะการทำงาน': o.status,
        'ช่วงเวลา': activeRange.label,
        'ชั่วโมงเข้าเวร (ชม.)': stats.dutyHours,
        'คดีปกติ (Normal)': stats.normalCases,
        'คดี TAKE2': stats.take2Cases,
        'คดีแดง (Red)': stats.redCases,
        'คดีทั้งหมด (Cases)': stats.totalCases,
        'ใบสั่ง (Citations)': o.citations_count,
        'เบอร์โทรศัพท์': o.phone_number || '-',
        'Discord ID': o.discord_id,
        'วันที่เข้าร่วม': o.join_date,
        'ใช้งานล่าสุด': o.last_active
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Roster_${timeFilter}`);

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, `ATPD_Personnel_Roster_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      XLSX.writeFile(workbook, `ATPD_Personnel_Roster_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
    }
  };

  // Add officer submit
  const handleSaveNewOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    onAddOfficer({
      officer_name: newOfficerName.trim(),
      badge_number: newBadgeNumber.padStart(2, '0'),
      rank: newRank,
      role: newRole,
      department: 'Patrol Division',
      phone_number: newPhone,
      discord_id: newDiscordId || `${Date.now()}`
    });
    setShowAddModal(false);
    setNewOfficerName('');
    setNewBadgeNumber('');
  };

  // Edit officer submit
  const handleSaveEditOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer) return;
    onUpdateOfficer(editingOfficer.discord_id, editingOfficer);
    setEditingOfficer(null);
  };

  // Delete officer
  const handleDeleteOfficer = async (officer: Officer) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการปลดประจำการ / ลบข้อมูลเจ้าหน้าที่ "${officer.officer_name} (#${officer.badge_number})"?`)) {
      if (onDeleteOfficer) {
        onDeleteOfficer(officer.discord_id);
      } else {
        try {
          const res = await fetch(`/api/officers/${officer.discord_id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success && onRefreshData) {
            onRefreshData();
          }
        } catch (err) {
          console.error(err);
        }
      }
      if (viewingDossier?.discord_id === officer.discord_id) {
        setViewingDossier(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Alert Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-amber-950/40 to-slate-900 border border-rose-500/50 text-xs shadow-md">
        <div className="flex items-center space-x-2 text-rose-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="uppercase tracking-wider">ADMIN COMMAND &bull; ทำเนียบรายชื่อตำรวจทั้งหมด (MASTER PERSONNEL DIRECTORY)</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white font-mono text-[10px] font-black tracking-wider">
          {totalCount} OFFICERS ACTIVE
        </span>
      </div>

      {/* Main Stats Header Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bento-card bento-card-gold p-4 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">ตำรวจทั้งหมด</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">{totalCount} นาย</div>
          <p className="text-[10px] text-amber-400/80 mt-0.5">บรรจุในระบบสถานี</p>
        </div>

        <div className="bento-card bento-card-emerald p-4 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">กำลังปฏิบัติหน้าที่</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">{onDutyCount} นาย</div>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">สถานะ 10-8 / In Action</p>
        </div>

        <div className="bento-card p-4 shadow-md bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">ออกเวร / พัก</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-300 mt-1">{offDutyCount} นาย</div>
          <p className="text-[10px] text-slate-500 mt-0.5">สถานะ 10-7</p>
        </div>

        <div className="bento-card bento-card-crimson p-4 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">ผู้บังคับบัญชา</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-300 mt-1">{highCommandCount} นาย</div>
          <p className="text-[10px] text-rose-400/80 mt-0.5">Admin & Leader</p>
        </div>

        <div className="bento-card bento-card-blue p-4 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">ชั่วโมงเวรรวม</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-300 mt-1">{totalStationHours.toFixed(1)} ชม.</div>
          <p className="text-[10px] text-slate-400 mt-0.5">เฉลี่ย {(totalStationHours / (totalCount || 1)).toFixed(1)} ชม./นาย</p>
        </div>

        <div className="bento-card p-4 shadow-md bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">คดีจับกุมรวม</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1">{totalStationCases} เคส</div>
          <p className="text-[10px] text-slate-400 mt-0.5">บันทึกสะสมทั้งหมด</p>
        </div>

      </div>

      {/* Control Bar: Search, Filters & Action Buttons */}
      <div className="bento-card p-4 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเจ้าหน้าที่, Badge #, รหัสวิทยุ, ยศ, เบอร์โทร, Discord ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Switcher & Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* View Switchers */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-bold transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองการ์ด (Grid View)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">การ์ด</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-bold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองตารางรวม (Table View)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">ตาราง</span>
              </button>
              <button
                onClick={() => setViewMode('rank')}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-bold transition-all cursor-pointer ${
                  viewMode === 'rank' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองแยกตามลำดับยศ (Rank Hierarchy View)"
              >
                <Award className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">แยกตามยศ</span>
              </button>
            </div>

            {/* Check Officer Existence Button */}
            <button
              onClick={() => setShowCheckerModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="ตรวจสอบรายชื่อในฐานข้อมูลสถานี"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">ตรวจชื่อซ้ำ</span>
            </button>

            {/* Auto A-Z Sort & Renumber */}
            {onReorderAZ && (
              <button
                onClick={async () => {
                  if (confirm('คุณต้องการจัดเรียงรายชื่อตำรวจทั้งหมดตามลำดับตัวอักษร A-Z และรันหมายเลขประจำตัว (#01, #02, ...) ใหม่อัตโนมัติหรือไม่?')) {
                    setIsReordering(true);
                    await onReorderAZ();
                    setIsReordering(false);
                  }
                }}
                disabled={isReordering}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="จัดเรียง A-Z และรันเลขวิทยุใหม่อัตโนมัติ"
              >
                <SortAsc className="w-3.5 h-3.5 text-amber-400" />
                <span>{isReordering ? 'กำลังจัดเรียง...' : 'จัดเรียง A-Z'}</span>
              </button>
            )}

            {/* AI OCR Image Scan */}
            <button
              onClick={() => setShowOCRModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>สแกนรูปรายชื่อ</span>
            </button>

            {/* Add Officer Button */}
            <button
              onClick={handleOpenAddModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มตำรวจ</span>
            </button>

            {/* Export Roster Dropdown */}
            <div className="flex bg-slate-950 rounded-xl border border-slate-700 overflow-hidden text-xs">
              <button
                onClick={() => handleExportRoster('xlsx')}
                className="px-2.5 py-2 text-slate-300 hover:bg-slate-800 hover:text-emerald-400 font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="ส่งออก Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline text-[11px]">Excel</span>
              </button>
              <button
                onClick={() => handleExportRoster('csv')}
                className="px-2.5 py-2 text-slate-300 hover:bg-slate-800 hover:text-amber-400 font-bold border-l border-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                title="ส่งออก CSV"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline text-[11px]">CSV</span>
              </button>
            </div>

          </div>
        </div>

        {/* Filter Pills & Selectors Row */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Time Filter Tabs (สัปดาห์ / เดือน / ทั้งหมด) */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 pl-2 pr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>ช่วงเวลา:</span>
            </span>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                timeFilter === 'week'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              รายสัปดาห์
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                timeFilter === 'month'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                timeFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
          </div>

          {/* Select Dropdowns for Status, Rank, Sort */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="All">ทุกสถานะ (All Status)</option>
              <option value="On Duty">🟢 เข้าเวร (On Duty)</option>
              <option value="Off Duty">⚪ ออกเวร (Off Duty)</option>
            </select>

            {/* Rank Filter */}
            <select
              value={selectedRank}
              onChange={(e) => setSelectedRank(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="All">ทุกยศ ({officers.length} นาย)</option>
              {RANKS.map(r => (
                <option key={r} value={r}>{r} ({rankCounts[r] || 0} นาย)</option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="All">ทุกบทบาท (All Roles)</option>
              <option value="Leader">👑 Leader</option>
              <option value="Admin">🛡️ Admin</option>
              <option value="Member">👮 Member</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-500"
            >
              <option value="badge-asc">เรียงตาม Badge # (น้อย &rarr; มาก)</option>
              <option value="badge-desc">เรียงตาม Badge # (มาก &rarr; น้อย)</option>
              <option value="name-asc">เรียงตามชื่อ A-Z</option>
              <option value="rank-asc">เรียงตามลำดับยศสูงสุด</option>
              <option value="duty-asc">เรียงตาม ชม.เวร สูงสุด</option>
              <option value="cases-asc">เรียงตาม คดีสะสม สูงสุด</option>
            </select>

          </div>

        </div>

        {/* Quick Rank Filter & Officer Counts by Rank (สถิติจำนวนตำรวจตามยศ) */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>สถิติจำนวนตำรวจตามยศ:</span>
              <span className="text-[11px] font-normal text-slate-400 font-mono">(คลิกที่ยศเพื่อกรองรายชื่อ)</span>
            </span>
            {selectedRank !== 'All' && (
              <button
                onClick={() => setSelectedRank('All')}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>รีเซ็ตแสดงทุกยศ</span>
                <span className="text-slate-500">✕</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
            <button
              onClick={() => setSelectedRank('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                selectedRank === 'All'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>ทั้งหมด</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                selectedRank === 'All' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}>
                {officers.length}
              </span>
            </button>

            {RANKS.map((r) => {
              const count = rankCounts[r] || 0;
              const isSelected = selectedRank === r;

              return (
                <button
                  key={r}
                  onClick={() => setSelectedRank(isSelected ? 'All' : r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-1 ring-amber-400'
                      : count > 0
                        ? 'bg-slate-950 text-slate-200 border border-slate-800 hover:text-amber-300 hover:border-amber-500/40 hover:bg-slate-900'
                        : 'bg-slate-950/40 text-slate-500 border border-slate-900 hover:text-slate-400'
                  }`}
                  title={`${r}: มีเจ้าหน้าที่ ${count} นาย`}
                >
                  <span>{r}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                    isSelected
                      ? 'bg-slate-950/30 text-slate-950'
                      : count > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-900 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Result Count Info Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          แสดงผล <strong className="text-amber-400">{filteredOfficers.length}</strong> จากทั้งหมด <strong className="text-white">{officers.length}</strong> นาย
          {searchTerm && <span> (ค้นหาคำว่า: "<span className="text-white">{searchTerm}</span>")</span>}
        </span>

        {filteredOfficers.length === 0 && (
          <span className="text-rose-400 font-bold">ไม่พบรายชื่อตรงตามเงื่อนไข</span>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. GRID CARDS VIEW (BENTO TACTICAL DOSSIER CARDS) */}
      {/* ========================================================================= */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOfficers.map((officer) => {
            const isOfficerOnDuty = officer.status === 'On Duty' || officer.status === 'In Action';
            const isCommand = officer.role === 'Leader' || officer.role === 'Admin';
            const officerAnomalies = anomalies.filter(a => a.officer_discord_id === officer.discord_id && a.status === 'Unresolved');

            return (
              <div 
                key={officer.discord_id}
                className={`bento-card p-4.5 flex flex-col justify-between space-y-3.5 transition-all relative overflow-hidden group ${
                  isCommand ? 'border-rose-900/40 hover:border-amber-500/60' : 'hover:border-slate-500/60'
                }`}
              >
                {/* Card Top Pill: Badge & Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/40 shadow-sm">
                      #{officer.badge_number}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {officer.callsign}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {officerAnomalies.length > 0 && (
                      <span 
                        title={`ตรวจพบความผิดปกติที่ยังไม่ได้รับการแก้ไข ${officerAnomalies.length} รายการ`}
                        className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse"
                      >
                        <AlertTriangle className="w-3 h-3" /> {officerAnomalies.length}
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      isOfficerOnDuty 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOfficerOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                      {officer.status}
                    </span>
                  </div>
                </div>

                {/* Officer Avatar & Identity */}
                <div className="flex items-center space-x-3">
                  <div className="relative shrink-0">
                    <img
                      src={officer.avatar}
                      alt={officer.officer_name}
                      className={`w-12 h-12 rounded-2xl object-cover ring-2 shadow-md ${
                        officer.role === 'Leader' ? 'ring-rose-500' : officer.role === 'Admin' ? 'ring-amber-400' : 'ring-slate-700'
                      }`}
                    />
                    {officer.role === 'Leader' && (
                      <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white p-0.5 rounded-full shadow">
                        <Award className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                      {officer.officer_name}
                    </h4>
                    <p className="text-[11px] font-semibold text-rose-300/90 truncate">
                      {officer.rank}
                    </p>
                  </div>
                </div>

                {/* Officer Performance Matrix */}
                {(() => {
                  const stats = officerStatsMap.get(officer.discord_id) || {
                    dutyHours: officer.duty_hours,
                    totalCases: officer.total_cases,
                    redCases: officer.cases_red
                  };

                  return (
                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">ชม.เวร</span>
                        <span className="text-xs font-bold text-emerald-400">{stats.dutyHours}h</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">คดีรวม</span>
                        <span className="text-xs font-bold text-amber-300">{stats.totalCases}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">คดีแดง</span>
                        <span className="text-xs font-bold text-rose-400">{stats.redCases}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Metadata & Actions */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    officer.role === 'Leader'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : officer.role === 'Admin'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {officer.role}
                  </span>

                  <div className="flex items-center space-x-1">
                    {/* View Dossier */}
                    <button
                      onClick={() => setViewingDossier(officer)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="ดูแฟ้มประวัติฉบับเต็ม"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Edit */}
                    <button
                      onClick={() => setEditingOfficer({ ...officer })}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                      title="แก้ไขข้อมูลเจ้าหน้าที่"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete / Remove */}
                    <button
                      onClick={() => handleDeleteOfficer(officer)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                      title="ปลดประจำการ/ลบข้อมูล"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MASTER TABLE VIEW (DETAILED POLICE ROSTER SPREADSHEET) */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d121c] shadow-2xl">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px] select-none">
                <th className="py-3.5 px-3 text-center">Badge</th>
                <th className="py-3.5 px-4">เจ้าหน้าที่ตำรวจ (Officer)</th>
                <th className="py-3.5 px-3">ยศ (Rank)</th>
                <th className="py-3.5 px-3 text-center">สิทธิ์ (Role)</th>
                <th className="py-3.5 px-3 text-center">สถานะ</th>
                <th className="py-3.5 px-3 text-right">ชม.เวร</th>
                <th className="py-3.5 px-2 text-center text-slate-400" title="คดีปกติ">ปกติ</th>
                <th className="py-3.5 px-2 text-center text-amber-400" title="คดี TAKE2">T2</th>
                <th className="py-3.5 px-2 text-center text-rose-400" title="คดีแดง">แดง</th>
                <th className="py-3.5 px-3 text-right font-black">คดีรวม</th>
                <th className="py-3.5 px-3">เบอร์ติดต่อ</th>
                <th className="py-3.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOfficers.map((o) => {
                const isOfficerOnDuty = o.status === 'On Duty' || o.status === 'In Action';
                const stats = officerStatsMap.get(o.discord_id) || {
                  dutyHours: o.duty_hours,
                  normalCases: o.cases_normal,
                  take2Cases: o.cases_take2,
                  redCases: o.cases_red,
                  totalCases: o.total_cases
                };

                return (
                  <tr key={o.discord_id} className="hover:bg-slate-900/60 transition-colors">
                    
                    {/* Badge */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                      #{o.badge_number}
                    </td>

                    {/* Officer info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img src={o.avatar} alt={o.officer_name} className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700" />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span 
                              onClick={() => setViewingDossier(o)}
                              className="font-bold text-white hover:text-amber-300 cursor-pointer transition-colors"
                            >
                              {o.officer_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">{o.callsign}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">Discord: {o.discord_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Rank */}
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {o.rank}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.role === 'Leader'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : o.role === 'Admin'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {o.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOfficerOnDuty
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {o.status}
                      </span>
                    </td>

                    {/* Duty Hours */}
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">
                      {stats.dutyHours}h
                    </td>

                    {/* Case breakdown */}
                    <td className="py-3 px-2 text-center font-mono text-slate-300">{stats.normalCases}</td>
                    <td className="py-3 px-2 text-center font-mono text-amber-300">{stats.take2Cases}</td>
                    <td className="py-3 px-2 text-center font-mono text-rose-400 font-bold">{stats.redCases}</td>
                    
                    {/* Total Cases */}
                    <td className="py-3 px-3 text-right font-mono text-amber-400 font-black text-xs">
                      {stats.totalCases}
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {o.phone_number || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setViewingDossier(o)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="ดูแฟ้มประวัติ"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingOfficer({ ...o })}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOfficer(o)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                          title="ปลดประจำการ/ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RANK HIERARCHY & GROUPING VIEW (มุมมองแยกตามลำดับยศ) */}
      {/* ========================================================================= */}
      {viewMode === 'rank' && (
        <div className="space-y-5">
          {RANKS.filter(r => selectedRank === 'All' || selectedRank === r).map((rank) => {
            const rankOfficers = filteredOfficers.filter(o => o.rank === rank);
            if (rankOfficers.length === 0 && selectedRank === 'All') return null;

            const onDutyInRank = rankOfficers.filter(o => o.status === 'On Duty' || o.status === 'In Action').length;

            return (
              <div key={rank} className="bento-card p-5 space-y-4 shadow-xl border border-slate-800/80 bg-slate-900/60">
                {/* Rank Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span>{rank}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        กำลังปฏิบัติหน้าที่: <span className="text-emerald-400 font-bold">{onDutyInRank}</span> / {rankOfficers.length} นาย
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-slate-950 border border-amber-500/40 font-mono text-amber-400 font-black shadow-inner">
                      {rankOfficers.length} นาย
                    </span>
                  </div>
                </div>

                {/* Officer Cards in this Rank */}
                {rankOfficers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center italic">ไม่มีเจ้าหน้าที่ในยศนี้ที่ตรงกับเงื่อนไขการค้นหา</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {rankOfficers.map((o) => {
                      const stats = officerStatsMap.get(o.discord_id);
                      const dutyHours = stats ? stats.dutyHours : o.duty_hours;
                      const casesCount = stats ? stats.casesCount : o.total_cases;
                      const isHighCommand = o.role === 'Leader' || o.role === 'Admin';

                      return (
                        <div 
                          key={o.discord_id}
                          onClick={() => setViewingDossier(o)}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-amber-500/50 transition-all cursor-pointer flex items-center space-x-3 group relative overflow-hidden shadow-sm"
                        >
                          <div className="relative shrink-0">
                            <img 
                              src={o.avatar} 
                              alt={o.officer_name} 
                              className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-700 group-hover:ring-amber-400 transition-all" 
                            />
                            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                              o.status === 'On Duty' || o.status === 'In Action' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                                {o.officer_name}
                              </p>
                              <span className="text-[10px] font-mono text-amber-400 font-black shrink-0">
                                #{o.badge_number}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono truncate">{o.callsign}</span>
                              {isHighCommand && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800 font-black">
                                  {o.role}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 mt-1 border-t border-slate-900">
                              <span className="text-indigo-300 font-bold">{dutyHours.toFixed(1)} ชม.</span>
                              <span className="text-amber-300 font-bold">{casesCount} เคส</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICER FULL DOSSIER MODAL (แฟ้มประวัติส่วนบุคคลฉบับเต็ม) */}
      {/* ========================================================================= */}
      {viewingDossier && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border-2 border-amber-500/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            {/* Dossier Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <img 
                  src={viewingDossier.avatar} 
                  alt={viewingDossier.officer_name} 
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-amber-400 shadow-xl"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white">{viewingDossier.officer_name}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                      #{viewingDossier.badge_number}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300 font-bold">{viewingDossier.rank} &bull; {viewingDossier.callsign}</p>
                  <p className="text-[11px] text-slate-400">สิทธิ์ระบบ: <span className="font-semibold text-slate-300">{viewingDossier.role}</span></p>
                </div>
              </div>

              <button 
                onClick={() => setViewingDossier(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Dossier Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">สถานะปัจจุบัน</span>
                <p className="font-bold text-emerald-400 mt-0.5">{viewingDossier.status}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">ชั่วโมงเวรสะสม</span>
                <p className="font-bold text-white font-mono mt-0.5">{viewingDossier.duty_hours} ชั่วโมง</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">คดีจับกุมรวม</span>
                <p className="font-bold text-amber-300 font-mono mt-0.5">{viewingDossier.total_cases} คดี</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">เบอร์ติดต่อ</span>
                <p className="font-bold text-slate-300 font-mono mt-0.5">{viewingDossier.phone_number || '555-0100'}</p>
              </div>
            </div>

            {/* Case Portfolio Breakdown */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> สถิติคดีจับกุมแยกตามประเภท
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-[#0d1322] border border-slate-800">
                  <span className="text-[10px] text-slate-400">เคสปกติ</span>
                  <p className="text-base font-mono font-bold text-slate-200">{viewingDossier.cases_normal}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0d1322] border border-slate-800">
                  <span className="text-[10px] text-amber-400">เคส TAKE2</span>
                  <p className="text-base font-mono font-bold text-amber-300">{viewingDossier.cases_take2}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0d1322] border border-slate-800">
                  <span className="text-[10px] text-rose-400">คดีแดง (Red)</span>
                  <p className="text-base font-mono font-bold text-rose-400">{viewingDossier.cases_red}</p>
                </div>
              </div>
            </div>

            {/* Recent Case Logs by this Officer */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> ประวัติการบันทึกคดีล่าสุดของเจ้าหน้าที่
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {cases.filter(c => c.officer_discord_id === viewingDossier.discord_id).length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic p-3 bg-slate-950 rounded-xl">ยังไม่มีประวัติคดีบันทึกในระบบ</p>
                ) : (
                  cases.filter(c => c.officer_discord_id === viewingDossier.discord_id).map((c) => (
                    <div 
                      key={c.id}
                      onClick={() => onSelectCase && onSelectCase(c)}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-600 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            c.case_type === 'Red' ? 'bg-rose-500/20 text-rose-400' :
                            c.case_type === 'Take2' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {c.case_type}
                          </span>
                          <span className="font-bold text-white truncate">{c.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">ผู้ต้องหา: {c.suspect_name} &bull; ค่าปรับ ฿{c.fine_amount.toLocaleString()}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{c.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dossier Footer Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] text-slate-500">
                Discord ID: {viewingDossier.discord_id} &bull; เข้าร่วม: {viewingDossier.join_date}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingOfficer({ ...viewingDossier });
                    setViewingDossier(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition-colors"
                >
                  แก้ไขข้อมูล
                </button>
                <button
                  onClick={() => setViewingDossier(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD OFFICER MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (() => {
        const parsedBadge = parseInt(newBadgeNumber, 10);
        const formattedBadge = !isNaN(parsedBadge) ? (parsedBadge < 10 ? `0${parsedBadge}` : `${parsedBadge}`) : newBadgeNumber;
        const occupiedOfficer = officers.find(o => {
          const oInt = parseInt(o.badge_number, 10);
          return (!isNaN(oInt) && !isNaN(parsedBadge) && oInt === parsedBadge) || o.badge_number === newBadgeNumber;
        });
        const lowestVacant = getLowestAvailableBadge(officers);
        const isDuplicate = !!occupiedOfficer;

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">เพิ่มเจ้าหน้าที่ตำรวจนายใหม่</h3>
                    <p className="text-[11px] text-slate-400">ระบบจัดสรรเลขว่างที่น้อยที่สุดให้อัตโนมัติ (เริ่มจาก #01)</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSaveNewOfficer} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ชื่อ-นามสกุล เจ้าหน้าที่</label>
                  <input
                    type="text"
                    required
                    value={newOfficerName}
                    onChange={(e) => setNewOfficerName(e.target.value)}
                    placeholder="เช่น Marcus Brody"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-300 font-bold">หมายเลขประจำตัว (Badge #)</label>
                      <button
                        type="button"
                        onClick={() => setNewBadgeNumber(lowestVacant)}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        title="ใช้เลขว่างที่น้อยที่สุด"
                      >
                        เลขว่าง: #{lowestVacant}
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      max="999"
                      value={newBadgeNumber}
                      onChange={(e) => setNewBadgeNumber(e.target.value)}
                      placeholder="01-99"
                      className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-white focus:outline-none ${
                        isDuplicate ? 'border-rose-500 focus:border-rose-500 text-rose-300' : 'border-slate-700 focus:border-amber-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Discord ID (ไม่บังคับ)</label>
                    <input
                      type="text"
                      value={newDiscordId}
                      onChange={(e) => setNewDiscordId(e.target.value)}
                      placeholder="เช่น 8923019283019"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Badge collision alert or success prompt */}
                {isDuplicate ? (
                  <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-[11px] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>หมายเลข #{formattedBadge} ถูกใช้งานแล้วโดย {occupiedOfficer.officer_name}</span>
                    </div>
                    <p className="text-slate-400 text-[10px]">
                      ห้ามใช้เลขซ้ำหรือทับข้อมูลเดิม กรุณาเปลี่ยนเป็นเลขอื่นหรือใช้เลขว่างที่น้อยที่สุด
                    </p>
                    <button
                      type="button"
                      onClick={() => setNewBadgeNumber(lowestVacant)}
                      className="w-full py-1 px-2 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      🔄 สลับใช้เลขว่างที่น้อยที่สุด (#{lowestVacant})
                    </button>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>หมายเลข #{formattedBadge || lowestVacant} พร้อมใช้งาน (เป็นเลขว่างที่จัดสรรอัตโนมัติ)</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">ยศตำแหน่ง (Rank)</label>
                    <select
                      value={newRank}
                      onChange={(e: any) => setNewRank(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      {RANKS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">สิทธิ์ (Role)</label>
                    <select
                      value={newRole}
                      onChange={(e: any) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Member">Member (เจ้าหน้าที่ทั่วไป)</option>
                      <option value="Admin">Admin (ผู้ดูแล)</option>
                      <option value="Leader">Leader (หัวหน้าหน่วยงาน)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="555-0199"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer hover:bg-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicate}
                    className={`flex-1 py-2 rounded-xl font-black shadow-md cursor-pointer transition-all ${
                      isDuplicate
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    บันทึกตำรวจ
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* EDIT OFFICER MODAL */}
      {/* ========================================================================= */}
      {editingOfficer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-400" /> แก้ไขข้อมูล: {editingOfficer.officer_name}
              </h3>
              <button onClick={() => setEditingOfficer(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEditOfficer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ชื่อเจ้าหน้าที่</label>
                <input
                  type="text"
                  value={editingOfficer.officer_name}
                  onChange={(e) => setEditingOfficer({ ...editingOfficer, officer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">หมายเลขประจำตัว (Badge #)</label>
                  <input
                    type="text"
                    value={editingOfficer.badge_number}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, badge_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">รหัสวิทยุ (Callsign)</label>
                  <input
                    type="text"
                    value={editingOfficer.callsign}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, callsign: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ยศตำแหน่ง (Rank)</label>
                  <select
                    value={editingOfficer.rank}
                    onChange={(e: any) => setEditingOfficer({ ...editingOfficer, rank: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    {RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">สิทธิ์ Role</label>
                  <select
                    value={editingOfficer.role}
                    onChange={(e: any) => setEditingOfficer({ ...editingOfficer, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="Leader">Leader</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={editingOfficer.phone_number || ''}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, phone_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Discord ID</label>
                  <input
                    type="text"
                    value={editingOfficer.discord_id || ''}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, discord_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">สถานะการทำงาน</label>
                <select
                  value={editingOfficer.status}
                  onChange={(e: any) => setEditingOfficer({ ...editingOfficer, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="On Duty">On Duty (10-8)</option>
                  <option value="Off Duty">Off Duty (10-7)</option>
                  <option value="In Action">In Action</option>
                  <option value="On Break">On Break (10-6)</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI OCR Image Scanner Modal */}
      <RosterImageScannerModal
        isOpen={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        existingOfficers={officers}
        onImportSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Officer Existence Checker Modal */}
      <OfficerExistenceCheckerModal
        isOpen={showCheckerModal}
        onClose={() => setShowCheckerModal(false)}
        allOfficers={officers}
        onAddOfficerQuick={(name) => {
          setNewOfficerName(name);
          setNewBadgeNumber(`${officers.length + 1}`.padStart(2, '0'));
          setShowAddModal(true);
        }}
        onRefreshData={onRefreshData}
      />

    </div>
  );
};
