import React, { useState, useMemo, useEffect } from 'react';
import { 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  Shield, 
  Send, 
  UserCheck, 
  Filter,
  Sparkles,
  ArrowRight,
  SortAsc,
  Layers,
  Plus,
  PlusCircle,
  Hash,
  Sliders,
  Check,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid
} from 'lucide-react';
import { Officer, BadgeSlot, BadgeRequest } from '../types';
import { RosterImageScannerModal } from './RosterImageScannerModal';
import { OfficerExistenceCheckerModal } from './OfficerExistenceCheckerModal';

interface BadgeManagementViewProps {
  currentUser: Officer;
  badgeSlots: BadgeSlot[];
  badgeRequests: BadgeRequest[];
  allOfficers?: Officer[];
  onRequestBadge: (requestedBadge: string, reason: string) => void;
  onApproveBadge: (requestId: string, reviewNotes?: string) => void;
  onRejectBadge: (requestId: string, reviewNotes?: string) => void;
  onRefreshData?: () => void;
  onReorderAZ?: () => void;
  onExpandSlots?: (additionalSlots?: number, totalSlots?: number) => Promise<any> | void;
}

export const BadgeManagementView: React.FC<BadgeManagementViewProps> = ({
  currentUser,
  badgeSlots,
  badgeRequests,
  allOfficers = [],
  onRequestBadge,
  onApproveBadge,
  onRejectBadge,
  onRefreshData,
  onReorderAZ,
  onExpandSlots
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'Available' | 'Busy' | 'Pending'>('all');
  const [searchBadge, setSearchBadge] = useState('');
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showCheckerModal, setShowCheckerModal] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  
  // Expand Slots Modal State
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandMode, setExpandMode] = useState<'add' | 'set'>('add');
  const [additionalSlotsInput, setAdditionalSlotsInput] = useState<number>(40);
  const [exactTotalSlotsInput, setExactTotalSlotsInput] = useState<number>(badgeSlots.length > 0 ? badgeSlots.length + 40 : 80);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandFeedback, setExpandFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pagination State for Badge Roster (แบ่งหน้าเพื่อไม่ให้ยาวลงไป)
  const [pageSize, setPageSize] = useState<number>(40); // 40 numbers per page (standard batch)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTargetBadge, setSelectedTargetBadge] = useState<string>('');
  const [requestReason, setRequestReason] = useState('');

  // Review Modal State (Leader/Admin)
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<BadgeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const isLeaderOrAdmin = currentUser.role === 'Leader' || currentUser.role === 'Admin';

  const pendingRequests = badgeRequests.filter(r => r.status === 'Pending');
  const historyRequests = badgeRequests.filter(r => r.status !== 'Pending');

  const currentTotalSlots = badgeSlots.length;
  const firstBadge = badgeSlots[0]?.badge_number || '01';
  const lastBadge = badgeSlots[badgeSlots.length - 1]?.badge_number || (currentTotalSlots < 10 ? `0${currentTotalSlots}` : `${currentTotalSlots}`);

  const filteredSlots = useMemo(() => {
    return badgeSlots.filter(slot => {
      const matchStatus = filterStatus === 'all' || slot.status === filterStatus;
      const matchSearch = slot.badge_number.includes(searchBadge) ||
        (slot.assigned_officer?.officer_name.toLowerCase().includes(searchBadge.toLowerCase()) ?? false);
      return matchStatus && matchSearch;
    });
  }, [badgeSlots, filterStatus, searchBadge]);

  // Total pages and pagination slice
  const totalItems = filteredSlots.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  // Auto reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  const endIndex = pageSize > 0 ? Math.min(startIndex + pageSize, totalItems) : totalItems;
  const displayedSlots = useMemo(() => {
    if (pageSize <= 0) return filteredSlots;
    return filteredSlots.slice(startIndex, endIndex);
  }, [filteredSlots, pageSize, startIndex, endIndex]);

  // Page batch range list for quick navigation tabs
  const pageBatches = useMemo(() => {
    if (pageSize <= 0 || totalPages <= 1) return [];
    const batches = [];
    for (let p = 1; p <= totalPages; p++) {
      const sIdx = (p - 1) * pageSize;
      const eIdx = Math.min(sIdx + pageSize, totalItems);
      const firstSlot = filteredSlots[sIdx];
      const lastSlot = filteredSlots[eIdx - 1];
      const batchSlotsList = filteredSlots.slice(sIdx, eIdx);
      const availableCount = batchSlotsList.filter(s => s.status === 'Available').length;
      
      batches.push({
        page: p,
        label: `หน้า ${p}`,
        badgeRange: firstSlot && lastSlot ? `#${firstSlot.badge_number} - #${lastSlot.badge_number}` : `รายการ ${sIdx + 1}-${eIdx}`,
        count: eIdx - sIdx,
        availableCount
      });
    }
    return batches;
  }, [filteredSlots, pageSize, totalPages, totalItems]);

  // Calculate preview values for the expansion modal
  const calcNewTotal = expandMode === 'add' 
    ? currentTotalSlots + (Math.max(1, Number(additionalSlotsInput) || 0))
    : Math.max(1, Number(exactTotalSlotsInput) || currentTotalSlots);

  const calcAddedDiff = calcNewTotal - currentTotalSlots;

  const handleOpenExpandModal = () => {
    setExpandMode('add');
    setAdditionalSlotsInput(40);
    setExactTotalSlotsInput(currentTotalSlots + 40);
    setExpandFeedback(null);
    setShowExpandModal(true);
  };

  const handleConfirmExpandSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExpanding(true);
    setExpandFeedback(null);

    try {
      if (onExpandSlots) {
        if (expandMode === 'add') {
          await onExpandSlots(Number(additionalSlotsInput), undefined);
        } else {
          await onExpandSlots(undefined, Number(exactTotalSlotsInput));
        }
      } else {
        const payload = expandMode === 'add' 
          ? { additional_slots: Number(additionalSlotsInput) }
          : { total_slots: Number(exactTotalSlotsInput) };
        
        const res = await fetch('/api/badges/expand-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'เกิดข้อผิดพลาดในการเพิ่มเลขวิทยุ');
        }
        if (onRefreshData) onRefreshData();
      }

      setExpandFeedback({
        type: 'success',
        text: `เพิ่มจำนวนเลขวิทยุสำเร็จ รวมเป็น ${calcNewTotal} หมายเลข เรียบร้อยแล้ว`
      });

      setTimeout(() => {
        setShowExpandModal(false);
        setIsExpanding(false);
      }, 1000);
    } catch (err: any) {
      setExpandFeedback({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการบันทึก'
      });
      setIsExpanding(false);
    }
  };

  const handleOpenRequest = (badgeNum: string) => {
    setSelectedTargetBadge(badgeNum);
    setRequestReason('');
    setShowRequestModal(true);
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetBadge) return;
    onRequestBadge(selectedTargetBadge, requestReason);
    setShowRequestModal(false);
  };

  const handleExecuteReview = () => {
    if (!selectedRequestForReview) return;
    if (reviewAction === 'approve') {
      onApproveBadge(selectedRequestForReview.id, reviewNotes);
    } else {
      onRejectBadge(selectedRequestForReview.id, reviewNotes);
    }
    setSelectedRequestForReview(null);
    setReviewNotes('');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bento-card bento-card-gold p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4" />
            <span>RADIO CALLSIGN & BADGE ROSTER</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5 flex-wrap">
            <span>ระบบจัดการหมายเลขประจำตัว & รหัสเรียกขานตำรวจ</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
              ความจุ {currentTotalSlots} หมายเลข (#{firstBadge} - #{lastBadge})
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ตรวจสอบสถานะหมายเลขวิทยุ (#{firstBadge} - #{lastBadge}), ยื่นคำขอเปลี่ยนเลขประจำตัว, เพิ่มสล็อตเลขวิทยุ, และแผงอนุมัติของหัวหน้าหน่วยงาน
          </p>
        </div>

        {/* Quick Admin Actions & Current Badge Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          {isLeaderOrAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Add Badge Slots (Admin feature requested) */}
              <button
                onClick={handleOpenExpandModal}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all cursor-pointer ring-1 ring-blue-400/40"
                title="เพิ่มจำนวนเลขวิทยุ เช่น เพิ่มอีก 40 เลข รวมเป็น 80 เลข (เฉพาะ Admin)"
              >
                <PlusCircle className="w-4 h-4 text-blue-200" />
                <span>เพิ่มเลขวิทยุ (+40)</span>
              </button>

              {/* Check Officer Existence Button (Admin / Leader only) */}
              <button
                onClick={() => setShowCheckerModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-xs font-bold text-cyan-300 transition-colors cursor-pointer shadow-sm"
                title="ตรวจสอบว่ารายชื่อนี้มีอยู่ในระบบสถานีหรือไม่ (เฉพาะ Admin)"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>ตรวจสอบรายชื่อ</span>
              </button>

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
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                  title="จัดเรียง A-Z และรันเลขวิทยุใหม่อัตโนมัติ"
                >
                  <SortAsc className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isReordering ? 'กำลังจัดเรียง...' : 'จัดเรียง A-Z'}</span>
                </button>
              )}

              <button
                onClick={() => setShowOCRModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>สแกนรูปภาพรายชื่อ</span>
              </button>
            </div>
          )}

          {/* Current Officer's Badge Indicator */}
          <div className="flex items-center space-x-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-amber-500/30 shadow-md">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">เลขประจำตัวของคุณ</p>
              <p className="text-xs font-bold text-white truncate max-w-[120px]">{currentUser.officer_name}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center font-mono font-black text-amber-300 text-base shadow-inner">
              #{currentUser.badge_number}
            </div>
          </div>
        </div>
      </div>

      {/* Leader / Admin Approval Panel */}
      {isLeaderOrAdmin && (
        <div className="bento-card bento-card-crimson p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  แผงอนุมัติรหัสวิทยุของหัวหน้า (Leader Badge Approval Panel)
                  {pendingRequests.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] animate-pulse">
                      {pendingRequests.length} คำขอรอพิจารณา
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">เฉพาะผู้มีสิทธิ์ Leader / Admin ในการอนุมัติหรือปฏิเสธคำขอเปลี่ยนหมายเลข</p>
              </div>
            </div>
          </div>

          {/* Pending Requests Cards */}
          {pendingRequests.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/50 rounded-xl border border-slate-800/80 text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400 opacity-60" />
              ไม่มีคำขอเปลี่ยนเลขประจำตัวที่รอการอนุมัติในขณะนี้
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-xl bg-slate-950/90 border border-rose-900/40 hover:border-amber-500/40 transition-all space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img src={req.officer_avatar} alt={req.officer_name} className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{req.officer_name}</h4>
                        <p className="text-[11px] text-slate-400">{req.officer_rank}</p>
                      </div>
                    </div>
                    
                    {/* Badge change indicator */}
                    <div className="flex items-center space-x-1.5 font-mono text-xs font-black">
                      <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300">#{req.current_badge}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/50">#{req.requested_badge}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-medium">เหตุผล: </span>{req.reason}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-500">{req.requested_at}</span>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedRequestForReview(req);
                          setReviewAction('reject');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-rose-400 hover:bg-rose-950 border border-rose-900/50 transition-colors"
                      >
                        ปฏิเสธ (Reject)
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequestForReview(req);
                          setReviewAction('approve');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-md transition-colors"
                      >
                        อนุมัติ (Approve)
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid Controls: Search, Filter Tabs & Page Size Selector */}
      <div className="bento-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาเลขประจำตัว, ชื่อตำรวจ..."
              value={searchBadge}
              onChange={(e) => {
                setSearchBadge(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => {
                setFilterStatus('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === 'all' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              ทั้งหมด ({badgeSlots.length})
            </button>
            <button
              onClick={() => {
                setFilterStatus('Available');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === 'Available' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              ว่าง ({badgeSlots.filter(s => s.status === 'Available').length})
            </button>
            <button
              onClick={() => {
                setFilterStatus('Busy');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === 'Busy' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              ใช้งานแล้ว ({badgeSlots.filter(s => s.status === 'Busy').length})
            </button>
            <button
              onClick={() => {
                setFilterStatus('Pending');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === 'Pending' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              รออนุมัติ ({badgeSlots.filter(s => s.status === 'Pending').length})
            </button>
          </div>

          {/* Page Size Toggle */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] self-end lg:self-auto">
            <span className="text-slate-500 font-medium px-2 flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>แสดง:</span>
            </span>
            {[
              { size: 20, label: '20' },
              { size: 40, label: '40 (มาตรฐาน)' },
              { size: 80, label: '80' },
              { size: 0, label: 'ทั้งหมด' }
            ].map((option) => (
              <button
                key={option.size}
                onClick={() => {
                  setPageSize(option.size);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  pageSize === option.size
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Batch Range Tabs (เมื่อมีหลายหน้า เช่น หน้า 1 #01-40, หน้า 2 #41-80) */}
        {pageBatches.length > 1 && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap flex items-center gap-1 mr-1">
              <Hash className="w-3.5 h-3.5 text-blue-400" />
              <span>เลือกช่วงหน้า:</span>
            </span>
            {pageBatches.map((batch) => {
              const isActive = currentPage === batch.page;
              return (
                <button
                  key={batch.page}
                  onClick={() => setCurrentPage(batch.page)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center space-x-2 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/40 ring-1 ring-blue-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span>{batch.label}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-amber-300'
                  }`}>
                    {batch.badgeRange}
                  </span>
                  {batch.availableCount > 0 && (
                    <span className={`text-[10px] ${isActive ? 'text-emerald-200' : 'text-emerald-400 font-sans'}`}>
                      (ว่าง {batch.availableCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Badge Slots Grid (Paginated) */}
      {displayedSlots.length === 0 ? (
        <div className="bento-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Search className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-300">ไม่พบหมายเลขวิทยุตามเงื่อนไขที่ค้นหา</p>
          <p className="text-xs text-slate-500">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองสถานะ</p>
          <button
            onClick={() => {
              setSearchBadge('');
              setFilterStatus('all');
              setCurrentPage(1);
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
          >
            ล้างการค้นหา
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-3">
          {displayedSlots.map((slot) => {
            const isCurrentOfficerBadge = slot.assigned_officer?.discord_id === currentUser.discord_id;
            
            return (
              <div
                key={slot.badge_number}
                className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[130px] ${
                  slot.status === 'Busy'
                    ? isCurrentOfficerBadge
                      ? 'bg-gradient-to-b from-amber-950/40 to-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/30'
                      : 'bg-[#0c1220] border-slate-800'
                    : slot.status === 'Pending'
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-emerald-950/10 border-emerald-900/30 hover:border-emerald-500/60 hover:bg-emerald-950/20 cursor-pointer'
                }`}
              >
                {/* Badge Header: Number & Status Dot */}
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-mono font-black ${
                    slot.status === 'Busy' ? 'text-white' : slot.status === 'Pending' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    #{slot.badge_number}
                  </span>

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    slot.status === 'Busy'
                      ? isCurrentOfficerBadge ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      : slot.status === 'Pending'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {slot.status === 'Busy' ? (isCurrentOfficerBadge ? 'ของคุณ' : 'ใช้งาน') : slot.status === 'Pending' ? 'รออนุมัติ' : 'ว่าง'}
                  </span>
                </div>

                {/* Slot Details */}
                {slot.status === 'Busy' && slot.assigned_officer ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <img src={slot.assigned_officer.avatar} alt={slot.assigned_officer.officer_name} className="w-5 h-5 rounded-md object-cover" />
                      <p className="text-xs font-bold text-slate-200 truncate">{slot.assigned_officer.officer_name}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{slot.assigned_officer.rank}</p>
                  </div>
                ) : slot.status === 'Pending' ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-amber-300 font-bold truncate">คำขอโดย {slot.pending_request?.officer_name}</p>
                    <p className="text-[9px] text-slate-400">จาก #{slot.pending_request?.current_badge}</p>
                  </div>
                ) : (
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => handleOpenRequest(slot.badge_number)}
                      className="w-full py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm transition-colors cursor-pointer"
                    >
                      ยื่นขอเลขนี้
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer Controls */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="bento-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Summary Text */}
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span>
              แสดงรายการที่ <strong className="font-mono text-slate-200">{startIndex + 1} - {endIndex}</strong> จากทั้งหมด <strong className="font-mono text-slate-200">{totalItems}</strong> หมายเลข
            </span>
            <span className="hidden md:inline px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 font-mono text-[11px] border border-slate-800">
              (หน้า {currentPage} / {totalPages})
            </span>
          </div>

          {/* Page Buttons & Navigation */}
          <div className="flex items-center space-x-1.5">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="หน้าแรก"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center space-x-1 text-xs font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">ก่อนหน้า</span>
            </button>

            {/* Page Number Buttons */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === currentPage;
                // Show first, last, current, and adjacent pages
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 ring-1 ring-blue-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 ||
                  pageNum === currentPage + 2
                ) {
                  return (
                    <span key={pageNum} className="text-slate-600 px-1 font-mono text-xs">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center space-x-1 text-xs font-bold cursor-pointer"
            >
              <span className="hidden sm:inline">ถัดไป</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="หน้าสุดท้าย"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Badge Request Submission Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">ยื่นขอเปลี่ยนหมายเลขประจำตัว</h3>
              </div>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConfirmSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div>
                  <p className="text-slate-400">เลขเดิมของคุณ</p>
                  <p className="text-sm font-bold font-mono text-white">#{currentUser.badge_number}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-slate-400">เลขใหม่ที่ขอ</p>
                  <p className="text-sm font-bold font-mono text-amber-400">#{selectedTargetBadge}</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">เหตุผลในการขอเปลี่ยนหมายเลข</label>
                <textarea
                  required
                  rows={3}
                  placeholder="เช่น ได้รับการเลื่อนขั้น, ย้ายแผนก, หรือขอตามระเบียบสายตรวจ..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-700/40 text-[11px] text-amber-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>คำขอจะถูกส่งไปยังหัวหน้าหน่วยงาน (Leader/Admin) เพื่อตรวจสอบและอนุมัติ ระบบจะเปลี่ยนเลขให้อัตโนมัติเมื่อได้รับการอนุมัติ</span>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black hover:from-amber-400 hover:to-amber-500 shadow-lg"
                >
                  ยืนยันส่งคำขอ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Action Modal (Approve / Reject) */}
      {selectedRequestForReview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {reviewAction === 'approve' ? 'อนุมัติคำขอเปลี่ยนเลขประจำตัว' : 'ปฏิเสธคำขอเปลี่ยนเลขประจำตัว'}
              </h3>
              <button onClick={() => setSelectedRequestForReview(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                <p className="text-slate-400">ผู้ยื่นคำขอ: <span className="text-white font-bold">{selectedRequestForReview.officer_name}</span> ({selectedRequestForReview.officer_rank})</p>
                <p className="text-slate-400">เปลี่ยนจาก: <span className="font-mono text-white">#{selectedRequestForReview.current_badge}</span> &rarr; <span className="font-mono text-amber-400 font-bold">#{selectedRequestForReview.requested_badge}</span></p>
                <p className="text-slate-400">เหตุผล: <span className="text-slate-200">{selectedRequestForReview.reason}</span></p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">หมายเหตุของหัวหน้า (Review Notes)</label>
                <input
                  type="text"
                  placeholder="เช่น อนุมัติตามโครงสร้างฝ่าย หรือ เหตุผลในการปฏิเสธ..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setSelectedRequestForReview(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleExecuteReview}
                  className={`flex-1 py-2 rounded-xl font-bold text-white shadow-lg ${
                    reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {reviewAction === 'approve' ? 'ยืนยันอนุมัติคำขอ' : 'ยืนยันปฏิเสธคำขอ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI OCR Image Scanner Modal */}
      <RosterImageScannerModal
        isOpen={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        existingOfficers={allOfficers}
        onImportSuccess={(msg) => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Officer Existence Checker Modal */}
      <OfficerExistenceCheckerModal
        isOpen={showCheckerModal}
        onClose={() => setShowCheckerModal(false)}
        allOfficers={allOfficers}
        onRefreshData={onRefreshData}
      />

      {/* Admin Expand / Add Radio Code Slots Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1120] border border-blue-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl shadow-blue-950/60 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    เพิ่มและขยายจำนวนหมายเลขวิทยุ
                  </h3>
                  <p className="text-xs text-slate-400">กำหนดความจุสล็อตหมายเลขประจำตัววิทยุ (Radio Code Capacity)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExpandModal(false)} 
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Status Overview */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-center">
              <div className="p-2 rounded-xl bg-slate-900/60">
                <p className="text-[10px] text-slate-400 font-medium">จำนวนปัจจุบัน</p>
                <p className="text-sm font-black font-mono text-white">{currentTotalSlots} เลข</p>
                <p className="text-[9px] text-slate-500">#{firstBadge} - #{lastBadge}</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-900/30">
                <p className="text-[10px] text-rose-300 font-medium">ใช้งานแล้ว</p>
                <p className="text-sm font-black font-mono text-rose-400">
                  {badgeSlots.filter(s => s.status === 'Busy').length} เลข
                </p>
                <p className="text-[9px] text-slate-500">มีเจ้าหน้าที่ครองอยู่</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <p className="text-[10px] text-emerald-300 font-medium">สล็อตว่าง</p>
                <p className="text-sm font-black font-mono text-emerald-400">
                  {badgeSlots.filter(s => s.status === 'Available').length} เลข
                </p>
                <p className="text-[9px] text-slate-500">พร้อมขอใช้งาน</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setExpandMode('add');
                  setExpandFeedback(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  expandMode === 'add'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>โหมดเพิ่มจำนวน (+)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpandMode('set');
                  setExactTotalSlotsInput(currentTotalSlots + 40);
                  setExpandFeedback(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  expandMode === 'set'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>กำหนดจำนวนรวมทั้งหมด (=)</span>
              </button>
            </div>

            <form onSubmit={handleConfirmExpandSlots} className="space-y-4 text-xs">
              {expandMode === 'add' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5 flex items-center justify-between">
                      <span>ระบุจำนวนเลขวิทยุที่ต้องการเพิ่ม (+):</span>
                      <span className="text-blue-400 font-mono font-bold text-xs">
                        +{additionalSlotsInput || 0} หมายเลข
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        required
                        value={additionalSlotsInput}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAdditionalSlotsInput(isNaN(val) ? ('' as any) : Math.max(1, val));
                        }}
                        placeholder="เช่น 40 (เพื่อเพิ่มจาก 40 รวมเป็น 80)"
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons for Add mode */}
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1.5">ปุ่มเลือกจำนวนเพิ่มด่วน (Quick Presets):</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[10, 20, 40, 50, 100].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAdditionalSlotsInput(preset)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                            additionalSlotsInput === preset
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5 flex items-center justify-between">
                      <span>กำหนดจำนวนหมายเลขวิทยุทั้งหมดที่ต้องการ:</span>
                      <span className="text-blue-400 font-mono font-bold text-xs">
                        รวม {exactTotalSlotsInput || 0} หมายเลข
                      </span>
                    </label>
                    <input
                      type="number"
                      min={Math.max(1, badgeSlots.filter(s => s.status === 'Busy').length)}
                      max="999"
                      required
                      value={exactTotalSlotsInput}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setExactTotalSlotsInput(isNaN(val) ? ('' as any) : Math.max(1, val));
                      }}
                      placeholder="เช่น 80 (หมายเลข #01 ถึง #80)"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Quick Preset Buttons for Set Total mode */}
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1.5">ปุ่มเลือกจำนวนรวมด่วน (Quick Totals):</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[40, 60, 80, 100, 150].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setExactTotalSlotsInput(preset)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                            exactTotalSlotsInput === preset
                              ? 'bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          {preset} เลข
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Live Preview Calculation Box */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">ตัวอย่างผลลัพธ์การคำนวณ:</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold text-[11px] border border-blue-500/40">
                    {expandMode === 'add' ? `+${additionalSlotsInput || 0} หมายเลข` : `ปรับเป็น ${calcNewTotal} หมายเลข`}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 font-mono text-xs">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">เดิมมี</p>
                    <p className="font-bold text-slate-300">{currentTotalSlots} เลข</p>
                  </div>
                  <span className="text-slate-500 font-bold">+</span>
                  <div className="text-center">
                    <p className="text-[10px] text-blue-400">เพิ่มอีก</p>
                    <p className="font-bold text-blue-400">
                      {calcAddedDiff >= 0 ? `+${calcAddedDiff}` : calcAddedDiff} เลข
                    </p>
                  </div>
                  <span className="text-slate-500 font-bold">=</span>
                  <div className="text-center">
                    <p className="text-[10px] text-emerald-400 font-bold">รวมทั้งหมด</p>
                    <p className="font-black text-emerald-400 text-sm">{calcNewTotal} เลข</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>ช่วงหมายเลขใหม่ทั้งหมด:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    #01 ถึง #{calcNewTotal < 10 ? `0${calcNewTotal}` : calcNewTotal}
                  </span>
                </div>
                {calcAddedDiff > 0 && (
                  <div className="text-[10px] text-blue-300 bg-blue-950/40 p-1.5 rounded-lg border border-blue-800/40">
                    ✨ สล็อตใหม่ที่จะถูกสร้างขึ้นอัตโนมัติ: <strong className="font-mono">#{currentTotalSlots + 1 < 10 ? `0${currentTotalSlots + 1}` : currentTotalSlots + 1}</strong> ถึง <strong className="font-mono">#{calcNewTotal < 10 ? `0${calcNewTotal}` : calcNewTotal}</strong>
                  </div>
                )}
              </div>

              {/* Feedback messages */}
              {expandFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                  expandFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}>
                  {expandFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{expandFeedback.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpandModal(false)}
                  disabled={isExpanding}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isExpanding || calcNewTotal <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isExpanding 
                      ? 'กำลังบันทึก...' 
                      : expandMode === 'add'
                        ? `ยืนยันเพิ่ม ${additionalSlotsInput || 0} เลข (รวมเป็น ${calcNewTotal} เลข)`
                        : `ยืนยันปรับเป็น ${calcNewTotal} หมายเลข`
                    }
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
