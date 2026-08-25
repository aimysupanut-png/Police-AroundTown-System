import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  X, 
  UserCheck, 
  UserX, 
  UserPlus, 
  ListCheck, 
  Sparkles, 
  Copy, 
  ExternalLink, 
  Shield, 
  FileText, 
  RefreshCw,
  Hash,
  Phone,
  Clock,
  Briefcase,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Officer, ExistenceCheckResultItem } from '../types';

interface OfficerExistenceCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allOfficers: Officer[];
  onAddOfficerQuick?: (name: string) => void;
  onRefreshData?: () => void;
}

export const OfficerExistenceCheckerModal: React.FC<OfficerExistenceCheckerModalProps> = ({
  isOpen,
  onClose,
  allOfficers,
  onAddOfficerQuick,
  onRefreshData
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  
  // Single search state
  const [singleQuery, setSingleQuery] = useState('');
  const [singleResult, setSingleResult] = useState<ExistenceCheckResultItem | null>(null);
  const [isSearchingSingle, setIsSearchingSingle] = useState(false);

  // Batch search state
  const [batchInput, setBatchInput] = useState('');
  const [batchResults, setBatchResults] = useState<ExistenceCheckResultItem[]>([]);
  const [isCheckingBatch, setIsCheckingBatch] = useState(false);
  const [batchFilter, setBatchFilter] = useState<'all' | 'found' | 'not_found'>('all');
  const [copiedStatus, setCopiedStatus] = useState(false);

  if (!isOpen) return null;

  // Single Search Logic (Debounced / Real-time client-side + server validation)
  const handleSingleSearch = (query: string) => {
    setSingleQuery(query);
    if (!query.trim()) {
      setSingleResult(null);
      return;
    }

    const trimmed = query.trim().toLowerCase();
    const cleanQuery = trimmed.replace(/^(pol\.|officer|chief|lt\.|commander|sergeant|capt\.|นาย|ผู้บัญชาการตำรวจ|รองผู้บัญชาการตำรวจ|สารวัตร|หมวด|จ่า|ครูฝึก|นักเรียนตำรวจ|ผบ\.|สว\.|ร\.ต\.|ด\.ต\.|ส\.ต\.|นรต\.)\s*/i, '');
    const badgeDigits = trimmed.replace(/\D/g, '');

    // 1. Exact Name
    let matched = allOfficers.find(o => o.officer_name.toLowerCase() === trimmed);
    let matchType: ExistenceCheckResultItem['match_type'] = 'exact';

    if (!matched) {
      // 2. Normalized Name
      matched = allOfficers.find(o => {
        const norm = o.officer_name.toLowerCase().replace(/^(pol\.|officer|chief|lt\.|commander|sergeant|capt\.|นาย|ผู้บัญชาการตำรวจ|รองผู้บัญชาการตำรวจ|สารวัตร|หมวด|จ่า|ครูฝึก|นักเรียนตำรวจ|ผบ\.|สว\.|ร\.ต\.|ด\.ต\.|ส\.ต\.|นรต\.)\s*/i, '');
        return norm === cleanQuery && cleanQuery.length > 1;
      });
      if (matched) matchType = 'normalized';
    }

    if (!matched && (trimmed.startsWith('#') || (badgeDigits.length > 0 && badgeDigits.length <= 3 && trimmed.length <= 4))) {
      // 3. Badge
      const searchBadge = badgeDigits.padStart(2, '0');
      matched = allOfficers.find(o => o.badge_number === searchBadge || o.badge_number === badgeDigits);
      if (matched) matchType = 'badge';
    }

    if (!matched) {
      // 4. Callsign
      matched = allOfficers.find(o => o.callsign.toLowerCase() === trimmed);
      if (matched) matchType = 'callsign';
    }

    if (!matched && trimmed.length >= 2) {
      // 5. Partial
      matched = allOfficers.find(o => 
        o.officer_name.toLowerCase().includes(trimmed) ||
        o.discord_id.toLowerCase().includes(trimmed) ||
        trimmed.includes(o.officer_name.toLowerCase())
      );
      if (matched) matchType = 'partial';
    }

    setSingleResult({
      query_name: query.trim(),
      exists: !!matched,
      match_type: matched ? matchType : 'none',
      matched_officer: matched || null
    });
  };

  // Run Batch Verification
  const handleRunBatchCheck = async () => {
    if (!batchInput.trim()) return;

    // Parse lines or comma separated names
    const lines = batchInput
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('//') && !s.startsWith('# '));

    if (lines.length === 0) return;

    setIsCheckingBatch(true);

    try {
      const res = await fetch('/api/officers/check-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: lines })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setBatchResults(data.results);
      }
    } catch (err) {
      console.error("Batch check error:", err);
      // Client-side fallback check
      const fallbackResults: ExistenceCheckResultItem[] = lines.map(line => {
        const norm = line.toLowerCase().replace(/^(pol\.|officer|chief|lt\.|commander|sergeant|capt\.|นาย)\s*/i, '');
        const matched = allOfficers.find(o => 
          o.officer_name.toLowerCase() === line.toLowerCase() ||
          o.officer_name.toLowerCase().includes(norm)
        );
        return {
          query_name: line,
          exists: !!matched,
          match_type: matched ? 'exact' : 'none',
          matched_officer: matched || null
        };
      });
      setBatchResults(fallbackResults);
    } finally {
      setIsCheckingBatch(false);
    }
  };

  // Preset demo batch names
  const handleLoadSampleBatch = () => {
    const samples = [
      "Chief Alex Vance",
      "Marcus Brody",
      "Benjamin Hayes",
      "Nathaniel Drake",
      "Sarah Connor",
      "Gordon Freeman",
      "Tony Stark",
      "Cadet Hannah Abbott"
    ].join('\n');
    setBatchInput(samples);
  };

  // Copy Results to Clipboard
  const handleCopyReport = () => {
    if (batchResults.length === 0) return;
    const found = batchResults.filter(r => r.exists);
    const notFound = batchResults.filter(r => !r.exists);

    let text = `📋 รายงานผลการตรวจสอบรายชื่อตำรวจ (ATPD Name Verification Report)\n`;
    text += `ตรวจสอบทั้งหมด: ${batchResults.length} นาย | มีในระบบ: ${found.length} นาย | ไม่พบในระบบ: ${notFound.length} นาย\n\n`;
    
    text += `✅ รายชื่อที่มีอยู่ในระบบ (${found.length} นาย):\n`;
    found.forEach((r, idx) => {
      text += `${idx + 1}. ${r.matched_officer?.officer_name} [${r.matched_officer?.rank}] - #${r.matched_officer?.badge_number} (${r.matched_officer?.department})\n`;
    });

    text += `\n❌ รายชื่อที่ไม่พบในระบบ (${notFound.length} นาย):\n`;
    notFound.forEach((r, idx) => {
      text += `${idx + 1}. ${r.query_name} (ยังไม่ได้ลงทะเบียน)\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  // Filter batch list
  const filteredBatchResults = batchResults.filter(r => {
    if (batchFilter === 'found') return r.exists;
    if (batchFilter === 'not_found') return !r.exists;
    return true;
  });

  const foundCount = batchResults.filter(r => r.exists).length;
  const notFoundCount = batchResults.filter(r => !r.exists).length;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  ระบบตรวจสอบรายชื่อเจ้าหน้าที่
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ตรวจสอบว่ามีรายชื่อนี้อยู่ในฐานข้อมูลสถานีแล้วหรือไม่ &bull; ค้นหารายคนหรือตรวจสอบแบบกลุ่ม
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center space-x-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              mode === 'single'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>ตรวจสอบรายคน (Single Search)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              mode === 'batch'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListCheck className="w-3.5 h-3.5" />
            <span>ตรวจสอบแบบกลุ่ม (Bulk Verification)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto pr-1 space-y-4 flex-1 custom-scrollbar">

          {/* ================= MODE 1: SINGLE SEARCH ================= */}
          {mode === 'single' && (
            <div className="space-y-4">
              
              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-5 h-5 text-cyan-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={singleQuery}
                  onChange={(e) => handleSingleSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อ-นามสกุล, ยศ, รหัสวิทยุ (#01), Callsign หรือ Discord ID..."
                  className="w-full pl-12 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white font-medium text-sm focus:outline-none focus:border-cyan-400 shadow-inner"
                  autoFocus
                />
                {singleQuery && (
                  <button
                    onClick={() => handleSingleSearch('')}
                    className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span className="text-[11px] text-slate-500">ตัวอย่างลองค้นหา:</span>
                {allOfficers.slice(0, 4).map(o => (
                  <button
                    key={o.discord_id}
                    onClick={() => handleSingleSearch(o.officer_name)}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition-colors cursor-pointer"
                  >
                    {o.officer_name} (#{o.badge_number})
                  </button>
                ))}
                <button
                  onClick={() => handleSingleSearch("John Doe (นายใหม่)")}
                  className="px-2 py-0.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 text-[11px] transition-colors cursor-pointer"
                >
                  John Doe (ชื่อที่ไม่มี)
                </button>
              </div>

              {/* Result State Presentation */}
              {singleQuery.trim() && singleResult && (
                <div className="space-y-4 pt-2">
                  
                  {/* CASE A: OFFICER FOUND */}
                  {singleResult.exists && singleResult.matched_officer ? (
                    <div className="bento-card bento-card-green p-5 space-y-4 border-emerald-500/40">
                      
                      {/* Status Banner */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <div>
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                              ✅ มีรายชื่อนี้อยู่ในระบบสถานี (REGISTERED OFFICER)
                            </span>
                            <p className="text-[11px] text-slate-400">
                              ตรงตามเกณฑ์: <strong className="text-slate-200 uppercase">{singleResult.match_type} match</strong>
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-mono font-black text-xs">
                          STATUS: ACTIVE
                        </span>
                      </div>

                      {/* Officer Profile Card */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3.5">
                          <img 
                            src={singleResult.matched_officer.avatar} 
                            alt={singleResult.matched_officer.officer_name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm sm:text-base font-black text-white">
                                {singleResult.matched_officer.officer_name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                                #{singleResult.matched_officer.badge_number}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                              <span className="text-cyan-300 font-bold">{singleResult.matched_officer.rank}</span>
                              <span>&bull;</span>
                              <span>{singleResult.matched_officer.department}</span>
                              <span>&bull;</span>
                              <span className="font-mono text-slate-300">{singleResult.matched_officer.callsign}</span>
                            </div>
                          </div>
                        </div>

                        {/* Duty Badge */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto justify-between sm:justify-start">
                          <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                            singleResult.matched_officer.status === 'On Duty'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse'
                              : singleResult.matched_officer.status === 'In Action'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            ● {singleResult.matched_officer.status}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            เข้าเวรสะสม: {singleResult.matched_officer.duty_hours} ชม.
                          </span>
                        </div>
                      </div>

                      {/* Detail Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            วันที่เข้าร่วม
                          </span>
                          <p className="font-mono font-bold text-white mt-0.5">{singleResult.matched_officer.join_date}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-amber-400" />
                            คดีที่รับผิดชอบ
                          </span>
                          <p className="font-mono font-bold text-white mt-0.5">{singleResult.matched_officer.total_cases} คดี</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            เบอร์ติดต่อ
                          </span>
                          <p className="font-mono font-bold text-white mt-0.5">{singleResult.matched_officer.phone_number}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Hash className="w-3 h-3 text-indigo-400" />
                            Discord ID
                          </span>
                          <p className="font-mono font-bold text-slate-300 truncate mt-0.5" title={singleResult.matched_officer.discord_id}>
                            {singleResult.matched_officer.discord_id}
                          </p>
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* CASE B: OFFICER NOT FOUND */
                    <div className="bento-card bento-card-red p-5 space-y-4 border-rose-500/40">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0 mt-0.5">
                          <XCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h3 className="text-sm font-black text-rose-300">
                            ❌ ไม่พบรายชื่อ "{singleResult.query_name}" ในฐานข้อมูลสถานี
                          </h3>
                          <p className="text-xs text-slate-400">
                            รายชื่อนี้ยังไม่ได้ถูกบันทึกหรือไม่มีสถานะเจ้าหน้าที่ตำรวจในระบบสถานี Around Town Police MDT
                          </p>
                        </div>
                      </div>

                      {/* Quick Action to Add */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-300">
                          ต้องการเพิ่ม <strong>"{singleResult.query_name}"</strong> เป็นเจ้าหน้าที่นายใหม่หรือไม่?
                        </div>

                        {onAddOfficerQuick && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddOfficerQuick(singleResult.query_name);
                              onClose();
                            }}
                            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>เพิ่มรายชื่อนี้เข้าระบบทันที</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Empty state when query is empty */}
              {!singleQuery.trim() && (
                <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
                  <Search className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-300">พิมพ์ชื่อที่ต้องการตรวจสอบในช่องค้นหาด้านบน</p>
                  <p className="text-[11px] text-slate-500">
                    ระบบจะแสดงข้อมูลยศ แผนก หมายเลขประจำตัว และสถานะการเข้าเวรทันทีหากพบบุคคลในระบบ
                  </p>
                </div>
              )}

            </div>
          )}

          {/* ================= MODE 2: BATCH BULK SEARCH ================= */}
          {mode === 'batch' && (
            <div className="space-y-4">
              
              {/* Batch Textarea Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    วางรายชื่อที่ต้องการตรวจสอบ (แยก 1 บรรทัดต่อ 1 ชื่อ หรือคั่นด้วยเครื่องหมายจุลภาค):
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleBatch}
                    className="text-xs text-cyan-400 hover:underline cursor-pointer"
                  >
                    ใส่ตัวอย่างรายชื่อทดสอบ
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="ตัวอย่าง:&#10;Chief Alex Vance&#10;Marcus Brody&#10;Benjamin Hayes&#10;Nathaniel Drake (ชื่อใหม่)&#10;..."
                  className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed custom-scrollbar"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    *ระบบจะตรวจสอบการสะกดชื่อ ยศ และหมายเลขประจำตัวเทียบกับฐานข้อมูล
                  </span>

                  <button
                    type="button"
                    disabled={!batchInput.trim() || isCheckingBatch}
                    onClick={handleRunBatchCheck}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all cursor-pointer ${
                      !batchInput.trim() || isCheckingBatch
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                    }`}
                  >
                    {isCheckingBatch ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังตรวจสอบ...</span>
                      </>
                    ) : (
                      <>
                        <ListCheck className="w-4 h-4" />
                        <span>เริ่มตรวจสอบรายชื่อแบบกลุ่ม</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Batch Results Presentation */}
              {batchResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  
                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setBatchFilter('all')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        batchFilter === 'all'
                          ? 'bg-slate-800 border-cyan-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold">ตรวจสอบทั้งหมด</span>
                      <p className="text-base font-black font-mono mt-0.5 text-white">{batchResults.length} นาย</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchFilter('found')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        batchFilter === 'found'
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-emerald-400">✅ พบในระบบ</span>
                      <p className="text-base font-black font-mono mt-0.5 text-emerald-300">{foundCount} นาย</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchFilter('not_found')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        batchFilter === 'not_found'
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-rose-400">❌ ไม่พบในระบบ</span>
                      <p className="text-base font-black font-mono mt-0.5 text-rose-300">{notFoundCount} นาย</p>
                    </button>
                  </div>

                  {/* Header & Export Button */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>
                      กำลังแสดง: <strong>{filteredBatchResults.length}</strong> รายการ
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedStatus ? 'คัดลอกรายงานแล้ว!' : 'คัดลอกรายงานสรุป'}</span>
                    </button>
                  </div>

                  {/* Results Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d121c] max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">รายชื่อที่ตรวจสอบ</th>
                          <th className="py-2.5 px-3">ผลการตรวจสอบ</th>
                          <th className="py-2.5 px-3">ยศ / หมายเลข</th>
                          <th className="py-2.5 px-3">แผนก</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {filteredBatchResults.map((item, idx) => (
                          <tr 
                            key={idx}
                            className={`transition-colors ${
                              item.exists ? 'hover:bg-emerald-950/10' : 'hover:bg-rose-950/10'
                            }`}
                          >
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-white">{item.query_name}</td>
                            <td className="py-2 px-3">
                              {item.exists ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  พบในระบบ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3" />
                                  ไม่พบในระบบ
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {item.matched_officer ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-amber-400 font-mono font-bold">#{item.matched_officer.badge_number}</span>
                                  <span className="text-slate-300">{item.matched_officer.rank}</span>
                                </div>
                              ) : (
                                <span className="text-slate-600">&mdash;</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {item.matched_officer?.department || <span className="text-slate-600">&mdash;</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            ฐานข้อมูลปัจจุบันมีเจ้าหน้าที่ทั้งหมด <strong className="text-slate-300">{allOfficers.length}</strong> นาย
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
