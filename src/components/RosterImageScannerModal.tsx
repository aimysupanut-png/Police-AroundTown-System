import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight, 
  RefreshCw, 
  FileText, 
  Shield, 
  Check, 
  ListFilter, 
  UserPlus, 
  SortAsc,
  Layers,
  Image as ImageIcon,
  Plus,
  Trash2,
  ClipboardList,
  CheckSquare,
  Square,
  FileSpreadsheet
} from 'lucide-react';
import { Officer, ScannedOfficer, OfficerRank, OfficerRole } from '../types';

interface RosterImageScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingOfficers: Officer[];
  onImportSuccess: (resultMessage: string) => void;
}

export const RosterImageScannerModal: React.FC<RosterImageScannerModalProps> = ({
  isOpen,
  onClose,
  existingOfficers,
  onImportSuccess
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [deepScanMode, setDeepScanMode] = useState<boolean>(true);
  const [scannedOfficers, setScannedOfficers] = useState<ScannedOfficer[]>([]);
  const [scanSummary, setScanSummary] = useState<{ total: number; newCount: number; duplicateCount: number } | null>(null);
  const [autoSortAZ, setAutoSortAZ] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Quick Text Paste Modal/Drawer
  const [showTextImporter, setShowTextImporter] = useState<boolean>(false);
  const [pastedRosterText, setPastedRosterText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawBase64 = event.target?.result as string;
      
      // Preserve sharp resolution for table OCR while ensuring reasonable payload size (< 3MB)
      const img = new Image();
      img.onload = () => {
        const maxDimension = 2048;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.92);
          setSelectedImage(compressed);
          setImageMime('image/jpeg');
        } else {
          setSelectedImage(rawBase64);
          setImageMime(file.type || 'image/jpeg');
        }
        setScanError(null);
      };
      img.onerror = () => {
        setSelectedImage(rawBase64);
        setImageMime(file.type || 'image/jpeg');
        setScanError(null);
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Load sample roster image
  const handleLoadSampleImage = () => {
    // Generate high contrast demo roster canvas dataURL
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 400);
      
      // Header
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('POLICE DEPARTMENT - ACTIVE ROSTER', 24, 40);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('Official Department Personnel Registry 2026', 24, 65);
      
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, 80);
      ctx.lineTo(616, 80);
      ctx.stroke();

      // Officers entries
      const sampleLines = [
        '1. ผู้บัญชาการตำรวจ Alex Vance - High Command',
        '2. รองผู้บัญชาการตำรวจ Damon Stone - High Command',
        '3. ครูฝึก Gordon Freeman - SWAT / Special Response',
        '4. สารวัตร Marcus Brody - Patrol Division',
        '5. หมวด Benjamin Hayes - Patrol Division',
        '6. จ่า Charlotte Evans - Traffic Enforcement',
        '7. นักเรียนตำรวจ Daniel Craig - Patrol Division',
        '8. นักเรียนตำรวจ Hannah Abbott - Patrol Division'
      ];

      ctx.fillStyle = '#ffffff';
      ctx.font = '15px monospace';
      sampleLines.forEach((line, i) => {
        ctx.fillText(line, 24, 115 + (i * 32));
      });
    }

    const sampleUrl = canvas.toDataURL('image/png');
    setSelectedImage(sampleUrl);
    setImageMime('image/png');
    setScanError(null);
  };

  // Trigger AI Scan
  const handleStartScan = async () => {
    if (!selectedImage) return;
    setIsScanning(true);
    setScanError(null);

    try {
      const res = await fetch('/api/officers/scan-roster-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: selectedImage,
          mime_type: imageMime,
          deep_scan: deepScanMode
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณากดลองใหม่อีกครั้ง หรือใช้ปุ่มวางข้อความรายชื่อ');
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan roster image');
      }

      const receivedList: ScannedOfficer[] = data.scanned_officers || [];
      setScannedOfficers(receivedList);
      setScanSummary({
        total: receivedList.length,
        newCount: receivedList.filter(s => !s.already_exists).length,
        duplicateCount: receivedList.filter(s => s.already_exists).length
      });
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'เกิดข้อผิดพลาดในการสแกนรูปภาพ กรุณาลองใหม่อีกครั้ง หรือใช้ปุ่มวางข้อความรายชื่อ');
    } finally {
      setIsScanning(false);
    }
  };

  // Add a manual blank row
  const handleAddEmptyRow = () => {
    const newId = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const taken = new Set([
      ...existingOfficers.map(o => o.badge_number.trim()),
      ...scannedOfficers.map(s => (s.badge_number || '').trim())
    ]);
    let nextNum = 1;
    while (taken.has(nextNum < 10 ? `0${nextNum}` : `${nextNum}`)) {
      nextNum++;
    }
    const assignedBadge = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;

    const newOfficer: ScannedOfficer = {
      id: newId,
      officer_name: `นายตำรวจใหม่ ${scannedOfficers.length + 1}`,
      rank: 'นักเรียนตำรวจ',
      badge_number: assignedBadge,
      department: 'Patrol Division',
      role: 'Member',
      already_exists: false,
      selected_for_import: true
    };

    const updated = [newOfficer, ...scannedOfficers];
    setScannedOfficers(updated);
    setScanSummary({
      total: updated.length,
      newCount: updated.filter(s => !s.already_exists).length,
      duplicateCount: updated.filter(s => s.already_exists).length
    });
  };

  // Delete a scanned row
  const handleDeleteOfficerRow = (id: string) => {
    const updated = scannedOfficers.filter(o => o.id !== id);
    setScannedOfficers(updated);
    setScanSummary({
      total: updated.length,
      newCount: updated.filter(s => !s.already_exists).length,
      duplicateCount: updated.filter(s => s.already_exists).length
    });
  };

  // Select all / Deselect all
  const handleSelectAll = (select: boolean) => {
    setScannedOfficers(prev => prev.map(o => {
      if (o.already_exists) return o;
      return { ...o, selected_for_import: select };
    }));
  };

  // Toggle selection for import
  const handleToggleOfficerSelection = (id: string) => {
    setScannedOfficers(prev => prev.map(o => {
      if (o.id === id) {
        return { ...o, selected_for_import: !o.selected_for_import };
      }
      return o;
    }));
  };

  // Update scanned officer fields
  const handleUpdateScannedOfficer = (id: string, updates: Partial<ScannedOfficer>) => {
    setScannedOfficers(prev => prev.map(o => {
      if (o.id === id) {
        // If officer_name was changed, re-check duplicate status
        if (updates.officer_name !== undefined) {
          const clean = updates.officer_name.trim().toLowerCase();
          const existing = existingOfficers.find(e => e.officer_name.trim().toLowerCase() === clean);
          return {
            ...o,
            ...updates,
            already_exists: !!existing,
            existing_badge: existing?.badge_number,
            existing_rank: existing?.rank,
            selected_for_import: !existing ? (o.selected_for_import ?? true) : false
          };
        }
        return { ...o, ...updates };
      }
      return o;
    }));
  };

  // Parse raw text list from Discord or Sheet
  const handleParsePastedText = () => {
    if (!pastedRosterText.trim()) return;

    const lines = pastedRosterText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedItems: ScannedOfficer[] = [];

    const validRanks: OfficerRank[] = [
      'ผู้บัญชาการตำรวจ',
      'รองผู้บัญชาการตำรวจ',
      'ครูฝึก',
      'สารวัตร',
      'หมวด',
      'จ่า',
      'นักเรียนตำรวจ'
    ];

    const taken = new Set([
      ...existingOfficers.map(o => o.badge_number.trim()),
      ...scannedOfficers.map(s => (s.badge_number || '').trim())
    ]);
    let nextNum = 1;

    lines.forEach((line, idx) => {
      // Check for leading badge number (e.g. "#01", "01.", "1 -", "[05]")
      let detectedBadge = "";
      const badgeMatch = line.match(/^\[?#?(\d{1,3})\]?[\.\-\s:]+/);
      if (badgeMatch) {
        const num = parseInt(badgeMatch[1], 10);
        detectedBadge = num < 10 ? `0${num}` : `${num}`;
      }

      // Clean leading digits, bullet points, callsigns
      let cleanLine = line.replace(/^([#\d]+[\.\-\s:]+)/, '').trim();
      cleanLine = cleanLine.replace(/^\[#?\d+\]\s*/, '').trim();
      cleanLine = cleanLine.replace(/^([•\-\*]+)\s*/, '').trim();

      // Detect rank inside text
      let detectedRank: OfficerRank = 'นักเรียนตำรวจ';
      for (const r of validRanks) {
        if (cleanLine.includes(r)) {
          detectedRank = r;
          cleanLine = cleanLine.replace(r, '').trim();
          break;
        }
      }

      if (cleanLine.includes('ผบ.') || cleanLine.includes('ผู้การ') || cleanLine.toLowerCase().includes('chief')) {
        detectedRank = cleanLine.includes('รอง') ? 'รองผู้บัญชาการตำรวจ' : 'ผู้บัญชาการตำรวจ';
        cleanLine = cleanLine.replace(/ผบ\.|ผู้การ|Chief/gi, '').trim();
      } else if (cleanLine.includes('ครูฝึก') || cleanLine.toLowerCase().includes('trainer') || cleanLine.toLowerCase().includes('fto')) {
        detectedRank = 'ครูฝึก';
        cleanLine = cleanLine.replace(/ครูฝึก|Trainer|FTO/gi, '').trim();
      } else if (cleanLine.includes('สารวัตร') || cleanLine.includes('สว.') || cleanLine.toLowerCase().includes('inspector')) {
        detectedRank = 'สารวัตร';
        cleanLine = cleanLine.replace(/สารวัตร|สว\.|Inspector/gi, '').trim();
      } else if (cleanLine.includes('หมวด') || cleanLine.includes('ร.ต.') || cleanLine.toLowerCase().includes('lieutenant')) {
        detectedRank = 'หมวด';
        cleanLine = cleanLine.replace(/หมวด|ร\.ต\.|Lieutenant/gi, '').trim();
      } else if (cleanLine.includes('จ่า') || cleanLine.includes('ด.ต.') || cleanLine.toLowerCase().includes('sergeant')) {
        detectedRank = 'จ่า';
        cleanLine = cleanLine.replace(/จ่า|ด\.ต\.|Sergeant/gi, '').trim();
      }

      // Strip separators
      cleanLine = cleanLine.replace(/^[\-:\/|]+/, '').replace(/[\-:\/|]+$/, '').trim();
      if (!cleanLine) cleanLine = `Officer ${idx + 1}`;

      const existing = existingOfficers.find(e => e.officer_name.trim().toLowerCase() === cleanLine.toLowerCase());

      let assignedBadge = "";
      if (existing) {
        assignedBadge = existing.badge_number;
      } else if (detectedBadge && !taken.has(detectedBadge)) {
        assignedBadge = detectedBadge;
        taken.add(assignedBadge);
      } else {
        while (taken.has(nextNum < 10 ? `0${nextNum}` : `${nextNum}`)) {
          nextNum++;
        }
        assignedBadge = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
        taken.add(assignedBadge);
        nextNum++;
      }

      parsedItems.push({
        id: `TEXT-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        officer_name: cleanLine,
        rank: detectedRank,
        badge_number: assignedBadge,
        department: detectedRank === 'ผู้บัญชาการตำรวจ' || detectedRank === 'รองผู้บัญชาการตำรวจ' ? 'High Command' : 'Patrol Division',
        role: (detectedRank === 'ผู้บัญชาการตำรวจ' || detectedRank === 'รองผู้บัญชาการตำรวจ') ? 'Leader' : (detectedRank === 'ครูฝึก' || detectedRank === 'สารวัตร') ? 'Admin' : 'Member',
        already_exists: !!existing,
        existing_badge: existing?.badge_number,
        existing_rank: existing?.rank,
        selected_for_import: !existing
      });
    });

    const combined = [...scannedOfficers, ...parsedItems];
    setScannedOfficers(combined);
    setScanSummary({
      total: combined.length,
      newCount: combined.filter(s => !s.already_exists).length,
      duplicateCount: combined.filter(s => s.already_exists).length
    });

    setPastedRosterText('');
    setShowTextImporter(false);
  };

  // Execute Batch Import & Auto A-Z Numbering
  const handleApplyRoster = async () => {
    const toImport = scannedOfficers.filter(o => o.selected_for_import && !o.already_exists);
    if (toImport.length === 0) {
      alert('ไม่มีรายชื่อใหม่ที่ถูกเลือกสำหรับการนำเข้า');
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/officers/apply-batch-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officers_to_add: toImport,
          auto_sort_az_and_renumber: autoSortAZ
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to apply batch roster');
      }

      onImportSuccess(data.message || `เพิ่มตำรวจใหม่ ${data.added_count} นาย และจัดเรียง A-Z สำเร็จ`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || 'ไม่สามารถนำเข้ารายชื่อได้');
    } finally {
      setIsApplying(false);
    }
  };

  // Calculate A-Z preview of all merged officers
  const newOfficersToImport = scannedOfficers.filter(s => s.selected_for_import && !s.already_exists);
  const combinedRosterNames = [
    ...existingOfficers.map(o => o.officer_name),
    ...newOfficersToImport.map(s => s.officer_name)
  ].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                สแกนรูปภาพ & นำเข้ารายชื่อตำรวจด้วย AI (AI OCR Roster Onboarding)
              </h2>
              <p className="text-xs text-slate-400">
                อ่านรายชื่อจากภาพทุกคอลัมน์ &bull; ตรวจจับชื่อซ้ำอัตโนมัติ &bull; รองรับการเติมชื่อที่ขาด &bull; จัดเรียง A-Z พร้อมรันเลขประจำตัว
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

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto pr-1 space-y-5 flex-1 custom-scrollbar">

          {/* STEP 1: Upload & Controls Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Upload Dropzone */}
            <div className="lg:col-span-6 space-y-3">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] ${
                  selectedImage 
                    ? 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10' 
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/png, image/jpeg, image/webp, image/gif" 
                  className="hidden" 
                />
                
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                
                <p className="text-xs font-bold text-white">
                  ลากไฟล์รูปภาพมาวางที่นี่ หรือ <span className="text-amber-400 underline">คลิกเลือกไฟล์</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  รองรับภาพบอร์ดสถานี, สกรีนช็อต Discord หลายคอลัมน์, ตาราง Excel, รายชื่อแคทดิกต์
                </p>
              </div>

              {/* Action Buttons: Sample + Paste Text Importer */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleImage}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>โหลดตัวอย่างภาพ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTextImporter(!showTextImporter)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-[11px] font-bold text-indigo-200 border border-indigo-500/40 transition-colors cursor-pointer"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                    <span>วางข้อความรายชื่อ (Paste List)</span>
                  </button>
                </div>

                {selectedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setScanError(null);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    ลบรูปภาพ
                  </button>
                )}
              </div>
            </div>

            {/* Image Preview & Scan Action */}
            <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-[160px]">
              {selectedImage ? (
                <div className="space-y-2.5">
                  <div className="relative rounded-xl overflow-hidden max-h-[110px] bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <img 
                      src={selectedImage} 
                      alt="Roster Preview" 
                      className="w-full h-full object-contain max-h-[110px]" 
                    />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 font-mono text-[10px] text-amber-400">
                      พร้อมสแกน
                    </span>
                  </div>

                  {/* Deep Scan Toggle */}
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={deepScanMode}
                        onChange={(e) => setDeepScanMode(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>โหมดสแกนครอบคลุมทุกคอลัมน์ (Deep Exhaustive Scan)</span>
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">Gemini 3.7 Vision</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartScan}
                    disabled={isScanning}
                    className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer ${
                      isScanning 
                        ? 'bg-slate-800 text-slate-400 cursor-wait' 
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Gemini Vision กำลังตรวจหาชื่อทุกคอลัมน์อย่างละเอียด...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>เริ่มสแกนอ่านรายชื่อทั้งหมดด้วย AI (Start AI OCR)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                  <FileText className="w-8 h-8 mb-2 opacity-40" />
                  <span>ยังไม่ได้เลือกรูปภาพ &mdash; อัปโหลดภาพหรือคลิก "วางข้อความรายชื่อ" เพื่อใส่ชื่อโดยตรง</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Paste Drawer */}
          {showTextImporter && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-300 font-bold text-xs">
                  <ClipboardList className="w-4 h-4 text-indigo-400" />
                  <span>วางข้อความรายชื่อเพื่อนำเข้า / เติมชื่อที่สแกนไม่ติด (Paste Text Roster)</span>
                </div>
                <button 
                  onClick={() => setShowTextImporter(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                สามารถคัดลอกรายชื่อจาก Discord, บันทึกข้อความ หรือ Excel วางลงในช่องนี้ได้ทันที (แยก 1 บรรทัดต่อ 1 นาย)
              </p>

              <textarea
                value={pastedRosterText}
                onChange={(e) => setPastedRosterText(e.target.value)}
                placeholder={`ตัวอย่างเช่น:\n1. ผู้บัญชาการ Alex Vance\n2. สารวัตร Marcus Brody\n3. จ่า Charlotte Evans\nGordon Freeman`}
                rows={4}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400 font-mono"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTextImporter(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  disabled={!pastedRosterText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black transition-colors disabled:opacity-40 flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>แปลงข้อความ & เพิ่มลงตาราง</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {scanError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{scanError}</span>
            </div>
          )}

          {/* STEP 2: Scanned Results & Deduplication Table */}
          {scannedOfficers.length > 0 && (
            <div className="space-y-4 pt-1">
              
              {/* Summary Badges */}
              {scanSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">รายชื่อในตารางทั้งหมด</span>
                    <p className="text-lg font-black text-white font-mono mt-0.5">{scanSummary.total} นาย</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                    <span className="text-[11px] text-emerald-400 font-bold">รายชื่อใหม่ (พร้อมนำเข้า)</span>
                    <p className="text-lg font-black text-emerald-300 font-mono mt-0.5">{scanSummary.newCount} นาย</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
                    <span className="text-[11px] text-amber-400 font-bold">มีในระบบแล้ว (ข้ามอัตโนมัติ)</span>
                    <p className="text-lg font-black text-amber-300 font-mono mt-0.5">{scanSummary.duplicateCount} นาย</p>
                  </div>
                </div>
              )}

              {/* Table Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <ListFilter className="w-4 h-4 text-amber-400" />
                    รายการที่ตรวจพบ ({scannedOfficers.length} นาย):
                  </span>
                  
                  {/* Select/Deselect All buttons */}
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors cursor-pointer"
                  >
                    ยกเลิกเลือก
                  </button>
                </div>

                {/* Add Manual Row Button */}
                <button
                  type="button"
                  onClick={handleAddEmptyRow}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มแถวรายชื่อเอง (Add Name)</span>
                </button>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0d121c]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3 text-center w-12">เลือก</th>
                      <th className="py-2.5 px-3 text-center w-24">เลขประจำตัวที่แสดง</th>
                      <th className="py-2.5 px-3">ชื่อ-นามสกุล ที่อ่านได้</th>
                      <th className="py-2.5 px-3">ยศ (Rank)</th>
                      <th className="py-2.5 px-3 text-center">สถานะการตรวจสอบ</th>
                      <th className="py-2.5 px-2 text-center w-10">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {scannedOfficers.map((officer) => (
                      <tr 
                        key={officer.id} 
                        className={`transition-colors ${
                          officer.already_exists 
                            ? 'bg-amber-950/10 opacity-75' 
                            : officer.selected_for_import 
                            ? 'bg-emerald-950/10 hover:bg-emerald-950/20' 
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input 
                            type="checkbox"
                            checked={officer.selected_for_import}
                            disabled={officer.already_exists}
                            onChange={() => handleToggleOfficerSelection(officer.id)}
                            className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer disabled:opacity-30"
                          />
                        </td>

                        {/* Editable Badge Number */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-amber-400 font-mono font-bold text-xs">#</span>
                            <input 
                              type="text"
                              value={officer.already_exists ? (officer.existing_badge || officer.badge_number || '') : (officer.badge_number || '')}
                              disabled={officer.already_exists}
                              onChange={(e) => handleUpdateScannedOfficer(officer.id, { badge_number: e.target.value.replace(/[^0-9A-Za-z_-]/g, '') })}
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-xs w-14 text-center focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:bg-slate-900"
                              placeholder="01"
                            />
                          </div>
                        </td>

                        {/* Editable Name */}
                        <td className="py-2.5 px-3">
                          <input 
                            type="text"
                            value={officer.officer_name}
                            onChange={(e) => handleUpdateScannedOfficer(officer.id, { officer_name: e.target.value })}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-bold text-xs w-full max-w-[280px] focus:outline-none focus:border-amber-500"
                            placeholder="ระบุชื่อ-นามสกุล..."
                          />
                        </td>

                        {/* Editable Rank */}
                        <td className="py-2.5 px-3">
                          <select
                            value={officer.rank}
                            onChange={(e) => handleUpdateScannedOfficer(officer.id, { rank: e.target.value as OfficerRank })}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium"
                          >
                            <option value="ผู้บัญชาการตำรวจ">ผู้บัญชาการตำรวจ</option>
                            <option value="รองผู้บัญชาการตำรวจ">รองผู้บัญชาการตำรวจ</option>
                            <option value="ครูฝึก">ครูฝึก</option>
                            <option value="สารวัตร">สารวัตร</option>
                            <option value="หมวด">หมวด</option>
                            <option value="จ่า">จ่า</option>
                            <option value="นักเรียนตำรวจ">นักเรียนตำรวจ</option>
                          </select>
                        </td>

                        {/* Deduplication Status Badge */}
                        <td className="py-2.5 px-3 text-center">
                          {officer.already_exists ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                              <AlertCircle className="w-3 h-3" />
                              มีในระบบแล้ว (#{officer.existing_badge}) &bull; ข้าม
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              รายชื่อใหม่ (#{officer.badge_number})
                            </span>
                          )}
                        </td>

                        {/* Delete Row Button */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteOfficerRow(officer.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* STEP 3: Auto A-Z Numbering Config & Live Preview */}
              <div className="bento-card bento-card-gold p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs font-bold text-white cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={autoSortAZ}
                      onChange={(e) => setAutoSortAZ(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex items-center gap-1.5">
                      <SortAsc className="w-4 h-4 text-amber-400" />
                      เรียงลำดับรายชื่อทั้งหมด A-Z และรันหมายเลขประจำตัว (#01, #02, ...) ใหม่อัตโนมัติ
                    </span>
                  </label>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    A-Z AUTO NUMBERING
                  </span>
                </div>

                {/* Live Preview of Sorted Badge Numbers */}
                {autoSortAZ && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] text-slate-400">
                      ตัวอย่างการกำหนดหมายเลขประจำตัว (#Badge) หลังการนำเข้า (เรียง A-Z รวม {combinedRosterNames.length} นาย):
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono">
                      {combinedRosterNames.map((name, i) => {
                        const badgeNum = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                        const isNew = newOfficersToImport.some(n => n.officer_name.toLowerCase() === name.toLowerCase());
                        return (
                          <span 
                            key={i} 
                            className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              isNew 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' 
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            <span className="text-amber-400 font-bold">#{badgeNum}</span>
                            <span>{name}</span>
                            {isNew && <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1 rounded">NEW</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {scannedOfficers.length > 0 ? (
              <span>
                พร้อมเพิ่ม: <strong className="text-emerald-400">{newOfficersToImport.length}</strong> นาย &bull; ข้ามซ้ำ: <strong className="text-amber-400">{scannedOfficers.filter(s => s.already_exists).length}</strong> นาย
              </span>
            ) : (
              <span>โปรดอัปโหลดรูปภาพ / วางข้อความรายชื่อเพื่อดำเนินการต่อ</span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              disabled={newOfficersToImport.length === 0 || isApplying}
              onClick={handleApplyRoster}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2 rounded-xl font-black text-xs shadow-lg transition-all cursor-pointer ${
                newOfficersToImport.length === 0 || isApplying
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกและจัดเรียง A-Z...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>บันทึกเข้าระบบ ({newOfficersToImport.length} นาย)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
