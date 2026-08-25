import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  RotateCw, 
  Filter, 
  Clock, 
  FileText, 
  Check, 
  X,
  Search,
  ExternalLink,
  Info
} from 'lucide-react';
import { AnomalyLog, Officer } from '../types';

interface ValidationLayerViewProps {
  currentUser: Officer;
  anomalies: AnomalyLog[];
  onRunScan: () => void;
  onResolveAnomaly: (anomalyId: string, action: 'Approve' | 'Dismiss', note?: string) => void;
}

export const ValidationLayerView: React.FC<ValidationLayerViewProps> = ({
  currentUser,
  anomalies,
  onRunScan,
  onResolveAnomaly,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'Unresolved' | 'Approved' | 'Dismissed'>('Unresolved');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyLog | null>(null);
  const [actionType, setActionType] = useState<'Approve' | 'Dismiss'>('Approve');
  const [resolutionNote, setResolutionNote] = useState('');

  const isLeaderOrAdmin = currentUser.role === 'Leader' || currentUser.role === 'Admin';

  const handleTriggerScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      onRunScan();
      setIsScanning(false);
    }, 600);
  };

  const handleOpenResolve = (anomaly: AnomalyLog, action: 'Approve' | 'Dismiss') => {
    setSelectedAnomaly(anomaly);
    setActionType(action);
    setResolutionNote(action === 'Approve' ? 'อนุมัติข้อยกเว้นพิเศษโดยหัวหน้า' : 'ตัดสิทธิ์คดีเนื่องจากอยู่นอกเวลาปฏิบัติหน้าที่');
  };

  const handleConfirmResolve = () => {
    if (!selectedAnomaly) return;
    onResolveAnomaly(selectedAnomaly.id, actionType, resolutionNote);
    setSelectedAnomaly(null);
  };

  const filteredAnomalies = anomalies.filter(a => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  const unresolvedCount = anomalies.filter(a => a.status === 'Unresolved').length;

  return (
    <div className="space-y-6">
      
      {/* Admin Clearance Alert Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gradient-to-r from-rose-950/60 via-amber-950/40 to-slate-900 border border-rose-500/40 text-xs shadow-sm">
        <div className="flex items-center space-x-2 text-rose-300 font-bold">
          <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="uppercase tracking-wider">ADMIN COMMAND &bull; หน่วยตรวจสอบและควบคุมความถูกต้อง</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-rose-600/80 text-white font-mono text-[10px] font-bold">
          AUDIT CLEARANCE
        </span>
      </div>

      {/* Header Banner */}
      <div className="bento-card bento-card-crimson p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-black uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>DUTY & CASE LOG VALIDATION LAYER</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            ระบบตรวจสอบความสอดคล้อง (Duty & Case Discrepancy Validator)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ตรวจจับความผิดปกติ เช่น การรับคดีโดยไม่มีบันทึกเข้าเวร, การลงคดีนอกเวลาปฏิบัติหน้าที่, หรือการบันทึกคดีซ้ำซ้อน
          </p>
        </div>

        {/* Scan Button & Status Counter */}
        <div className="flex items-center space-x-3">
          <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-rose-800/40 text-right shadow-inner">
            <p className="text-[10px] text-slate-400">รายการผิดปกติรอการตรวจสอบ</p>
            <p className="text-sm font-mono font-black text-rose-400">{unresolvedCount} รายการ</p>
          </div>

          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'กำลังสแกน...' : 'รันสแกนตรวจสอบ (Scan Logs)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bento-card p-3.5 flex items-center justify-between text-xs">
        <div className="flex space-x-2">
          {(['Unresolved', 'all', 'Approved', 'Dismissed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                filterStatus === status
                  ? status === 'Unresolved'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                    : 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {status === 'Unresolved' ? `รอตรวจสอบ (${unresolvedCount})` : status === 'all' ? 'ทั้งหมด' : status === 'Approved' ? 'อนุมัติข้อยกเว้น' : 'ตัดสิทธิ์/ปฏิเสธ'}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
          &bull; Real-time Discrepancy Matching
        </span>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {filteredAnomalies.length === 0 ? (
          <div className="bento-card p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
            <p className="text-sm font-bold text-slate-200">ไม่พบความผิดปกติในหมวดหมู่นี้</p>
            <p className="text-xs text-slate-500">ข้อมูลการเข้าเวรและการรับคดีทั้งหมดมีความสอดคล้องถูกต้อง</p>
          </div>
        ) : (
          filteredAnomalies.map((item) => (
            <div
              key={item.id}
              className={`bento-card p-4 transition-all space-y-3 ${
                item.status === 'Unresolved'
                  ? item.severity === 'critical'
                    ? 'bento-card-crimson shadow-lg'
                    : 'border-amber-800/50'
                  : 'opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    item.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
                  }`}>
                    {item.severity === 'critical' ? 'CRITICAL DISCREPANCY' : 'WARNING'}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">#{item.badge_number} {item.officer_name}</span>
                  <span className="text-[10px] text-slate-400">&bull; {item.type}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.status === 'Unresolved'
                      ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                      : item.status === 'Approved'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.status === 'Unresolved' ? 'รอพิจารณา' : item.status === 'Approved' ? 'อนุมัติข้อยกเว้น' : 'ตัดสิทธิ์/ปฏิเสธ'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{item.timestamp}</span>
                </div>
              </div>

              {/* Description Body */}
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start space-x-2.5">
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${item.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} />
                <div className="space-y-1 flex-1">
                  <p>{item.description}</p>
                  {item.case_number && (
                    <p className="text-[11px] text-slate-400">
                      เลขคดีอ้างอิง: <span className="text-amber-300 font-mono font-bold">{item.case_number}</span> (ประเภท: {item.case_type})
                    </p>
                  )}
                  {item.resolution_note && (
                    <p className="text-[11px] text-emerald-300 pt-1 border-t border-slate-800">
                      บันทึกการพิจารณา: {item.resolution_note}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons for Leader/Admin */}
              {item.status === 'Unresolved' && isLeaderOrAdmin && (
                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    onClick={() => handleOpenResolve(item, 'Dismiss')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-300 text-xs font-bold border border-rose-900/40 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ตัดสิทธิ์คดี (Dismiss)</span>
                  </button>
                  <button
                    onClick={() => handleOpenResolve(item, 'Approve')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>อนุมัติข้อยกเว้นพิเศษ (Approve)</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Resolution Confirmation Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {actionType === 'Approve' ? 'อนุมัติข้อยกเว้นพิเศษการรับคดี' : 'ตัดสิทธิ์/ปฏิเสธการรับคดี'}
              </h3>
              <button onClick={() => setSelectedAnomaly(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-slate-900 rounded-xl space-y-1">
                <p className="text-slate-400">เจ้าหน้าที่: <span className="text-white font-bold">{selectedAnomaly.officer_name} (#{selectedAnomaly.badge_number})</span></p>
                <p className="text-slate-400">รายการ: <span className="text-slate-200">{selectedAnomaly.description}</span></p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">เหตุผลและบันทึกการพิจารณา (Resolution Note)</label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmResolve}
                  className={`flex-1 py-2 rounded-xl font-bold text-white shadow-lg ${
                    actionType === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  ยืนยันบันทึกผล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
