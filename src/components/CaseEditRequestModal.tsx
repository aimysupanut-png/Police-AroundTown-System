import React, { useState, useMemo } from 'react';
import { 
  X, 
  Edit3, 
  AlertCircle, 
  CheckCircle, 
  UserCheck, 
  Users, 
  AtSign, 
  ShieldAlert, 
  Lock, 
  Send, 
  Search, 
  Tag, 
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { CaseLog, Officer, CaseType, TaggedOfficerRef } from '../types';
import { isOnDuty, canRequestCaseEdit, getAvailableOnDutyOfficers } from '../utils/permissionUtils';

interface CaseEditRequestModalProps {
  caseItem: CaseLog;
  currentUser: Officer | null;
  officers: Officer[];
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

export const CaseEditRequestModal: React.FC<CaseEditRequestModalProps> = ({
  caseItem,
  currentUser,
  officers,
  onClose,
  onSuccess
}) => {
  // Form fields
  const [requestedTitle, setRequestedTitle] = useState(caseItem.title || '');
  const [requestedType, setRequestedType] = useState<CaseType>(caseItem.type || 'NORMAL');
  const [requestedDescription, setRequestedDescription] = useState(caseItem.description || '');
  const [reason, setReason] = useState('');
  
  // Tagged officers state
  const [taggedOfficers, setTaggedOfficers] = useState<Officer[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Status & Error handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Permission checks
  const permission = canRequestCaseEdit(currentUser, caseItem);

  // Filter available officers for tagging: STRICTLY ONLY ON_DUTY
  const availableOnDutyOfficers = useMemo(() => {
    return getAvailableOnDutyOfficers(officers, currentUser?.discord_id, tagSearchQuery)
      .filter(o => !taggedOfficers.some(t => t.discord_id === o.discord_id));
  }, [officers, currentUser, tagSearchQuery, taggedOfficers]);

  const handleAddTag = (officer: Officer) => {
    if (!isOnDuty(officer)) {
      setErrorMessage(`ไม่สามารถแท็ก ${officer.officer_name} ได้ เนื่องจากขณะนี้ไม่ได้อยู่ในสถานะเข้าเวร (OFF_DUTY)`);
      return;
    }
    setTaggedOfficers(prev => [...prev, officer]);
    setTagSearchQuery('');
    setShowTagPicker(false);
    setErrorMessage(null);
  };

  const handleRemoveTag = (discordId: string) => {
    setTaggedOfficers(prev => prev.filter(t => t.discord_id !== discordId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Double check client permission
    if (!permission.allowed) {
      setErrorMessage(permission.reason || 'คุณไม่มีสิทธิ์ส่งคำร้องขอแก้ไขคดีนี้');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('กรุณาระบุเหตุผลในการขอแก้ไขคดี');
      return;
    }

    if (!requestedTitle.trim()) {
      setErrorMessage('กรุณาระบุชื่อคดีที่ต้องการขอแก้ไข');
      return;
    }

    // Verify all tagged officers are still on duty locally before sending
    for (const tagged of taggedOfficers) {
      const freshOfficer = officers.find(o => o.discord_id === tagged.discord_id);
      if (!freshOfficer || !isOnDuty(freshOfficer)) {
        setErrorMessage(`ไม่สามารถแท็ก ${tagged.officer_name} ได้ เนื่องจากขณะนี้ ${tagged.officer_name} ออกเวรแล้ว`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        case_id: caseItem.id,
        caseId: caseItem.id,
        requested_title: requestedTitle.trim(),
        requestedTitle: requestedTitle.trim(),
        requestedTag: requestedTitle.trim(),
        requested_type: requestedType,
        requestedType: requestedType,
        requested_description: requestedDescription.trim(),
        requestedDescription: requestedDescription.trim(),
        reason: reason.trim(),
        mentioned_user_ids: taggedOfficers.map(t => t.discord_id),
        mentionedUserIds: taggedOfficers.map(t => t.discord_id)
      };

      const res = await fetch('/api/case-edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess(data.message || `ยื่นคำร้องขอแก้ไขคดี ${caseItem.case_number} เรียบร้อยแล้ว`);
        onClose();
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการส่งคำร้อง');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Edit3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-800/60">
                  {caseItem.case_number}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-950/60 text-blue-300 font-bold border border-blue-800/60">
                  {caseItem.type}
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-0.5">
                ยื่นคำร้องขอแก้ไขคดี (Case Edit Request)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Permission Warning if not eligible */}
          {!permission.allowed && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs space-y-1.5 flex items-start gap-3">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">ไม่สามารถส่งคำร้องขอแก้ไขคดีนี้ได้</p>
                <p className="text-slate-300">{permission.reason}</p>
                <div className="mt-2 text-[11px] text-rose-300/80 bg-rose-900/40 p-2 rounded-xl border border-rose-800/40 font-mono">
                  เงื่อนไข: ต้องเป็นผู้สร้างคดี ({caseItem.created_by_name || caseItem.officer_name || 'เจ้าหน้าที่ผู้ลงคดี'}) และ ต้องมีสถานะ ON_DUTY ขณะส่งคำร้อง
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-700 text-rose-200 text-xs flex items-start gap-3 animate-in shake duration-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-300">ข้อผิดพลาดในการตรวจสอบสิทธิ์:</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Original Case Summary Banner */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              ข้อมูลคดีปัจจุบัน (Original Case Information)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">ชื่อคดีปัจจุบัน:</span>
                <p className="font-bold text-white truncate">{caseItem.title}</p>
              </div>
              <div>
                <span className="text-slate-500">ผู้สร้างคดี:</span>
                <p className="font-bold text-amber-300 truncate">
                  {caseItem.created_by_name || caseItem.officer_name} #{caseItem.created_by_badge || caseItem.badge_number}
                </p>
              </div>
            </div>
          </div>

          {/* Field: Requested Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>ชื่อคดีที่ต้องการขอแก้ไข (Requested Case Title) <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-slate-500 font-mono">Original: {caseItem.title}</span>
            </label>
            <input
              type="text"
              required
              disabled={!permission.allowed || isSubmitting}
              value={requestedTitle}
              onChange={(e) => setRequestedTitle(e.target.value)}
              placeholder="ระบุชื่อคดีใหม่ เช่น เหตุทะเลาะวิวาทบริเวณหน้าร้านค้า..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white text-xs placeholder:text-slate-600 disabled:opacity-50 transition-all"
            />
          </div>

          {/* Field: Requested Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              ประเภทคดีที่ต้องการขอเปลี่ยน (Requested Case Type)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['NORMAL', 'TAKE2', 'RED_CASE'] as CaseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!permission.allowed || isSubmitting}
                  onClick={() => setRequestedType(t)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    requestedType === t
                      ? t === 'RED_CASE'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 ring-1 ring-rose-400'
                        : t === 'TAKE2'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/60 ring-1 ring-purple-400'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-950/60 ring-1 ring-blue-400'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  <span>{t === 'RED_CASE' ? '🔴 RED CASE' : t === 'TAKE2' ? '🟣 TAKE 2' : '🔵 NORMAL'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Field: Requested Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              รายละเอียดเพิ่มเติมที่ต้องการแก้ไข (Requested Details)
            </label>
            <textarea
              rows={2}
              disabled={!permission.allowed || isSubmitting}
              value={requestedDescription}
              onChange={(e) => setRequestedDescription(e.target.value)}
              placeholder="ระบุข้อความรายละเอียดที่ต้องการให้แก้ไข..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white text-xs placeholder:text-slate-600 disabled:opacity-50 transition-all resize-none"
            />
          </div>

          {/* Field: Reason for Edit Request */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>เหตุผลในการขอแก้ไขคดี (Reason for Request) <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-amber-400 font-semibold">ผู้ดูแลระบบจะนำไปพิจารณา</span>
            </label>
            <textarea
              rows={3}
              required
              disabled={!permission.allowed || isSubmitting}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผล เช่น พิมพ์ชื่อสถานที่ผิดพลาด, ขอเพิ่มรายละเอียดผู้ร่วมเหตุการณ์..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white text-xs placeholder:text-slate-600 disabled:opacity-50 transition-all resize-none"
            />
          </div>

          {/* Tagging System: Tag ON_DUTY Officers */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>เจ้าหน้าที่ที่เกี่ยวข้อง (Tagged Officers)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  ระบุเจ้าหน้าที่ที่ปฏิบัติหน้าที่ร่วมหรือเกี่ยวข้อง (เลือกได้เฉพาะผู้ที่ <span className="text-emerald-400 font-bold">ON_DUTY</span> เท่านั้น)
                </p>
              </div>

              <button
                type="button"
                disabled={!permission.allowed || isSubmitting}
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                <AtSign className="w-3.5 h-3.5" />
                <span>@ เลือกเจ้าหน้าที่</span>
              </button>
            </div>

            {/* Currently Tagged Chips */}
            {taggedOfficers.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                {taggedOfficers.map((officer) => (
                  <div
                    key={officer.discord_id}
                    className="flex items-center space-x-2 pl-2 pr-1.5 py-1 rounded-xl bg-indigo-950/80 border border-indigo-800/80 text-white text-xs font-medium group"
                  >
                    <img
                      src={officer.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                      alt={officer.officer_name}
                      className="w-5 h-5 rounded-md object-cover ring-1 ring-indigo-500/40"
                    />
                    <span className="font-bold">{officer.officer_name}</span>
                    <span className="font-mono text-[10px] text-amber-300 font-bold">#{officer.badge_number}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/50">
                      ON_DUTY
                    </span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRemoveTag(officer.discord_id)}
                      className="p-1 rounded-lg hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center text-xs text-slate-500">
                ยังไม่มีการระบุเจ้าหน้าที่ที่เกี่ยวข้อง (ไม่บังคับ)
              </div>
            )}

            {/* Tag Picker Dropdown (Only ON_DUTY) */}
            {showTagPicker && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/40 shadow-xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ค้นหาเจ้าหน้าที่ที่กำลังเข้าเวร (ON_DUTY):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTagPicker(false)}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    ปิด
                  </button>
                </div>

                <input
                  type="text"
                  autoFocus
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder="พิมพ์ @ชื่อ หรือ #รหัส เช่น @John, #01..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:border-indigo-500"
                />

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {availableOnDutyOfficers.length === 0 ? (
                    <p className="text-center py-3 text-xs text-slate-500">
                      {tagSearchQuery ? 'ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้นหา (ต้องเป็นผู้ที่เข้าเวรอยู่เท่านั้น)' : 'ไม่มีเจ้าหน้าที่อื่นที่กำลังเข้าเวรอยู่ในขณะนี้'}
                    </p>
                  ) : (
                    availableOnDutyOfficers.map((off) => (
                      <div
                        key={off.discord_id}
                        onClick={() => handleAddTag(off)}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/60 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img
                            src={off.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                            alt={off.officer_name}
                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-700"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate flex items-center gap-1.5">
                              <span>{off.officer_name}</span>
                              <span className="font-mono text-[10px] text-amber-300">#{off.badge_number}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{off.rank || 'Officer'}</p>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 text-[10px] font-bold border border-emerald-800/60 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>ON_DUTY</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={!permission.allowed || isSubmitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-indigo-950/60 border border-indigo-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'กำลังส่งคำร้อง...' : 'ส่งคำร้องขอแก้ไข (Submit Request)'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
