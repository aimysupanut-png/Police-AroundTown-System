import React, { useState } from 'react';
import { 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  MapPin, 
  Clock, 
  Calendar, 
  User, 
  Users, 
  DollarSign, 
  Hash, 
  Copy, 
  Check, 
  AlertTriangle, 
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  History, 
  ExternalLink,
  ChevronRight,
  Maximize2,
  Trash2,
  Lock,
  Edit3,
  AtSign
} from 'lucide-react';
import { CaseLog, Officer, CaseStatus } from '../types';
import { canModifyCase, isOnDuty, canRequestCaseEdit } from '../utils/permissionUtils';
import { CaseEditRequestModal } from './CaseEditRequestModal';

interface CaseDetailModalProps {
  caseItem: CaseLog | null;
  currentUser?: Officer | null;
  officers?: Officer[];
  onClose: () => void;
  onUpdateStatus?: (caseId: string, newStatus: CaseStatus, note?: string) => Promise<void>;
  onDeleteCase?: (caseId: string) => Promise<void> | void;
  onRequestEditSuccess?: (message?: string) => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseItem,
  currentUser,
  officers = [],
  onClose,
  onUpdateStatus,
  onDeleteCase,
  onRequestEditSuccess
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [showStatusChanger, setShowStatusChanger] = useState(false);
  const [showEditRequestModal, setShowEditRequestModal] = useState(false);

  if (!caseItem) return null;

  const isNormal = caseItem.type === 'NORMAL' || caseItem.case_type === 'Normal';
  const isTake2 = caseItem.type === 'TAKE2' || caseItem.case_type === 'Take2';
  const isRed = caseItem.type === 'RED_CASE' || caseItem.case_type === 'Red';
  const thaiType = isRed ? 'คดีแดง (RED CASE)' : isTake2 ? 'เคสพิเศษ (TAKE2)' : 'ลงเคสปกติ (NORMAL)';

  const creatorName = caseItem.created_by_name || caseItem.officer_name || 'Officer';
  const creatorBadge = caseItem.created_by_badge || caseItem.badge_number || '00';
  const creatorAvatar = caseItem.created_by_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120";

  const editEligibility = canRequestCaseEdit(currentUser, caseItem);

  const handleCopySummary = () => {
    const helpersStr = (caseItem.helpers && caseItem.helpers.length > 0)
      ? `\nผู้ช่วยเหลือ: ${caseItem.helpers.map(h => `${h.officer_name} (#${h.badge_number})`).join(', ')}`
      : '';
    const imagesStr = (caseItem.images && caseItem.images.length > 0)
      ? `\nภาพหลักฐาน: ${caseItem.images.length} รูป`
      : '';

    const text = `==============================\n[AROUND TOWN POLICE MDT]\nรหัสคดี: ${caseItem.case_number || caseItem.id}\nประเภท: ${thaiType}\nสถานะ: ${caseItem.status || 'OPEN'}\nผู้ลงคดี: ${creatorName} (#${creatorBadge})\nวันเวลาเกิดเหตุ: ${caseItem.incident_date || caseItem.timestamp} ${caseItem.incident_time || ''}\nหัวข้อ: ${caseItem.title}\nรายละเอียด: ${caseItem.description || caseItem.notes || '-'}${helpersStr}${imagesStr}\n==============================`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: CaseStatus) => {
    if (!onUpdateStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(caseItem.id, newStatus, statusNote);
      setShowStatusChanger(false);
      setStatusNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0b1220] border-2 border-slate-700/80 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto relative my-auto">
        
        {/* Top Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Case Number */}
              <span className="text-sm font-mono font-black px-3 py-1 rounded-xl bg-slate-900 text-amber-300 border border-slate-700 shadow-inner">
                {caseItem.case_number || caseItem.id}
              </span>

              {/* Type Badge */}
              <span className={`text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 uppercase ${
                isRed
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isTake2
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                {isRed ? <Flame className="w-3.5 h-3.5 text-rose-400" /> : isTake2 ? <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                <span>{thaiType}</span>
              </span>

              {/* Status Pill */}
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl ${
                caseItem.status === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : caseItem.status === 'IN_PROGRESS'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : caseItem.status === 'CLOSED'
                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                ● {caseItem.status || 'OPEN'}
              </span>

            </div>

            <h2 className="text-lg sm:text-xl font-black text-white pt-1">
              {caseItem.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anomaly Notice if flagged */}
        {caseItem.is_anomaly && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-700/80 text-rose-300 text-xs flex items-start space-x-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold">รายการผิดปกติ: {caseItem.anomaly_reason || 'ตรวจพบการบันทึกนอกเวลาปฏิบัติหน้าที่'}</p>
              <p className="text-[11px] text-rose-400 mt-0.5">รายการนี้ถูกส่งเข้า Validation Layer ตรวจสอบสิทธิ์เรียบร้อยแล้ว</p>
            </div>
          </div>
        )}

        {/* Creator & Incident Meta Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80">
          
          {/* Creator Profile */}
          <div className="flex items-center space-x-3">
            <img
              src={creatorAvatar}
              alt={creatorName}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-amber-500/60"
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-mono font-semibold">เจ้าหน้าที่ผู้ลงคดี (Investigating Officer)</p>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{creatorName}</span>
                <span className="font-mono text-xs text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                  #{creatorBadge}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">{caseItem.created_by_rank || 'Police Officer'}</p>
            </div>
          </div>

          {/* Incident Time & Location */}
          <div className="space-y-1 text-xs border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-2 sm:pt-0 sm:pl-4">
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-mono">{caseItem.incident_date || caseItem.created_at || caseItem.timestamp}</span>
              {caseItem.incident_time && <span className="font-mono font-bold text-amber-400">({caseItem.incident_time})</span>}
            </div>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              
            </div>
          </div>

        </div>

        {/* Description & Report Body */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>รายละเอียดพฤติการณ์คดี (Case Narrative & Details)</span>
          </h3>
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
            {caseItem.description || caseItem.notes || 'ไม่มีรายละเอียดเพิ่มเติม'}
          </div>
        </div>

        {/* Tagged Helper Officers */}
        {caseItem.helpers && caseItem.helpers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>ตำรวจผู้ร่วมปฏิบัติงาน / ช่วยเหลือ ({caseItem.helpers.length} นาย)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {caseItem.helpers.map((helper) => (
                <div
                  key={helper.id || helper.user_id}
                  className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <img
                    src={helper.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"}
                    alt={helper.officer_name}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                      <span>{helper.officer_name}</span>
                      <span className="font-mono text-[10px] text-amber-300">#{helper.badge_number}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{helper.rank || 'Officer'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Images Gallery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              <span>ภาพหลักฐานในที่เกิดเหตุ ({caseItem.images?.length || 0} รูป)</span>
            </h3>
            <span className="text-[11px] text-slate-500">คลิกที่รูปเพื่อขยายใหญ่</span>
          </div>

          {(!caseItem.images || caseItem.images.length === 0) ? (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
              ไม่มีรูปภาพหลักฐานแนบในคดีนี้
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {caseItem.images.map((img, idx) => (
                <div
                  key={img.id || idx}
                  onClick={() => setSelectedImageModal(img.url)}
                  className="group relative aspect-video rounded-2xl overflow-hidden border border-slate-800 hover:border-blue-500 bg-slate-950 cursor-pointer shadow-md"
                >
                  <img
                    src={img.url}
                    alt={img.filename || `Evidence ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="p-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow-lg">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>ขยายดูรูป</span>
                    </span>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-mono text-slate-300 font-bold">
                    หลักฐาน #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Audit History */}
        {caseItem.timeline && caseItem.timeline.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-400" />
              <span>ลำดับเหตุการณ์ & บันทึกระบบ (Timeline Audit Log)</span>
            </h3>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 max-h-48 overflow-y-auto">
              {caseItem.timeline.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start space-x-3 text-xs">
                  <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap mt-0.5">{item.timestamp}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300">{item.officer_name}</span>: <span className="text-slate-200">{item.action}</span>
                    {item.details && <p className="text-[11px] text-slate-400 mt-0.5">{item.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Update Control Section */}
        {onUpdateStatus && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-300">เปลี่ยนสถานะคดี (Case Status Management):</span>
                {!canModifyCase(currentUser, caseItem) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-rose-400" /> เฉพาะเข้าเวร / Admin
                  </span>
                )}
              </div>
              {canModifyCase(currentUser, caseItem) ? (
                <button
                  type="button"
                  onClick={() => setShowStatusChanger(!showStatusChanger)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  {showStatusChanger ? 'ซ่อน' : 'แก้ไขสถานะ'}
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium">ไม่มีสิทธิ์แก้ไขสถานะ</span>
              )}
            </div>

            {canModifyCase(currentUser, caseItem) && showStatusChanger && (
              <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as CaseStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus || caseItem.status === st}
                      onClick={() => handleStatusChange(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        caseItem.status === st
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopySummary}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{copied ? 'คัดลอกสรุปแล้ว!' : 'คัดลอกสรุปคดี'}</span>
            </button>

            {/* Request Case Edit Button */}
            <button
              type="button"
              onClick={() => {
                if (editEligibility.allowed) {
                  setShowEditRequestModal(true);
                }
              }}
              disabled={!editEligibility.allowed}
              title={editEligibility.allowed ? 'ส่งคำร้องขอแก้ไขคดีนี้' : editEligibility.reason}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                editEligibility.allowed
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/60 ring-1 ring-indigo-400/40'
                  : 'bg-slate-900 text-slate-500 border border-slate-800 opacity-60 cursor-not-allowed'
              }`}
            >
              {editEligibility.allowed ? (
                <Edit3 className="w-3.5 h-3.5 text-indigo-200" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>ขอแก้ไขคดี (Request Edit)</span>
            </button>

            {/* Admin or Creator Delete Case Button */}
            {onDeleteCase && (currentUser?.role === 'Leader' || currentUser?.role === 'Admin' || currentUser?.discord_id === caseItem.created_by) && (
              <button
                type="button"
                onClick={async () => {
                  await onDeleteCase(caseItem.id);
                  onClose();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100 text-xs font-bold border border-rose-800/80 transition-all cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>ลบคดีนี้ (Delete Case)</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-950/60 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* Lightbox Modal for Image Fullscreen Viewing */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            <img
              src={selectedImageModal}
              alt="Evidence Fullscreen"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
            <button
              onClick={() => setSelectedImageModal(null)}
              className="mt-4 px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              ปิดรูปขยาย
            </button>
          </div>
        </div>
      )}

      {/* Case Edit Request Modal */}
      {showEditRequestModal && (
        <CaseEditRequestModal
          caseItem={caseItem}
          currentUser={currentUser || null}
          officers={officers}
          onClose={() => setShowEditRequestModal(false)}
          onSuccess={(msg) => {
            setShowEditRequestModal(false);
            if (onRequestEditSuccess) onRequestEditSuccess(msg);
          }}
        />
      )}

    </div>
  );
};
