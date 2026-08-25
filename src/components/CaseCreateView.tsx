import React, { useState, useRef } from 'react';
import { 
  PlusCircle, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  Tag, 
  Search, 
  Loader2,
  Sparkles,
  Lock,
  UserCheck
} from 'lucide-react';
import { Officer, CaseType, CaseLog } from '../types';
import { isOnDuty, canCreateCase, getAvailableOnDutyOfficers } from '../utils/permissionUtils';

interface CaseCreateViewProps {
  currentUser: Officer | null;
  officers: Officer[];
  onCaseCreated: (newCase: CaseLog) => void;
  onNavigateToHistory: () => void;
  onToggleDuty?: () => void;
}

export const CaseCreateView: React.FC<CaseCreateViewProps> = ({
  currentUser,
  officers,
  onCaseCreated,
  onNavigateToHistory,
  onToggleDuty,
}) => {
  const isUserOnDuty = isOnDuty(currentUser);

  // Form State - Fast & Streamlined (Only Type, Images, and Tagged Helpers)
  const [caseType, setCaseType] = useState<'NORMAL' | 'TAKE2' | 'RED_CASE'>('NORMAL');

  // Helpers / Tagged Officers State - ONLY ON_DUTY officers can be tagged
  const [selectedHelpers, setSelectedHelpers] = useState<Officer[]>([]);
  const [helperSearch, setHelperSearch] = useState('');
  const [isHelperDropdownOpen, setIsHelperDropdownOpen] = useState(false);

  // Evidence Images State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<CaseLog | null>(null);

  // Handle image files selection
  const handleFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const validUrls: string[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    Array.from(files).forEach((file) => {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setErrorMessage(`ไฟล์ "${file.name}" ไม่ใช่ประเภทรูปภาพที่รองรับ (รองรับ JPG, PNG, WEBP)`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage(`ไฟล์ "${file.name}" มีขนาดเกิน 15MB`);
        return;
      }
      validFiles.push(file);
      validUrls.push(URL.createObjectURL(file));
    });

    if (validFiles.length > 0) {
      setErrorMessage(null);
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setPreviewUrls((prev) => [...prev, ...validUrls]);
    }
  };

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Officer tagging handlers - Strictly filter for ON_DUTY officers only
  const handleToggleHelper = (officer: Officer) => {
    if (!isOnDuty(officer)) {
      setErrorMessage(`ไม่สามารถแท็ก ${officer.officer_name} ได้ เนื่องจากอยู่นอกเวลาเวร (OFF_DUTY)`);
      return;
    }
    if (selectedHelpers.some((h) => h.discord_id === officer.discord_id)) {
      setSelectedHelpers((prev) => prev.filter((h) => h.discord_id !== officer.discord_id));
    } else {
      setSelectedHelpers((prev) => [...prev, officer]);
    }
  };

  // Strictly filter ON_DUTY officers for tagging
  const availableOfficersToTag = getAvailableOnDutyOfficers(
    officers,
    currentUser?.discord_id,
    helperSearch
  );

  // Form Submit Handler (Fast-Track: Only requires >= 1 Image & Type)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Strict Duty Check
    if (!isUserOnDuty) {
      setErrorMessage('⛔ คุณอยู่นอกเวลาปฏิบัติหน้าที่ (OFF_DUTY) - ต้องเข้าเวรก่อนจึงจะสามารถส่งบันทึกคดีได้');
      return;
    }

    // Strict Image Validation
    if (selectedFiles.length === 0) {
      setErrorMessage('⚠️ กฎระเบียบสถานี: ต้องแนบรูปภาพหลักฐานอย่างน้อย 1 รูปก่อนส่งคดี');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('type', caseType);

      // Serialize helpers
      const helpersPayload = selectedHelpers.map((h) => ({
        user_id: h.discord_id,
        officer_name: h.officer_name,
        badge_number: h.badge_number,
        rank: h.rank,
        avatar: h.avatar,
      }));
      formData.append('helpers', JSON.stringify(helpersPayload));

      // Append image files
      selectedFiles.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/cases', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถสร้างคดีได้');
      }

      // Success
      onCaseCreated(data.case);
      setSuccessModalData(data.case);

      // Reset form
      setSelectedHelpers([]);
      setSelectedFiles([]);
      setPreviewUrls([]);
    } catch (err: any) {
      console.error('Submit case error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูลคดี');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-7 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1627] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <PlusCircle className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest text-blue-400 uppercase">
                FAST CASE DISPATCH
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ลงบันทึกคดี (Create Case)
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              แนบภาพหลักฐานจากสถานที่เกิดเหตุและเลือกแท็กตำรวจผู้ร่วมปฏิบัติงานเพื่อบันทึกประวัติและคำนวณเบี้ยเลี้ยงอัตโนมัติ
            </p>
          </div>

          <button
            onClick={onNavigateToHistory}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>ดูประวัติการลงเคส</span>
          </button>
        </div>
      </div>

      {/* Strict Off-Duty Warning Banner */}
      {!isUserOnDuty && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/80 border-2 border-rose-600/70 shadow-2xl shadow-rose-950/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-600/30 border border-rose-500 text-rose-300 shrink-0 mt-0.5">
              <Lock className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-mono text-[10px] font-black">
                  10-7 OFF DUTY
                </span>
                <h3 className="text-sm font-bold text-white">คุณอยู่นอกเวลาปฏิบัติหน้าที่ (OFF_DUTY)</h3>
              </div>
              <p className="text-xs text-rose-200/90 mt-1 max-w-xl">
                ระบบควบคุมสิทธิ์เคร่งครัด: เจ้าหน้าที่ต้องเข้าเวรปฏิบัติหน้าที่ (ON_DUTY) ก่อนจึงจะสามารถสร้างคดี แนบหลักฐาน และแท็กเพื่อนร่วมงานได้
              </p>
            </div>
          </div>

          {onToggleDuty && (
            <button
              type="button"
              id="create-view-clock-in-btn"
              onClick={onToggleDuty}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/60 border border-emerald-400/50 transition-all cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4 text-emerald-200" />
              <span>กดเข้าเวรทันที (Clock In)</span>
            </button>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-600/60 text-rose-200 text-sm flex items-start space-x-3 shadow-lg animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">ไม่สามารถบันทึกคดีได้</p>
            <p className="text-rose-300/90 text-xs mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Step 1: Select Case Type */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
              <span>เลือกประเภทคดี (Case Type)</span>
              <span className="text-rose-400">*</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">กำหนดอัตราตอบแทน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* NORMAL */}
            <div
              onClick={() => setCaseType('NORMAL')}
              className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                caseType === 'NORMAL'
                  ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-950/50 ring-1 ring-blue-400/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  {caseType === 'NORMAL' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                      เลือกอยู่
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white">ลงเคสปกติ (NORMAL)</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  จับกุมทั่วไป, ตรวจค้นสิ่งผิดกฎหมาย, ใบสั่งจราจร
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">ค่าเคส:</span>
                <span className="font-mono font-bold text-blue-300">฿1,000</span>
              </div>
            </div>

            {/* TAKE2 */}
            <div
              onClick={() => setCaseType('TAKE2')}
              className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                caseType === 'TAKE2'
                  ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/50 ring-1 ring-amber-400/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  {caseType === 'TAKE2' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      เลือกอยู่
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white">เคสพิเศษ (TAKE2)</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  ไล่ล่ารถเร็วสูง (Code 3), ปล้นร้านค้า/ธนาคารเล็ก
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">ค่าเคสพิเศษ:</span>
                <span className="font-mono font-bold text-amber-300">฿2,500</span>
              </div>
            </div>

            {/* RED_CASE */}
            <div
              onClick={() => setCaseType('RED_CASE')}
              className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                caseType === 'RED_CASE'
                  ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/50 ring-1 ring-rose-400/40'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Flame className="w-5 h-5" />
                  </div>
                  {caseType === 'RED_CASE' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      เลือกอยู่
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white">คดีแดง (RED CASE)</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  ปล้นธนาคารใหญ่, ก่อการร้าย, ยิงเจ้าหน้าที่, SWAT
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">ค่าคดีสูงสุด:</span>
                <span className="font-mono font-bold text-rose-300">฿5,000</span>
              </div>
            </div>

          </div>
        </div>

        {/* Step 2: Evidence Images Upload (REQUIRED >= 1) */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
              <span>แนบภาพหลักฐานในที่เกิดเหตุ (Evidence Images)</span>
              <span className="text-rose-400 font-bold">*</span>
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-700/50">
              ต้องแนบอย่างน้อย 1 รูป
            </span>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer relative ${
              isDragging
                ? 'border-blue-400 bg-blue-950/30'
                : selectedFiles.length > 0
                ? 'border-slate-700 hover:border-slate-600 bg-slate-900/40'
                : 'border-blue-500/40 hover:border-blue-400 bg-slate-950/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  ลากไฟล์รูปภาพมาวางที่นี่ หรือ <span className="text-blue-400 underline">คลิกเพื่อเลือกไฟล์</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  รองรับไฟล์ภาพ JPG, PNG, WEBP (สูงสุด 10 รูป, ไฟล์ละไม่เกิน 15MB)
                </p>
              </div>
            </div>
          </div>

          {/* Selected Images Grid Preview */}
          {previewUrls.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>รูปหลักฐานที่แนบแล้ว ({previewUrls.length} รูป):</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านเกณฑ์การแนบรูป
                </span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 aspect-video shadow-md">
                    <img
                      src={url}
                      alt={`evidence-${idx}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(idx);
                        }}
                        className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg cursor-pointer"
                        title="ลบรูปนี้"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-slate-300 font-bold">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Tag Officer Helpers */}
        <div className="bg-[#0b1220] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white flex items-center gap-2 uppercase tracking-wide">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">3</span>
              <span>แท็กตำรวจผู้ร่วมปฏิบัติงาน / ช่วยเหลือ (Tag Officers)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                เข้าเวรอยู่ ({availableOfficersToTag.length} นาย)
              </span>
            </div>
          </div>

          {/* Selected Tagged Officers Pills */}
          {selectedHelpers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              {selectedHelpers.map((helper) => (
                <div
                  key={helper.discord_id}
                  className="flex items-center space-x-2 pl-2 pr-1.5 py-1 rounded-xl bg-blue-950/70 border border-blue-500/40 text-blue-200 text-xs font-semibold shadow-sm"
                >
                  <img
                    src={helper.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                    alt={helper.officer_name}
                    className="w-4 h-4 rounded-full object-cover ring-1 ring-blue-400"
                  />
                  <span>{helper.officer_name}</span>
                  <span className="font-mono text-[10px] text-amber-300 font-bold">#{helper.badge_number}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleHelper(helper)}
                    className="p-0.5 hover:bg-blue-800/80 rounded-full text-blue-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search & Select Officer Box */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="officer-tag-search-input"
                type="text"
                value={helperSearch}
                onFocus={() => setIsHelperDropdownOpen(true)}
                onChange={(e) => {
                  setHelperSearch(e.target.value);
                  setIsHelperDropdownOpen(true);
                }}
                placeholder="ค้นหาชื่อตำรวจ หรือ รหัส Badge (#01, #02...) เพื่อแท็ก..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus:border-blue-500 text-white placeholder-slate-500 text-xs font-medium"
              />
            </div>

            {/* Officers Selection Grid / Dropdown */}
            {isHelperDropdownOpen && (
              <div className="max-h-60 overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-2 space-y-1 divide-y divide-slate-800 shadow-2xl">
                {availableOfficersToTag.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 text-center">ไม่พบเจ้าหน้าที่ตรงกับคำค้นหา</p>
                ) : (
                  availableOfficersToTag.map((off) => {
                    const isSelected = selectedHelpers.some((h) => h.discord_id === off.discord_id);
                    return (
                      <div
                        key={off.discord_id}
                        onClick={() => handleToggleHelper(off)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected ? 'bg-blue-950/60 border border-blue-500/40 text-blue-200' : 'hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={off.avatar}
                            alt={off.officer_name}
                            className="w-7 h-7 rounded-xl object-cover ring-1 ring-slate-700"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-white">{off.officer_name}</span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                #{off.badge_number}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{off.rank} &bull; {off.department}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {isSelected ? 'แท็กแล้ว' : '+ แท็ก'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Creator Identity Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <img
              src={currentUser?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
              alt={currentUser?.officer_name}
              className="w-8 h-8 rounded-xl object-cover ring-1 ring-amber-500/50"
            />
            <div>
              <p className="text-slate-200 font-bold">
                ผู้ลงคดี: <span className="text-amber-300">{currentUser?.officer_name}</span> (#{currentUser?.badge_number})
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Discord ID: {currentUser?.discord_id || '-'} &bull; ยศ: {currentUser?.rank}
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-right">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-700/40 text-[11px] font-bold">
              ✓ บัญชีเจ้าหน้าที่ที่เข้าสู่ระบบ
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 pt-2">
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold transition-all cursor-pointer"
          >
            ยกเลิก
          </button>
          
          <button
            id="submit-case-btn"
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-950/60 border border-blue-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>กำลังบันทึกคดีและอัปโหลดรูป...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>ส่งบันทึกคดี (Submit Case)</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Success Modal */}
      {successModalData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border-2 border-emerald-500/60 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-center">
            
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                CASE DISPATCHED SUCCESSFULLY
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                ลงบันทึกคดีสำเร็จ!
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                ระบบได้สร้างรหัสคดีและส่งการแจ้งเตือนไปยังผู้ช่วยเหลือเรียบร้อยแล้ว
              </p>
            </div>

            {/* Case Info Box */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-mono">รหัสคดี:</span>
                <span className="font-mono font-black text-amber-400 text-sm">{successModalData.case_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">ประเภทคดี:</span>
                <span className="font-bold text-white">
                  {successModalData.type === 'NORMAL' ? 'ลงเคสปกติ' : successModalData.type === 'TAKE2' ? 'เคสพิเศษ (Take2)' : 'คดีแดง'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">รูปภาพหลักฐาน:</span>
                <span className="font-mono font-bold text-emerald-400">{successModalData.images?.length || 0} รูป</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">ผู้ร่วมปฏิบัติงาน:</span>
                <span className="font-bold text-blue-300">{successModalData.helpers?.length || 0} นาย</span>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSuccessModalData(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                ลงเคสเพิ่มอีก
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  onNavigateToHistory();
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-950/60 cursor-pointer"
              >
                ไปที่หน้ารวมประวัติคดี &rarr;
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

