import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Download, 
  Plus, 
  Edit, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Award, 
  Shield,
  Activity,
  History,
  Sparkles,
  SortAsc,
  UploadCloud,
  Layers,
  UserCheck,
  Crown,
  Trash2,
  Key,
  AlertCircle,
  CheckCircle2,
  Flame,
  ShieldAlert,
  Eye,
  MapPin,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';
import { AnimatedLogo } from './AnimatedLogo';
import { Officer, AuditLog, CaseLog, DutyLog, CaseEditRequest } from '../types';
import { RosterImageScannerModal } from './RosterImageScannerModal';
import { OfficerExistenceCheckerModal } from './OfficerExistenceCheckerModal';

interface AdminCenterViewProps {
  currentUser: Officer;
  officers: Officer[];
  auditLogs: AuditLog[];
  cases: CaseLog[];
  dutyLogs: DutyLog[];
  caseEditRequests?: CaseEditRequest[];
  onAddOfficer: (officerData: Partial<Officer>) => void;
  onUpdateOfficer: (discordId: string, officerData: Partial<Officer>) => void;
  onRefreshData?: () => void;
  onReorderAZ?: () => void;
  onDeleteCase?: (caseId: string) => void;
  onSelectCase?: (caseItem: CaseLog) => void;
  onApproveEditRequest?: (requestId: string) => Promise<void>;
  onRejectEditRequest?: (requestId: string, reason: string) => Promise<void>;
}

export const AdminCenterView: React.FC<AdminCenterViewProps> = ({
  currentUser,
  officers,
  auditLogs,
  cases,
  dutyLogs,
  caseEditRequests = [],
  onAddOfficer,
  onUpdateOfficer,
  onRefreshData,
  onReorderAZ,
  onDeleteCase,
  onSelectCase,
  onApproveEditRequest,
  onRejectEditRequest
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit_requests' | 'cases' | 'roster' | 'audit' | 'admins'>('overview');
  const [searchRoster, setSearchRoster] = useState('');
  const [searchAudit, setSearchAudit] = useState('');
  const [searchCase, setSearchCase] = useState('');
  const [searchEditReq, setSearchEditReq] = useState('');
  const [editReqStatusFilter, setEditReqStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isProcessingEditReq, setIsProcessingEditReq] = useState(false);
  const [caseTypeFilter, setCaseTypeFilter] = useState<'ALL' | 'NORMAL' | 'TAKE2' | 'RED_CASE'>('ALL');
  const [caseOfficerFilter, setCaseOfficerFilter] = useState<string>('ALL');
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('ALL');

  const [showAddOfficerModal, setShowAddOfficerModal] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showCheckerModal, setShowCheckerModal] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Admin Discord IDs state
  const [adminDiscordIds, setAdminDiscordIds] = useState<string[]>([]);
  const [newAdminDiscordId, setNewAdminDiscordId] = useState('');
  const [isSubmittingAdminId, setIsSubmittingAdminId] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New officer form
  const [officerName, setOfficerName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [rank, setRank] = useState<any>('นักเรียนตำรวจ');
  const [role, setRole] = useState<any>('Member');
  const [department, setDepartment] = useState<any>('Patrol Division');
  const [discordId, setDiscordId] = useState('');

  // Fetch admin discord IDs
  const fetchAdminIds = async () => {
    try {
      const res = await fetch('/api/admin/admin-ids');
      if (res.ok) {
        const data = await res.json();
        setAdminDiscordIds(data.admin_ids || []);
      }
    } catch (e) {
      console.error("Failed to fetch admin ids", e);
    }
  };

  useEffect(() => {
    fetchAdminIds();
  }, []);

  const handleAddAdminId = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAdminDiscordId.trim();
    if (!clean) return;
    setIsSubmittingAdminId(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/admin/admin-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_id: clean })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminDiscordIds(data.admin_ids || []);
        setNewAdminDiscordId('');
        setAdminMsg({ type: 'success', text: `เพิ่ม Discord ID: ${clean} เป็นผู้ดูแลระบบเรียบร้อยแล้ว` });
        if (onRefreshData) onRefreshData();
      } else {
        setAdminMsg({ type: 'error', text: data.error || 'เกิดข้อผิดพลาดในการบันทึก' });
      }
    } catch (err: any) {
      setAdminMsg({ type: 'error', text: err.message || 'Server error' });
    } finally {
      setIsSubmittingAdminId(false);
    }
  };

  const handleRemoveAdminId = async (idToRemove: string) => {
    if (!window.confirm(`ต้องการยกเลิกสิทธิ์ Admin ของ Discord ID: ${idToRemove} หรือไม่?`)) return;
    try {
      const res = await fetch('/api/admin/admin-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove_id: idToRemove })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminDiscordIds(data.admin_ids || []);
        setAdminMsg({ type: 'success', text: `ยกเลิกสิทธิ์ Admin ของ Discord ID: ${idToRemove} เรียบร้อยแล้ว` });
        if (onRefreshData) onRefreshData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Station-wide aggregates
  const totalOfficers = officers.length;
  const onDutyCount = officers.filter(o => o.status === 'On Duty' || o.status === 'In Action').length;
  const totalStationHours = officers.reduce((sum, o) => sum + o.duty_hours, 0);
  const totalStationCases = cases.length;

  const filteredOfficers = officers
    .filter(o =>
      o.officer_name.toLowerCase().includes(searchRoster.toLowerCase()) ||
      o.badge_number.includes(searchRoster) ||
      o.rank.toLowerCase().includes(searchRoster.toLowerCase()) ||
      o.department.toLowerCase().includes(searchRoster.toLowerCase())
    )
    .sort((a, b) => parseInt(a.badge_number || '0', 10) - parseInt(b.badge_number || '0', 10));

  const filteredAuditLogs = auditLogs.filter(a =>
    a.action_details.toLowerCase().includes(searchAudit.toLowerCase()) ||
    a.admin_name.toLowerCase().includes(searchAudit.toLowerCase()) ||
    (a.target_user?.toLowerCase().includes(searchAudit.toLowerCase()) ?? false)
  );

  // Filtered Cases for Admin Audit Tab
  const filteredAdminCases = useMemo(() => {
    return cases.filter((c) => {
      // 1. Search Query
      const q = searchCase.toLowerCase().trim();
      if (q) {
        const matchNumber = (c.case_number || '').toLowerCase().includes(q);
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchLocation = (c.location || '').toLowerCase().includes(q);
        const matchCreator = (c.created_by_name || c.officer_name || '').toLowerCase().includes(q);
        const matchBadge = (c.created_by_badge || c.badge_number || '').toLowerCase().includes(q);
        const matchSuspect = (c.suspect_name || '').toLowerCase().includes(q);
        const matchHelper = c.helpers?.some((h) => h.officer_name?.toLowerCase().includes(q) || h.badge_number?.includes(q));

        if (!matchNumber && !matchTitle && !matchLocation && !matchCreator && !matchBadge && !matchSuspect && !matchHelper) {
          return false;
        }
      }

      // 2. Type Filter
      if (caseTypeFilter !== 'ALL') {
        const isNormal = c.type === 'NORMAL' || c.case_type === 'Normal';
        const isTake2 = c.type === 'TAKE2' || c.case_type === 'Take2';
        const isRed = c.type === 'RED_CASE' || c.case_type === 'Red';

        if (caseTypeFilter === 'NORMAL' && !isNormal) return false;
        if (caseTypeFilter === 'TAKE2' && !isTake2) return false;
        if (caseTypeFilter === 'RED_CASE' && !isRed) return false;
      }

      // 3. Officer Filter
      if (caseOfficerFilter !== 'ALL') {
        const isCreator = c.created_by === caseOfficerFilter || c.officer_discord_id === caseOfficerFilter;
        const isHelper = c.helpers?.some((h) => h.user_id === caseOfficerFilter || (h as any).discord_id === caseOfficerFilter);
        if (!isCreator && !isHelper) return false;
      }

      // 4. Status Filter
      if (caseStatusFilter !== 'ALL') {
        const s = c.status || 'OPEN';
        if (s !== caseStatusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [cases, searchCase, caseTypeFilter, caseOfficerFilter, caseStatusFilter]);

  const handleExportAuditCSV = () => {
    const headers = ["ID,Timestamp,Admin,Action_Type,Details,Target_User"];
    const rows = auditLogs.map(l => 
      `"${l.id}","${l.timestamp}","${l.admin_name}","${l.action_type}","${l.action_details.replace(/"/g, '""')}","${l.target_user || ''}"`
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ATPD_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const handleOpenAddOfficerModal = () => {
    const nextBadge = getLowestAvailableBadge(officers);
    setBadgeNumber(nextBadge);
    setOfficerName('');
    setRank('นักเรียนตำรวจ');
    setRole('Member');
    setDepartment('Patrol Division');
    setDiscordId('');
    setShowAddOfficerModal(true);
  };

  const handleSaveNewOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    onAddOfficer({
      officer_name: officerName.trim(),
      badge_number: badgeNumber.padStart(2, '0'),
      rank,
      role,
      department,
      discord_id: discordId || `${Date.now()}`
    });
    setShowAddOfficerModal(false);
    setOfficerName('');
    setBadgeNumber('');
  };

  const handleSaveEditOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer) return;
    onUpdateOfficer(editingOfficer.discord_id, editingOfficer);
    setEditingOfficer(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Admin Clearance Alert Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gradient-to-r from-rose-950/70 via-amber-950/40 to-slate-900 border border-rose-500/50 text-xs shadow-sm">
        <div className="flex items-center space-x-2 text-rose-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="uppercase tracking-wider">ADMIN COMMAND &bull; ศูนย์บัญชาการสถานีและบันทึกประวัติ AUDIT LOGS</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-rose-600/80 text-white font-mono text-[10px] font-bold">
          ADMIN CLEARANCE
        </span>
      </div>

      {/* Header Banner */}
      <div className="bento-card bento-card-crimson p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <AnimatedLogo size="md" animate={true} floating={true} colorCycling={true} spectrumSpeed={8} />
          <div>
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-black uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>COMMAND CENTER & SYSTEM AUDIT</span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              ศูนย์ควบคุมสถานี & ประวัติการทำงาน (Admin Control Center)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              จัดการบุคลากร, สถิติรวมทั้งสถานีตำรวจ, ปรับบทบาทสิทธิ์การใช้งาน, และบันทึก Audit Logs อย่างละเอียด
            </p>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-xl border border-rose-800/40 text-xs shadow-inner gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            ภาพรวมสถานี
          </button>
          <button
            onClick={() => setActiveTab('edit_requests')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'edit_requests' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>คำร้องขอแก้ไขคดี</span>
            {caseEditRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {caseEditRequests.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'cases' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ประวัติคดีทุกคน ({cases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'roster' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            รายชื่อตำรวจ ({officers.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'admins' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-amber-400 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>ตั้งค่าผู้ดูแล (Discord ID) ({adminDiscordIds.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Station Overview Metrics */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bento-card bento-card-blue p-4 shadow-md">
              <span className="text-xs text-slate-400 font-medium">เจ้าหน้าที่ทั้งหมด</span>
              <div className="text-3xl font-black font-mono text-white mt-1">{totalOfficers} นาย</div>
              <p className="text-[11px] text-emerald-400 font-bold mt-1">กำลังเข้าเวร: {onDutyCount} นาย (10-8)</p>
            </div>

            <div className="bento-card bento-card-emerald p-4 shadow-md">
              <span className="text-xs text-slate-400 font-medium">ชั่วโมงเข้าเวรรวมสถานี</span>
              <div className="text-3xl font-black font-mono text-emerald-400 mt-1">{totalStationHours.toFixed(1)} ชม.</div>
              <p className="text-[11px] text-slate-500 mt-1">เฉลี่ย {(totalStationHours / totalOfficers).toFixed(1)} ชม./นาย</p>
            </div>

            <div className="bento-card bento-card-gold p-4 shadow-md">
              <span className="text-xs text-slate-400 font-medium">คดีบันทึกสะสม</span>
              <div className="text-3xl font-black font-mono text-amber-300 mt-1">{totalStationCases} เคส</div>
              <p className="text-[11px] text-slate-500 mt-1">
                คดีแดง: {cases.filter(c => c.case_type === 'Red').length} | TAKE2: {cases.filter(c => c.case_type === 'Take2').length}
              </p>
            </div>

            <div className="bento-card bento-card-crimson p-4 shadow-md">
              <span className="text-xs text-slate-400 font-medium">ระบบ Discord Sync</span>
              <div className="text-3xl font-black font-mono text-indigo-400 mt-1">100%</div>
              <p className="text-[11px] text-emerald-400 font-bold mt-1">Webhook Server Connected</p>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="bento-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> การจัดสรรกำลังพลตามแผนก (Department Roster Distribution)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {['High Command', 'Patrol Division', 'SWAT / Special Response', 'Traffic Enforcement', 'Criminal Investigation (CID)'].map((dept) => {
                const deptOfficers = officers.filter(o => o.department === dept);
                const deptHours = deptOfficers.reduce((s, o) => s + o.duty_hours, 0);

                return (
                  <div key={dept} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <p className="font-bold text-amber-300 text-[11px] truncate">{dept}</p>
                    <p className="text-base font-black font-mono text-white">{deptOfficers.length} นาย</p>
                    <p className="text-[10px] text-slate-400">{deptHours.toFixed(1)} ชม. เวรสะสม</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Case Edit Requests Management */}
      {activeTab === 'edit_requests' && (() => {
        const filteredRequests = caseEditRequests.filter((r) => {
          if (editReqStatusFilter !== 'ALL' && r.status !== editReqStatusFilter) return false;
          const q = searchEditReq.toLowerCase().trim();
          if (!q) return true;
          return (
            (r.case_number || '').toLowerCase().includes(q) ||
            (r.original_title || '').toLowerCase().includes(q) ||
            (r.requested_title || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.requester_name || '').toLowerCase().includes(q) ||
            (r.requester_badge || '').includes(q) ||
            r.mentioned_officers?.some(m => m.officer_name.toLowerCase().includes(q) || m.badge_number.includes(q))
          );
        });

        const handleApprove = async (requestId: string) => {
          if (!onApproveEditRequest) return;
          setIsProcessingEditReq(true);
          try {
            await onApproveEditRequest(requestId);
          } finally {
            setIsProcessingEditReq(false);
          }
        };

        const handleConfirmReject = async () => {
          if (!rejectingRequestId || !onRejectEditRequest) return;
          setIsProcessingEditReq(true);
          try {
            await onRejectEditRequest(rejectingRequestId, rejectionReasonInput.trim());
            setRejectingRequestId(null);
            setRejectionReasonInput('');
          } finally {
            setIsProcessingEditReq(false);
          }
        };

        return (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bento-card p-4 space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="ค้นหาด้วยรหัสคดี (CASE-000001), ชื่อคดี, เหตุผล, ชื่อผู้ขอ, หรือ @เจ้าหน้าที่ที่ถูกแท็ก..."
                    value={searchEditReq}
                    onChange={(e) => setSearchEditReq(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {searchEditReq && (
                    <button onClick={() => setSearchEditReq('')} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white cursor-pointer">
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full md:w-auto">
                  {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditReqStatusFilter(st)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editReqStatusFilter === st
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {st === 'ALL' ? 'ทั้งหมด' : st === 'PENDING' ? '⏳ รออนุมัติ' : st === 'APPROVED' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธ'}
                      {st === 'PENDING' && caseEditRequests.filter(r => r.status === 'PENDING').length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
                          {caseEditRequests.filter(r => r.status === 'PENDING').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List of Requests */}
            {filteredRequests.length === 0 ? (
              <div className="bento-card p-12 text-center text-slate-400 text-xs">
                <Edit className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-slate-300">ไม่พบคำร้องขอแก้ไขคดี</p>
                <p className="text-slate-500 mt-0.5">ไม่มีคำร้องขอแก้ไขที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรองในขณะนี้</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredRequests.map((reqItem) => {
                  const targetCase = cases.find(c => c.id === reqItem.case_id || c.case_number === reqItem.case_number);

                  return (
                    <div
                      key={reqItem.id}
                      className="bento-card p-5 space-y-4 border border-slate-800 hover:border-slate-700 transition-all shadow-lg"
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => targetCase && onSelectCase && onSelectCase(targetCase)}
                            className="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 hover:bg-amber-900/80 px-2.5 py-1 rounded-lg border border-amber-800/60 transition-colors flex items-center gap-1.5 cursor-pointer group"
                            title="คลิกเพื่อดูรายละเอียดคดีฉบับเต็ม"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>{reqItem.case_number}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-amber-300 transition-transform group-hover:translate-x-0.5" />
                          </button>

                          <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase ${
                            reqItem.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : reqItem.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            {reqItem.status === 'PENDING' ? '⏳ รอการอนุมัติ (PENDING)' : reqItem.status === 'APPROVED' ? '✅ อนุมัติแล้ว (APPROVED)' : '❌ ปฏิเสธ (REJECTED)'}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>ยื่นเมื่อ: {reqItem.created_at}</span>
                        </span>
                      </div>

                      {/* Content Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 text-xs">
                        <div className="space-y-1">
                          <span className="text-slate-500 text-[11px] font-bold block">ชื่อเดิม (Original Case):</span>
                          <p className="font-bold text-slate-300 line-through decoration-rose-500/60">{reqItem.original_title}</p>
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono border border-slate-800">
                            ประเภทเดิม: {reqItem.original_type}
                          </span>
                        </div>

                        <div className="space-y-1 md:border-l md:border-slate-800 md:pl-3">
                          <span className="text-indigo-400 text-[11px] font-bold block">ชื่อใหม่ที่ขอแก้ไข (Requested Title):</span>
                          <p className="font-bold text-emerald-300">{reqItem.requested_title}</p>
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-mono border border-indigo-800/60 font-bold">
                            ประเภทใหม่: {reqItem.requested_type}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                        <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>เหตุผลในการขอแก้ไข (Reason for Request):</span>
                        </span>
                        <p className="text-slate-200 pl-4">{reqItem.reason}</p>
                      </div>

                      {/* Tagged Officers */}
                      <div className="space-y-1.5 text-xs">
                        <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>เจ้าหน้าที่ที่เกี่ยวข้อง (Tagged Officers):</span>
                        </span>
                        {reqItem.mentioned_officers && reqItem.mentioned_officers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {reqItem.mentioned_officers.map(m => (
                              <div
                                key={m.discord_id}
                                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-indigo-500/40 text-white shadow-sm"
                              >
                                <img
                                  src={m.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                                  alt={m.officer_name}
                                  className="w-4 h-4 rounded-md object-cover ring-1 ring-indigo-500/40"
                                />
                                <span className="font-bold text-indigo-300">@{m.officer_name}</span>
                                <span className="font-mono text-[10px] text-amber-300 font-bold">#{m.badge_number}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/50">
                                  ON_DUTY
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-[11px] italic pl-2">ไม่มีการระบุเจ้าหน้าที่ที่เกี่ยวข้อง</p>
                        )}
                      </div>

                      {/* Requester Bar & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={reqItem.requester_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                            alt={reqItem.requester_name}
                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-amber-500/40"
                          />
                          <div>
                            <span className="text-slate-500 text-[10px]">ผู้ยื่นคำร้อง:</span>
                            <p className="font-bold text-amber-300">
                              {reqItem.requester_name} #{reqItem.requester_badge}
                              <span className="text-slate-400 font-normal ml-1">({reqItem.requester_rank || 'Officer'})</span>
                            </p>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {reqItem.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isProcessingEditReq}
                              onClick={() => {
                                setRejectingRequestId(reqItem.id);
                                setRejectionReasonInput('');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                            >
                              ❌ ปฏิเสธคำร้อง
                            </button>
                            <button
                              type="button"
                              disabled={isProcessingEditReq}
                              onClick={() => handleApprove(reqItem.id)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50"
                            >
                              ✅ อนุมัติคำร้อง
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-[11px] space-y-0.5">
                            <p className="text-slate-400">
                              พิจารณาโดย: <span className="text-white font-bold">{reqItem.reviewed_by_name || 'ผู้ดูแลระบบ'}</span>
                              <span className="text-slate-500 ml-1">({reqItem.reviewed_at})</span>
                            </p>
                            {reqItem.rejection_reason && (
                              <p className="text-rose-400 font-medium">เหตุผลที่ปฏิเสธ: {reqItem.rejection_reason}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reject Reason Prompt Modal */}
            {rejectingRequestId && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-black text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>ปฏิเสธคำร้องขอแก้ไขคดี</span>
                    </h3>
                    <button
                      onClick={() => setRejectingRequestId(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-slate-300">
                    กรุณาระบุเหตุผลในการปฏิเสธคำร้อง เพื่อแจ้งให้เจ้าหน้าที่ผู้ยื่นคำร้องทราบ:
                  </p>

                  <textarea
                    rows={3}
                    autoFocus
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="เช่น ข้อมูลคดียังไม่ถูกต้อง, เอกสารไม่ครบถ้วน..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-rose-500 focus:outline-none"
                  />

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRejectingRequestId(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingEditReq}
                      onClick={handleConfirmReject}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-950/50 cursor-pointer disabled:opacity-50"
                    >
                      ยืนยันการปฏิเสธ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: Station Cases Audit (Admin Inspection & Delete) */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="bento-card p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วยรหัสคดี (CASE-000001), ชื่อตำรวจ, เลขประจำตัว, ข้อหา, ผู้ต้องหา หรือสถานที่..."
                  value={searchCase}
                  onChange={(e) => setSearchCase(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchCase && (
                  <button onClick={() => setSearchCase('')} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white">
                    ✕
                  </button>
                )}
              </div>

              {/* Officer Filter Dropdown */}
              <div className="w-full md:w-60">
                <select
                  value={caseOfficerFilter}
                  onChange={(e) => setCaseOfficerFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="ALL">👮 เจ้าหน้าที่ทุกคน (All Officers)</option>
                  {officers.map(o => (
                    <option key={o.discord_id} value={o.discord_id}>
                      #{o.badge_number} {o.officer_name} ({o.rank})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter Dropdown */}
              <div className="w-full md:w-44">
                <select
                  value={caseStatusFilter}
                  onChange={(e) => setCaseStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="ALL">ทุกสถานะ (All Status)</option>
                  <option value="OPEN">● OPEN (รับเรื่อง)</option>
                  <option value="IN_PROGRESS">● IN_PROGRESS (ดำเนินคดี)</option>
                  <option value="RESOLVED">● RESOLVED (ปิดคดีสำเร็จ)</option>
                  <option value="CLOSED">● CLOSED (จำหน่ายคดี)</option>
                </select>
              </div>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">ประเภทคดี:</span>
              <button
                onClick={() => setCaseTypeFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  caseTypeFilter === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ทั้งหมด ({cases.length})
              </button>
              <button
                onClick={() => setCaseTypeFilter('NORMAL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  caseTypeFilter === 'NORMAL' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-blue-300 hover:text-white border border-slate-800'
                }`}
              >
                🔵 เคสปกติ ({cases.filter(c => c.type === 'NORMAL' || c.case_type === 'Normal').length})
              </button>
              <button
                onClick={() => setCaseTypeFilter('TAKE2')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  caseTypeFilter === 'TAKE2' ? 'bg-amber-600 text-slate-950 shadow-md' : 'bg-slate-900 text-amber-300 hover:text-white border border-slate-800'
                }`}
              >
                🟡 Take2 ({cases.filter(c => c.type === 'TAKE2' || c.case_type === 'Take2').length})
              </button>
              <button
                onClick={() => setCaseTypeFilter('RED_CASE')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  caseTypeFilter === 'RED_CASE' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
                }`}
              >
                🔴 คดีแดง ({cases.filter(c => c.type === 'RED_CASE' || c.case_type === 'Red').length})
              </button>
            </div>
          </div>

          {/* Cases List */}
          {filteredAdminCases.length === 0 ? (
            <div className="bento-card p-12 text-center text-slate-400 space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-bold text-sm text-white">ไม่พบคดีตามเงื่อนไขที่ระบุ</p>
              <p className="text-xs">สามารถค้นหาด้วยชื่อตำรวจ, รหัสคดี หรือเปลี่ยนตัวกรอง</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                <span>แสดงคดีทั้งหมด: <strong className="text-white">{filteredAdminCases.length}</strong> คดี</span>
                <span className="text-amber-400 font-mono text-[11px]">⚡ Admin Power: สามารถตรวจเช็คและกดลบคดีที่ไม่ถูกต้องได้</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredAdminCases.map((c) => {
                  const isNormal = c.type === 'NORMAL' || c.case_type === 'Normal';
                  const isTake2 = c.type === 'TAKE2' || c.case_type === 'Take2';
                  const isRed = c.type === 'RED_CASE' || c.case_type === 'Red';
                  const imagesCount = c.images?.length || 0;
                  const helpersCount = c.helpers?.length || 0;

                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelectCase && onSelectCase(c)}
                      className="p-4 rounded-2xl bg-[#0a0f1c] border border-slate-800 hover:border-amber-500/60 shadow-lg transition-all cursor-pointer group space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-amber-300 border border-slate-700">
                            {c.case_number || c.id}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isRed ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                            isTake2 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {isRed ? '🔴 คดีแดง' : isTake2 ? '🟡 Take2' : '🔵 เคสปกติ'}
                          </span>

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            ● {c.status || 'OPEN'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {imagesCount > 0 && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 text-blue-300 text-[11px] font-mono border border-slate-800">
                              <ImageIcon className="w-3 h-3 text-blue-400" />
                              <span>{imagesCount} ภาพ</span>
                            </span>
                          )}

                          {onDeleteCase && (
                            <button
                              type="button"
                              title="ลบคดีออกจากระบบ"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCase(c.id);
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100 border border-rose-800 text-xs font-bold transition-colors cursor-pointer shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>ลบคดี</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectCase) onSelectCase(c);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition-colors cursor-pointer shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>เปิดดู</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {c.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                          <span className="flex items-center space-x-1 text-slate-300">
                            <strong>ผู้ลงคดี:</strong>
                            <span>{c.created_by_name || c.officer_name}</span>
                            <span className="text-amber-300 font-mono font-bold">#{c.created_by_badge || c.badge_number}</span>
                          </span>

                          <span className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{c.incident_date || c.created_at || c.timestamp} {c.incident_time ? `(${c.incident_time})` : ''}</span>
                          </span>

                          {c.location && (
                            <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                              <MapPin className="w-3 h-3 text-rose-400/80" />
                              <span>{c.location}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {helpersCount > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60 text-[11px]">
                          <span className="text-slate-500 font-semibold">ผู้ช่วยร่วมปฏิบัติงาน:</span>
                          {c.helpers?.map((h) => (
                            <span key={h.id || h.user_id} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                              @{h.officer_name} <strong className="text-amber-300">#{h.badge_number}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Personnel Roster Management */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="bento-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัสวิทยุ, ยศ, แผนก..."
                value={searchRoster}
                onChange={(e) => setSearchRoster(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Check Officer Existence Button */}
              <button
                onClick={() => setShowCheckerModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="ตรวจสอบว่ารายชื่อนี้มีอยู่ในระบบสถานีแล้วหรือไม่"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>ตรวจสอบรายชื่อ</span>
              </button>

              {/* Manual Reorder A-Z Button */}
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
                  className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                  title="จัดเรียง A-Z และรันเลขวิทยุใหม่อัตโนมัติ"
                >
                  <SortAsc className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isReordering ? 'กำลังจัดเรียง...' : 'จัดเรียง A-Z'}</span>
                </button>
              )}

              {/* AI OCR Image Upload Button */}
              <button
                onClick={() => setShowOCRModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>สแกนรูปรายชื่อ</span>
              </button>

              {/* Manual Add Officer */}
              <button
                onClick={handleOpenAddOfficerModal}
                className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายนาย</span>
              </button>
            </div>
          </div>

          {/* Officers Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-[#0d121c]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3 text-center">Badge</th>
                  <th className="py-3 px-4">เจ้าหน้าที่</th>
                  <th className="py-3 px-3">ยศ</th>
                  <th className="py-3 px-3">สิทธิ์ Role</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-3 text-right">ชม.เวร</th>
                  <th className="py-3 px-3 text-right">คดีสะสม</th>
                  <th className="py-3 px-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredOfficers.map((o) => (
                  <tr key={o.discord_id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                      #{o.badge_number}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img src={o.avatar} alt={o.officer_name} className="w-7 h-7 rounded-md object-cover" />
                        <div>
                          <p className="font-bold text-white">{o.officer_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">ID: {o.discord_id.slice(0, 10)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-300">{o.rank}</td>
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'On Duty' || o.status === 'In Action'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{o.duty_hours}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300 font-bold">{o.total_cases}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setEditingOfficer({ ...o })}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: System Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bento-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="ค้นหาประวัติการทำงาน Admin, ผู้กระทำ..."
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleExportAuditCSV}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>ส่งออก Audit Logs (CSV)</span>
            </button>
          </div>

          {/* Audit Logs Stream */}
          <div className="space-y-2.5">
            {filteredAuditLogs.map((log) => (
              <div key={log.id} className="bento-card p-3.5 flex items-start justify-between text-xs space-y-1 sm:space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950 font-mono text-[10px] text-amber-400 font-bold border border-slate-800">
                      {log.action_type}
                    </span>
                    <span className="font-bold text-white">{log.admin_name}</span>
                    {log.target_user && (
                      <span className="text-slate-400 text-[11px]">&rarr; {log.target_user}</span>
                    )}
                  </div>
                  <p className="text-slate-300 text-xs">{log.action_details}</p>
                </div>

                <span className="font-mono text-[10px] text-slate-500 shrink-0">{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Admin Discord IDs Management */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {adminMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold border flex items-center justify-between ${
              adminMsg.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}>
              <span>{adminMsg.text}</span>
              <button onClick={() => setAdminMsg(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Add Admin Discord ID Form */}
          <div className="bento-card p-6 space-y-4">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Key className="w-4 h-4" />
              <span>เพิ่มสิทธิ์ผู้ดูแลระบบด้วย Discord ID (Add Administrator by Discord ID)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ผู้ใช้ที่ถือ Discord ID เหล่านี้ เมื่อล็อกอินผ่าน Discord OAuth2 จะได้รับสิทธิ์ <strong>Leader / Admin</strong> และสังกัด <strong>High Command</strong> อัตโนมัติทันที
            </p>

            <form onSubmit={handleAddAdminId} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={newAdminDiscordId}
                  onChange={(e) => setNewAdminDiscordId(e.target.value)}
                  placeholder="ใส่ Discord User ID เช่น 89230192830192019 หรือ 123456789012345678"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingAdminId || !newAdminDiscordId.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shrink-0"
              >
                <Crown className="w-4 h-4" />
                <span>{isSubmittingAdminId ? 'กำลังบันทึก...' : 'เพิ่ม Discord ID ผู้ดูแล'}</span>
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="text-amber-300 font-bold">💡 วิธีหา Discord User ID:</p>
              <p>1. เปิด Discord &gt; การตั้งค่าผู้ใช้ (User Settings) &gt; ขั้นสูง (Advanced) &gt; เปิด <strong>โหมดนักพัฒนา (Developer Mode)</strong></p>
              <p>2. คลิกขวาที่ชื่อผู้ใช้หรือโปรไฟล์ใน Discord &gt; เลือก <strong>"คัดลอก ID ผู้ใช้" (Copy User ID)</strong></p>
              <p>3. คุณยังสามารถกำหนดค่าถาวรผ่านไฟล์ <code>.env</code> ของเซิร์ฟเวอร์ได้โดยใส่: <code>DISCORD_ADMIN_IDS=id1,id2</code></p>
            </div>
          </div>

          {/* Current Admin Discord IDs List */}
          <div className="bento-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" /> รายชื่อ Discord ID ผู้ดูแลระบบในปัจจุบัน ({adminDiscordIds.length})
              </span>
              <button
                onClick={fetchAdminIds}
                className="text-xs text-amber-400 hover:text-amber-300 font-normal cursor-pointer"
              >
                รีเฟรช
              </button>
            </h3>

            {adminDiscordIds.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <Crown className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-bold">ยังไม่มีการกำหนด Discord ID ของผู้ดูแลระบบ</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  กรุณาเพิ่ม Discord ID ด้านบน หรือกำหนดค่าตัวแปรสภาพแวดล้อม <code>DISCORD_ADMIN_IDS</code> ใน .env ของเซิร์ฟเวอร์
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {adminDiscordIds.map((id) => {
                  const matchedOfficer = officers.find(o => o.discord_id === id);
                  const isCurrent = currentUser?.discord_id === id;

                  return (
                    <div
                      key={id}
                      className={`p-4 rounded-xl border flex items-center justify-between space-x-3 transition-all ${
                        isCurrent
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {matchedOfficer ? (
                          <img
                            src={matchedOfficer.avatar}
                            alt={matchedOfficer.officer_name}
                            className="w-10 h-10 rounded-xl object-cover ring-1 ring-amber-500/50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
                            <Crown className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-xs font-bold text-white truncate">
                              {matchedOfficer ? matchedOfficer.officer_name : 'รอเข้าสู่ระบบ (Pending Login)'}
                            </p>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-slate-950">
                                คุณ
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-amber-300/80 truncate">
                            Discord ID: {id}
                          </p>
                          {matchedOfficer && (
                            <p className="text-[10px] text-slate-400">
                              {matchedOfficer.rank}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveAdminId(id)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition-colors cursor-pointer shrink-0"
                        title="ลบสิทธิ์ผู้ดูแลระบบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Officer Modal */}
      {showAddOfficerModal && (() => {
        const parsedBadge = parseInt(badgeNumber, 10);
        const formattedBadge = !isNaN(parsedBadge) ? (parsedBadge < 10 ? `0${parsedBadge}` : `${parsedBadge}`) : badgeNumber;
        const occupiedOfficer = officers.find(o => {
          const oInt = parseInt(o.badge_number, 10);
          return (!isNaN(oInt) && !isNaN(parsedBadge) && oInt === parsedBadge) || o.badge_number === badgeNumber;
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
                <button onClick={() => setShowAddOfficerModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleSaveNewOfficer} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ชื่อ-นามสกุล เจ้าหน้าที่</label>
                  <input
                    type="text"
                    required
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
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
                        onClick={() => setBadgeNumber(lowestVacant)}
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
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
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
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
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
                      onClick={() => setBadgeNumber(lowestVacant)}
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
                      value={rank}
                      onChange={(e: any) => setRank(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="ผู้บัญชาการตำรวจ">ผู้บัญชาการตำรวจ</option>
                      <option value="รองผู้บัญชาการตำรวจ">รองผู้บัญชาการตำรวจ</option>
                      <option value="ครูฝึก">ครูฝึก</option>
                      <option value="สารวัตร">สารวัตร</option>
                      <option value="หมวด">หมวด</option>
                      <option value="จ่า">จ่า</option>
                      <option value="นักเรียนตำรวจ">นักเรียนตำรวจ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">สิทธิ์ (Role)</label>
                    <select
                      value={role}
                      onChange={(e: any) => setRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Member">Member (เจ้าหน้าที่ทั่วไป)</option>
                      <option value="Admin">Admin (ผู้ดูแล)</option>
                      <option value="Leader">Leader (หัวหน้าหน่วยงาน)</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddOfficerModal(false)}
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

      {/* Edit Officer Modal */}
      {editingOfficer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">แก้ไขข้อมูล: {editingOfficer.officer_name}</h3>
              <button onClick={() => setEditingOfficer(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEditOfficer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">ชื่อเจ้าหน้าที่</label>
                <input
                  type="text"
                  value={editingOfficer.officer_name}
                  onChange={(e) => setEditingOfficer({ ...editingOfficer, officer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ยศ</label>
                  <select
                    value={editingOfficer.rank}
                    onChange={(e: any) => setEditingOfficer({ ...editingOfficer, rank: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ผู้บัญชาการตำรวจ">ผู้บัญชาการตำรวจ</option>
                    <option value="รองผู้บัญชาการตำรวจ">รองผู้บัญชาการตำรวจ</option>
                    <option value="ครูฝึก">ครูฝึก</option>
                    <option value="สารวัตร">สารวัตร</option>
                    <option value="หมวด">หมวด</option>
                    <option value="จ่า">จ่า</option>
                    <option value="นักเรียนตำรวจ">นักเรียนตำรวจ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">สิทธิ์ Role</label>
                  <select
                    value={editingOfficer.role}
                    onChange={(e: any) => setEditingOfficer({ ...editingOfficer, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
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
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Discord ID</label>
                  <input
                    type="text"
                    value={editingOfficer.discord_id || ''}
                    onChange={(e) => setEditingOfficer({ ...editingOfficer, discord_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
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
        onImportSuccess={(msg) => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Officer Existence Checker Modal */}
      <OfficerExistenceCheckerModal
        isOpen={showCheckerModal}
        onClose={() => setShowCheckerModal(false)}
        allOfficers={officers}
        onAddOfficerQuick={(name) => {
          setOfficerName(name);
          setBadgeNumber(`${officers.length + 1}`.padStart(2, '0'));
          setShowAddOfficerModal(true);
        }}
        onRefreshData={onRefreshData}
      />

    </div>
  );
};
