import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  PlusCircle, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Image as ImageIcon, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpDown, 
  Eye, 
  UserCheck, 
  User,
  Trash2,
  Shield,
  Lock
} from 'lucide-react';
import { CaseLog, Officer, CaseType, CaseStatus } from '../types';

interface CaseHistoryViewProps {
  currentUser: Officer | null;
  cases: CaseLog[];
  onSelectCase: (caseItem: CaseLog) => void;
  onNavigateToCreate: () => void;
  onUpdateStatus?: (caseId: string, status: CaseStatus) => void;
  onDeleteCase?: (caseId: string) => void;
}

export const CaseHistoryView: React.FC<CaseHistoryViewProps> = ({
  currentUser,
  cases,
  onSelectCase,
  onNavigateToCreate,
  onUpdateStatus,
  onDeleteCase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'NORMAL' | 'TAKE2' | 'RED_CASE'>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'MY_CASES' | 'TAGGED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CaseStatus>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Leader';

  // Base list of cases visible to the current user
  // Standard user only sees cases they participated in (creator or helper)
  // Admin sees all cases in the station for auditing and checking
  const baseVisibleCases = useMemo(() => {
    if (isAdmin) {
      return cases;
    }
    if (!currentUser) return [];
    return cases.filter((c) => {
      const isCreator = c.created_by === currentUser.discord_id || c.officer_discord_id === currentUser.discord_id;
      const isHelper = c.helpers?.some((h) => h.user_id === currentUser.discord_id || (h as any).discord_id === currentUser.discord_id);
      return isCreator || isHelper;
    });
  }, [cases, currentUser, isAdmin]);

  // Compute summary stats based on visible cases
  const stats = useMemo(() => {
    const total = baseVisibleCases.length;
    const normal = baseVisibleCases.filter((c) => c.type === 'NORMAL' || c.case_type === 'Normal').length;
    const take2 = baseVisibleCases.filter((c) => c.type === 'TAKE2' || c.case_type === 'Take2').length;
    const red = baseVisibleCases.filter((c) => c.type === 'RED_CASE' || c.case_type === 'Red').length;
    const myCases = currentUser
      ? baseVisibleCases.filter((c) => c.created_by === currentUser.discord_id || c.officer_discord_id === currentUser.discord_id).length
      : 0;
    const tagged = currentUser
      ? baseVisibleCases.filter((c) => c.helpers?.some((h) => h.user_id === currentUser.discord_id || (h as any).discord_id === currentUser.discord_id)).length
      : 0;

    return { total, normal, take2, red, myCases, tagged };
  }, [baseVisibleCases, currentUser]);

  // Filtered and sorted cases list
  const filteredCases = useMemo(() => {
    return baseVisibleCases.filter((c) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchNumber = (c.case_number || '').toLowerCase().includes(q);
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchLocation = (c.location || '').toLowerCase().includes(q);
        const matchCreator = (c.created_by_name || c.officer_name || '').toLowerCase().includes(q);
        const matchBadge = (c.created_by_badge || c.badge_number || '').toLowerCase().includes(q);
        const matchHelper = c.helpers?.some((h) => h.officer_name.toLowerCase().includes(q) || h.badge_number.includes(q));

        if (!matchNumber && !matchTitle && !matchLocation && !matchCreator && !matchBadge && !matchHelper) {
          return false;
        }
      }

      // 2. Type Filter
      if (typeFilter !== 'ALL') {
        const isNormal = c.type === 'NORMAL' || c.case_type === 'Normal';
        const isTake2 = c.type === 'TAKE2' || c.case_type === 'Take2';
        const isRed = c.type === 'RED_CASE' || c.case_type === 'Red';

        if (typeFilter === 'NORMAL' && !isNormal) return false;
        if (typeFilter === 'TAKE2' && !isTake2) return false;
        if (typeFilter === 'RED_CASE' && !isRed) return false;
      }

      // 3. Ownership Filter
      if (currentUser) {
        if (ownershipFilter === 'MY_CASES') {
          const isMine = c.created_by === currentUser.discord_id || c.officer_discord_id === currentUser.discord_id;
          if (!isMine) return false;
        } else if (ownershipFilter === 'TAGGED') {
          const isTagged = c.helpers?.some((h) => h.user_id === currentUser.discord_id || (h as any).discord_id === currentUser.discord_id);
          if (!isTagged) return false;
        }
      }

      // 4. Status Filter
      if (statusFilter !== 'ALL') {
        const itemStatus = c.status || 'OPEN';
        if (itemStatus !== statusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
    });
  }, [baseVisibleCases, searchQuery, typeFilter, ownershipFilter, statusFilter, sortOrder, currentUser]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1627] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest text-blue-400 uppercase">
                {isAdmin ? 'ALL STATION CASE ARCHIVE (ADMIN AUDIT)' : 'PARTICIPATED CASES & RECORDS'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {isAdmin ? 'ประวัติการลงคดีทุกคน (Admin Case Audit)' : 'ประวัติการลงเคสของคุณ (My Participated Cases)'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
              {isAdmin 
                ? 'โหมดผู้ดูแลระบบ: แสดงประวัติคดีของทุกคนในสถานีเพื่อการตรวจเช็คความถูกต้อง และสามารถจัดการลบคดีที่ไม่ถูกต้องได้'
                : 'แสดงเฉพาะคดีที่คุณมีส่วนร่วม (คดีที่คุณเป็นผู้ลงบันทึก หรือ เป็นผู้ช่วยที่ถูกแท็กในคดี)'
              }
            </p>

            {/* Role scope badge */}
            <div className="mt-3 flex items-center gap-2">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>ADMIN CLEARANCE: แสดงประวัติคดีของทุกคน (ลบคดีได้)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>แสดงเฉพาะคดีที่คุณมีส่วนร่วม (ผู้ลงคดี / ผู้ช่วยเหลือ)</span>
                </span>
              )}
            </div>
          </div>

          <button
            id="history-create-case-btn"
            onClick={onNavigateToCreate}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-blue-950/60 border border-blue-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>➕ ลงเคสใหม่ (Create Case)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Total Cases */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">คดีทั้งหมด</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-mono font-black text-white mt-2">{stats.total}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">ในระบบสถานี</p>
        </div>

        {/* Normal Cases */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-300">เคสปกติ</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-mono font-black text-blue-400 mt-2">{stats.normal}</p>
          <p className="text-[10px] text-blue-300/70 mt-0.5">฿1,000 / เคส</p>
        </div>

        {/* Take2 Cases */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">Take2</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-mono font-black text-amber-400 mt-2">{stats.take2}</p>
          <p className="text-[10px] text-amber-300/70 mt-0.5">฿2,500 / เคส</p>
        </div>

        {/* Red Cases */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">คดีแดง</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-mono font-black text-rose-400 mt-2">{stats.red}</p>
          <p className="text-[10px] text-rose-300/70 mt-0.5">฿5,000 / เคส</p>
        </div>

        {/* My Cases */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">เคสของฉัน</span>
            <User className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-black text-emerald-400 mt-2">{stats.myCases}</p>
          <p className="text-[10px] text-emerald-300/70 mt-0.5">ที่คุณเป็นผู้ลง</p>
        </div>

        {/* Tagged As Helper */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300">ถูกแท็กช่วย</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-mono font-black text-indigo-400 mt-2">{stats.tagged}</p>
          <p className="text-[10px] text-indigo-300/70 mt-0.5">ผู้ร่วมปฏิบัติงาน</p>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        
        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              id="case-history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาด้วยรหัสคดี (CASE-000001), หัวข้อ, สถานที่, หรือชื่อตำรวจ..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus:border-blue-500 text-white placeholder-slate-500 text-xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder((prev) => (prev === 'NEWEST' ? 'OLDEST' : 'NEWEST'))}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>{sortOrder === 'NEWEST' ? 'ล่าสุดก่อน (Newest)' : 'เก่าสุดก่อน (Oldest)'}</span>
          </button>

        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          
          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-slate-500 text-[11px] mr-1 hidden sm:inline">ประเภท:</span>
            
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>

            <button
              onClick={() => setTypeFilter('NORMAL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                typeFilter === 'NORMAL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-900 text-blue-300 hover:text-white border border-slate-800'
              }`}
            >
              🔵 ปกติ ({stats.normal})
            </button>

            <button
              onClick={() => setTypeFilter('TAKE2')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                typeFilter === 'TAKE2'
                  ? 'bg-amber-600 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-amber-300 hover:text-white border border-slate-800'
              }`}
            >
              🟡 Take2 ({stats.take2})
            </button>

            <button
              onClick={() => setTypeFilter('RED_CASE')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                typeFilter === 'RED_CASE'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
              }`}
            >
              🔴 คดีแดง ({stats.red})
            </button>
          </div>

          {/* Ownership Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] mr-1 hidden md:inline">สิทธิ์:</span>
            
            <button
              onClick={() => setOwnershipFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold ${
                ownershipFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              เคสทั้งหมด
            </button>

            <button
              onClick={() => setOwnershipFilter('MY_CASES')}
              className={`px-2.5 py-1 rounded-lg font-semibold ${
                ownershipFilter === 'MY_CASES'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-emerald-300'
              }`}
            >
              เคสของฉัน ({stats.myCases})
            </button>

            <button
              onClick={() => setOwnershipFilter('TAGGED')}
              className={`px-2.5 py-1 rounded-lg font-semibold ${
                ownershipFilter === 'TAGGED'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900/60 text-slate-400 hover:text-indigo-300'
              }`}
            >
              ที่ถูกแท็ก ({stats.tagged})
            </button>
          </div>

        </div>

      </div>

      {/* Cases List / Grid */}
      {filteredCases.length === 0 ? (
        <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">ไม่พบคดีตามเงื่อนไขที่เลือก</h3>
            <p className="text-slate-400 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่มลงเคสใหม่เพื่อสร้างคดีแรกในระบบ</p>
          </div>
          <button
            onClick={onNavigateToCreate}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>ลงเคสใหม่ตอนนี้</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span>แสดงรายการคดี: <strong className="text-white">{filteredCases.length}</strong> คดี</span>
            <span>คลิกที่การ์ดเพื่อดูรายละเอียด ภาพหลักฐาน และไทม์ไลน์</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {filteredCases.map((c) => {
              const isNormal = c.type === 'NORMAL' || c.case_type === 'Normal';
              const isTake2 = c.type === 'TAKE2' || c.case_type === 'Take2';
              const isRed = c.type === 'RED_CASE' || c.case_type === 'Red';
              const imagesCount = c.images?.length || 0;
              const helpersCount = c.helpers?.length || 0;
              const isCreator = currentUser && (c.created_by === currentUser.discord_id || c.officer_discord_id === currentUser.discord_id);
              const isHelper = currentUser && c.helpers?.some((h) => h.user_id === currentUser.discord_id);

              return (
                <div
                  key={c.id}
                  id={`case-card-${c.id}`}
                  onClick={() => onSelectCase(c)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden bg-[#0a0f1c] hover:bg-[#0e1628] ${
                    isRed
                      ? 'border-rose-900/60 hover:border-rose-500/80 shadow-rose-950/20'
                      : isTake2
                      ? 'border-amber-900/60 hover:border-amber-500/80 shadow-amber-950/20'
                      : 'border-slate-800 hover:border-blue-500/80 shadow-black/30'
                  } shadow-lg hover:scale-[1.005]`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    
                    {/* Left Column: Badges, Title, Creator */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        
                        {/* Case Number */}
                        <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-amber-300 border border-slate-700">
                          {c.case_number || c.id}
                        </span>

                        {/* Case Type Badge */}
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 uppercase ${
                          isRed
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isTake2
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}>
                          {isRed ? (
                            <>
                              <Flame className="w-3 h-3 text-rose-400" />
                              <span>คดีแดง (RED)</span>
                            </>
                          ) : isTake2 ? (
                            <>
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              <span>TAKE2</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3 text-blue-400" />
                              <span>เคสปกติ (NORMAL)</span>
                            </>
                          )}
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : c.status === 'IN_PROGRESS'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : c.status === 'CLOSED'
                            ? 'bg-slate-700/50 text-slate-300 border border-slate-600'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        }`}>
                          ● {c.status || 'OPEN'}
                        </span>

                        {/* My Case Pill */}
                        {isCreator && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                            เคสที่คุณลง
                          </span>
                        )}

                        {/* Tagged Helper Pill */}
                        {isHelper && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-600/40">
                            คุณเป็นผู้ช่วยเหลือ
                          </span>
                        )}
                      </div>

                      {/* Case Title */}
                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {c.title}
                      </h3>

                      {/* Metadata Row: Creator, Date, Location */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                        
                        {/* Creator */}
                        <div className="flex items-center space-x-1.5">
                          <img
                            src={c.created_by_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                            alt={c.created_by_name || c.officer_name}
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-700"
                          />
                          <span className="font-semibold text-slate-200">
                            {c.created_by_name || c.officer_name}
                          </span>
                          <span className="text-[10px] font-mono text-amber-300 font-bold">
                            #{c.created_by_badge || c.badge_number}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.incident_date || c.created_at || c.timestamp} {c.incident_time ? `(${c.incident_time})` : ''}</span>
                        </div>

                        {/* Location */}
                        {c.location && (
                          <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-rose-400/80" />
                            <span className="truncate max-w-[180px]">{c.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Tagged Helpers Preview */}
                      {helpersCount > 0 && (
                        <div className="flex items-center space-x-2 pt-1">
                          <span className="text-[10px] text-slate-500 font-semibold">ผู้ช่วยเหลือ:</span>
                          <div className="flex flex-wrap gap-1">
                            {c.helpers?.map((h) => (
                              <span
                                key={h.id || h.user_id}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                              >
                                <span>@{h.officer_name}</span>
                                <span className="font-mono text-amber-300 font-bold">#{h.badge_number}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                      {/* Right Column: Evidence Thumbnails & View Action */}
                      <div className="flex items-center space-x-2.5 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                        
                        {/* Evidence Images Preview Counter */}
                        {imagesCount > 0 ? (
                          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-mono font-bold text-white">{imagesCount}</span>
                            <span className="text-[10px] text-slate-400">รูปภาพ</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 font-mono">ไม่มีรูป</div>
                        )}

                        {/* Delete Case Button (Admin or Creator) */}
                        {onDeleteCase && (isAdmin || isCreator) && (
                          <button
                            type="button"
                            title="ลบคดีนี้ (Delete Case)"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCase(c.id);
                            }}
                            className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-rose-950/90 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-700 text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span className="hidden sm:inline">ลบคดี</span>
                          </button>
                        )}

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c);
                          }}
                          className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-slate-800 group-hover:bg-blue-600 text-slate-200 group-hover:text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>เปิดดูเคส</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                      </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
