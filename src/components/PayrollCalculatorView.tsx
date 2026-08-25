import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Save, 
  RotateCcw, 
  TrendingUp, 
  Users, 
  Shield, 
  CheckCircle, 
  Award, 
  Edit3, 
  Sliders,
  FileText,
  Clock,
  Sparkles,
  Search,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Officer, PayrollItem, PayrollRates, PayrollPeriod, CaseLog, DutyLog } from '../types';
import { getWeeklyRange, computeOfficerStats } from '../utils/dateUtils';
import { WeeklyFilterToggle } from './WeeklyFilterToggle';

const EMPTY_CASES: CaseLog[] = [];
const EMPTY_DUTY_LOGS: DutyLog[] = [];

interface PayrollCalculatorViewProps {
  officers: Officer[];
  payrollRates: PayrollRates;
  payrollCycles: PayrollPeriod[];
  cases?: CaseLog[];
  dutyLogs?: DutyLog[];
  onUpdateRates: (rates: PayrollRates) => void;
  onSaveCycle: (cycle: Partial<PayrollPeriod>) => void;
}

export const PayrollCalculatorView: React.FC<PayrollCalculatorViewProps> = ({
  officers,
  payrollRates,
  payrollCycles,
  cases = EMPTY_CASES,
  dutyLogs = EMPTY_DUTY_LOGS,
  onUpdateRates,
  onSaveCycle,
}) => {
  // Rates state
  const [rates, setRates] = useState<PayrollRates>(payrollRates);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Weekly vs All Time Filter State (Sunday 00:00 - Saturday 23:59)
  const [calculationMode, setCalculationMode] = useState<'week' | 'all'>('week');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const weeklyRange = useMemo(() => getWeeklyRange(new Date(), weekOffset), [weekOffset]);

  const [selectedCycleName, setSelectedCycleName] = useState('');

  // Update default cycle name when range or mode changes
  useEffect(() => {
    if (calculationMode === 'week') {
      setSelectedCycleName(`รอบสัปดาห์: ${weeklyRange.formattedRange}`);
    } else {
      setSelectedCycleName(`รอบคำนวณสะสมรวมทั้งหมด (All Time) ณ วันที่ ${new Date().toLocaleDateString('th-TH')}`);
    }
  }, [calculationMode, weeklyRange.formattedRange]);

  // Local table items state for inline editing (Excel-like)
  const [tableItems, setTableItems] = useState<PayrollItem[]>([]);
  const [selectedOfficerSlip, setSelectedOfficerSlip] = useState<PayrollItem | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync rates when payrollRates prop updates
  useEffect(() => {
    setRates(payrollRates);
  }, [payrollRates]);

  // Initialize table items based on current officers & rates & calculation mode
  useEffect(() => {
    const initialItems: PayrollItem[] = officers.map(o => {
      const stats = computeOfficerStats(o, cases, dutyLogs, calculationMode, weeklyRange);
      const normal = stats.cases_normal;
      const take2 = stats.cases_take2;
      const red = stats.cases_red;
      const total_cases = stats.total_cases;
      const duty_hours = stats.duty_hours;

      const reward_normal = normal * rates.rate_normal;
      const reward_take2 = take2 * rates.rate_take2;
      const reward_red = red * rates.rate_red;
      const reward_duty = Math.round(duty_hours * rates.rate_duty_hour);
      const base_salary = rates.base_salary;
      const bonus = (o.rank === 'ผู้บัญชาการตำรวจ' || o.rank === 'รองผู้บัญชาการตำรวจ') ? 5000 : (o.rank === 'ครูฝึก' || o.rank === 'สารวัตร') ? 2500 : 0;
      const deductions = 0;
      const total_payout = base_salary + reward_normal + reward_take2 + reward_red + reward_duty + bonus - deductions;

      return {
        officer_discord_id: o.discord_id,
        officer_name: o.officer_name,
        badge_number: o.badge_number,
        rank: o.rank,
        department: o.department,
        cases_normal: normal,
        cases_take2: take2,
        cases_red: red,
        total_cases,
        duty_hours,
        rate_normal: rates.rate_normal,
        rate_take2: rates.rate_take2,
        rate_red: rates.rate_red,
        rate_duty_hour: rates.rate_duty_hour,
        base_salary,
        reward_normal,
        reward_take2,
        reward_red,
        reward_duty,
        bonus,
        deductions,
        total_payout,
        status: 'Draft'
      };
    });

    setTableItems(initialItems);
  }, [officers, cases, dutyLogs, rates, calculationMode, weeklyRange.startISO, weeklyRange.endISO]);

  // Recalculate single row when values are modified inline
  const handleItemChange = (index: number, field: keyof PayrollItem, value: any) => {
    const updated = [...tableItems];
    const item = { ...updated[index], [field]: value };

    // Numerical recalculations
    const numNormal = Number(item.cases_normal) || 0;
    const numTake2 = Number(item.cases_take2) || 0;
    const numRed = Number(item.cases_red) || 0;
    const numDuty = Number(item.duty_hours) || 0;
    const numBonus = Number(item.bonus) || 0;
    const numDeduct = Number(item.deductions) || 0;

    item.total_cases = numNormal + numTake2 + numRed;
    item.reward_normal = numNormal * rates.rate_normal;
    item.reward_take2 = numTake2 * rates.rate_take2;
    item.reward_red = numRed * rates.rate_red;
    item.reward_duty = Math.round(numDuty * rates.rate_duty_hour);
    item.total_payout = item.base_salary + item.reward_normal + item.reward_take2 + item.reward_red + item.reward_duty + numBonus - numDeduct;

    updated[index] = item;
    setTableItems(updated);
  };

  // Reset to automated Discord case counts based on current mode
  const handleResetToAuto = () => {
    const autoItems: PayrollItem[] = officers.map(o => {
      const stats = computeOfficerStats(o, cases, dutyLogs, calculationMode, weeklyRange);
      const normal = stats.cases_normal;
      const take2 = stats.cases_take2;
      const red = stats.cases_red;
      const total_cases = stats.total_cases;
      const duty_hours = stats.duty_hours;

      return {
        officer_discord_id: o.discord_id,
        officer_name: o.officer_name,
        badge_number: o.badge_number,
        rank: o.rank,
        department: o.department,
        cases_normal: normal,
        cases_take2: take2,
        cases_red: red,
        total_cases,
        duty_hours,
        rate_normal: rates.rate_normal,
        rate_take2: rates.rate_take2,
        rate_red: rates.rate_red,
        rate_duty_hour: rates.rate_duty_hour,
        base_salary: rates.base_salary,
        reward_normal: normal * rates.rate_normal,
        reward_take2: take2 * rates.rate_take2,
        reward_red: red * rates.rate_red,
        reward_duty: Math.round(duty_hours * rates.rate_duty_hour),
        bonus: (o.rank.includes('Chief') || o.rank.includes('Commander')) ? 5000 : (o.rank.includes('Lieutenant') || o.rank.includes('Sergeant')) ? 2500 : 0,
        deductions: 0,
        total_payout: rates.base_salary + (normal * rates.rate_normal) + (take2 * rates.rate_take2) + (red * rates.rate_red) + Math.round(duty_hours * rates.rate_duty_hour) + ((o.rank.includes('Chief') || o.rank.includes('Commander')) ? 5000 : 2500),
        status: 'Draft'
      };
    });
    setTableItems(autoItems);
  };

  // Save rates
  const handleApplyRates = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateRates(rates);
    setRatesOpen(false);
  };

  // Dynamic Grand Totals
  const grandTotals = useMemo(() => {
    const totalAmount = tableItems.reduce((sum, item) => sum + item.total_payout, 0);
    const totalCases = tableItems.reduce((sum, item) => sum + item.total_cases, 0);
    const totalNormal = tableItems.reduce((sum, item) => sum + item.cases_normal, 0);
    const totalTake2 = tableItems.reduce((sum, item) => sum + item.cases_take2, 0);
    const totalRed = tableItems.reduce((sum, item) => sum + item.cases_red, 0);
    const totalDutyHours = tableItems.reduce((sum, item) => sum + item.duty_hours, 0);
    const topEarner = [...tableItems].sort((a, b) => b.total_payout - a.total_payout)[0];
    const avgPayout = tableItems.length > 0 ? Math.round(totalAmount / tableItems.length) : 0;

    return {
      totalAmount,
      totalCases,
      totalNormal,
      totalTake2,
      totalRed,
      totalDutyHours,
      topEarner,
      avgPayout
    };
  }, [tableItems]);

  // Export to Real Excel .xlsx
  const handleExportExcel = () => {
    const exportData = tableItems.map(item => ({
      "รหัส": `#${item.badge_number}`,
      "ชื่อเจ้าหน้าที่": item.officer_name,
      "ยศ": item.rank,
      "แผนก": item.department,
      "เคสปกติ (เคส)": item.cases_normal,
      "ค่าคดีปกติ (฿)": item.reward_normal,
      "เคส TAKE2 (เคส)": item.cases_take2,
      "ค่าคดี TAKE2 (฿)": item.reward_take2,
      "คดีแดง (เคส)": item.cases_red,
      "ค่าคดีแดง (฿)": item.reward_red,
      "ชั่วโมงเวร (ชม.)": item.duty_hours,
      "เบี้ยเลี้ยงเวร (฿)": item.reward_duty,
      "เงินเดือนพื้นฐาน (฿)": item.base_salary,
      "โบนัสพิเศษ (฿)": item.bonus,
      "หักภาษี/ค่าปรับ (฿)": item.deductions,
      "ยอดสุทธิ (฿)": item.total_payout
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll_ATPD");
    
    // Auto-fit column widths
    const max_width = exportData.reduce((w, r) => Math.max(w, 15), 10);
    worksheet['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];

    XLSX.writeFile(workbook, `ATPD_Payroll_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Badge,Officer,Rank,Department,Normal_Cases,Normal_Reward,Take2_Cases,Take2_Reward,Red_Cases,Red_Reward,Duty_Hours,Duty_Reward,Base_Salary,Bonus,Deductions,Total_Payout"
    ];
    const rows = tableItems.map(item => 
      `"${item.badge_number}","${item.officer_name}","${item.rank}","${item.department}",${item.cases_normal},${item.reward_normal},${item.cases_take2},${item.reward_take2},${item.cases_red},${item.reward_red},${item.duty_hours},${item.reward_duty},${item.base_salary},${item.bonus},${item.deductions},${item.total_payout}`
    );

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ATPD_Payroll_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save cycle
  const handleSaveCurrentCycle = () => {
    onSaveCycle({
      period_name: selectedCycleName,
      cycle_start: new Date().toISOString().split('T')[0],
      cycle_end: new Date().toISOString().split('T')[0],
      items: tableItems,
      grand_total_amount: grandTotals.totalAmount,
      grand_total_cases: grandTotals.totalCases,
      grand_total_duty_hours: grandTotals.totalDutyHours
    });

    setSaveSuccessMsg(`บันทึกรอบการจ่าย "${selectedCycleName}" สำเร็จเรียบร้อย!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const filteredItems = tableItems.filter(item => 
    item.officer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.badge_number.includes(searchQuery) ||
    item.rank.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Admin Clearance Alert Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gradient-to-r from-rose-950/60 via-amber-950/40 to-slate-900 border border-rose-500/40 text-xs shadow-sm">
        <div className="flex items-center space-x-2 text-rose-300 font-bold">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="uppercase tracking-wider">ADMIN COMMAND &bull; ศูนย์การเงินและเบี้ยเลี้ยงสถานี</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-rose-600/80 text-white font-mono text-[10px] font-bold">
          HIGH CLEARANCE
        </span>
      </div>

      {/* Header Banner */}
      <div className="bento-card bento-card-crimson p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            <span>PAYROLL & CASE REWARD CALCULATOR</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            ระบบคำนวณเบี้ยเลี้ยง & ค่าคดีสไตล์ Excel (Spreadsheet Engine)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            คำนวณค่าคดีอัตโนมัติ (ปกติ/TAKE2/คดีแดง), ปรับเปลี่ยนตัวคูณได้อิสระ, แก้ไขข้อมูลในตารางแบบเรียลไทม์, และส่งออกไฟล์ .xlsx / CSV
          </p>
        </div>

        {/* Action Buttons: Rates, Export, Save */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRatesOpen(!ratesOpen)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>ตั้งค่าตัวคูณ (Rates)</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleSaveCurrentCycle}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-xs font-black text-slate-950 shadow-lg shadow-amber-950/50 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกรอบจ่าย</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> {saveSuccessMsg}
          </span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Weekly vs All-Time Cycle Selector Filter Bar */}
      <div className="bento-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg border border-amber-500/30">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              ช่วงเวลาการคำนวณเบี้ยเลี้ยง (Calculation Period)
            </h4>
            <p className="text-[11px] text-slate-400">
              รายสัปดาห์เริ่มนับวันอาทิตย์ 00:00:00 ถึง วันเสาร์ 23:59:59 อัตโนมัติตามกฎสถานี
            </p>
          </div>
        </div>

        <WeeklyFilterToggle
          mode={calculationMode}
          onChangeMode={(newMode) => setCalculationMode(newMode)}
          weeklyRange={weeklyRange}
          weekOffset={weekOffset}
          onChangeWeekOffset={(newOffset) => setWeekOffset(newOffset)}
        />
      </div>

      {/* Rates Multipliers Settings Accordion */}
      {ratesOpen && (
        <div className="bento-card bento-card-gold p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> กำหนดอัตราเงินค่าคดี & ชั่วโมงเข้าเวร (Multiplier Rates)
            </h3>
            <span className="text-[11px] text-slate-400">มีผลคำนวณทันทีต่อตารางทั้งหมด</span>
          </div>

          <form onSubmit={handleApplyRates} className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">ค่าเคสปกติ (x บาท)</label>
              <input
                type="number"
                value={rates.rate_normal}
                onChange={(e) => setRates({ ...rates, rate_normal: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">ค่าเคส TAKE2 (x บาท)</label>
              <input
                type="number"
                value={rates.rate_take2}
                onChange={(e) => setRates({ ...rates, rate_take2: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">ค่าคดีแดง (x บาท)</label>
              <input
                type="number"
                value={rates.rate_red}
                onChange={(e) => setRates({ ...rates, rate_red: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-rose-400 font-mono font-bold focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">ค่าชั่วโมงเวร (/ชม.)</label>
              <input
                type="number"
                value={rates.rate_duty_hour}
                onChange={(e) => setRates({ ...rates, rate_duty_hour: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">เงินเดือนประจำตำแหน่ง</label>
              <input
                type="number"
                value={rates.base_salary}
                onChange={(e) => setRates({ ...rates, base_salary: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-300 font-mono font-bold focus:border-amber-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-5 flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRatesOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md cursor-pointer"
              >
                นำอัตราใหม่ไปใช้
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dynamic Grand Total Summary Bento Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grand Total Budget */}
        <div className="bento-card bento-card-gold p-4 shadow-xl space-y-1">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" /> ยอดรวมค่าตอบแทนทั้งสถานี
          </span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300">
            ฿{grandTotals.totalAmount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400">เฉลี่ยต่อเจ้าหน้าที่: <span className="font-mono text-slate-200">฿{grandTotals.avgPayout.toLocaleString()}</span></p>
        </div>

        {/* Total Cases Summary */}
        <div className="bento-card bento-card-blue p-4 shadow-md space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-400" /> คดีสะสมรวมทั้งสถานี
          </span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-white">
            {grandTotals.totalCases} <span className="text-xs text-slate-400 font-normal">เคส</span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <span className="text-blue-400">ปกติ: {grandTotals.totalNormal}</span> &bull;
            <span className="text-amber-400">Take2: {grandTotals.totalTake2}</span> &bull;
            <span className="text-rose-400">แดง: {grandTotals.totalRed}</span>
          </div>
        </div>

        {/* Total Duty Hours */}
        <div className="bento-card bento-card-emerald p-4 shadow-md space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-400" /> ชั่วโมงเวรรวมทั้งสถานี
          </span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
            {grandTotals.totalDutyHours.toFixed(1)} <span className="text-xs text-slate-400 font-normal">ชม.</span>
          </div>
          <p className="text-[11px] text-slate-500">เจ้าหน้าที่ทั้งหมด {tableItems.length} นาย</p>
        </div>

        {/* Top Earner */}
        <div className="bento-card bento-card-crimson p-4 shadow-md space-y-1">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4" /> ผู้ทำผลงานสูงสุดรอบนี้
          </span>
          <div className="text-lg font-bold text-white truncate">
            {grandTotals.topEarner ? `${grandTotals.topEarner.officer_name} (#${grandTotals.topEarner.badge_number})` : '-'}
          </div>
          <p className="text-xs font-mono font-bold text-amber-300">
            ฿{grandTotals.topEarner ? grandTotals.topEarner.total_payout.toLocaleString() : 0} ({grandTotals.topEarner?.total_cases || 0} เคส)
          </p>
        </div>
      </div>

      {/* Spreadsheet Control Bar */}
      <div className="bento-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหาเจ้าหน้าที่ในตาราง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <button
            onClick={handleResetToAuto}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors whitespace-nowrap border border-slate-700/60 cursor-pointer"
            title="ดึงจำนวนเคสจริงจากระบบ Discord อีกครั้ง"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>รีเซ็ตดึงเคส Auto</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>รอบการคำนวณ:</span>
          <input
            type="text"
            value={selectedCycleName}
            onChange={(e) => setSelectedCycleName(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs"
          />
        </div>
      </div>

      {/* Interactive Excel-Style Spreadsheet Table */}
      <div className="bento-card overflow-hidden p-0 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-[#101726] border-b border-slate-700/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-3 text-center w-14">Badge</th>
              <th className="py-3.5 px-4 min-w-[160px]">ชื่อเจ้าหน้าที่ & ยศ</th>
              <th className="py-3.5 px-3 text-center bg-blue-950/20 text-blue-300 border-x border-slate-800">
                เคสปกติ (x{rates.rate_normal.toLocaleString()})
              </th>
              <th className="py-3.5 px-3 text-center bg-amber-950/20 text-amber-300 border-r border-slate-800">
                TAKE2 (x{rates.rate_take2.toLocaleString()})
              </th>
              <th className="py-3.5 px-3 text-center bg-rose-950/20 text-rose-300 border-r border-slate-800">
                คดีแดง (x{rates.rate_red.toLocaleString()})
              </th>
              <th className="py-3.5 px-3 text-center bg-emerald-950/20 text-emerald-300 border-r border-slate-800">
                ชั่วโมงเวร (x{rates.rate_duty_hour})
              </th>
              <th className="py-3.5 px-3 text-right">เงินเดือน</th>
              <th className="py-3.5 px-3 text-right">โบนัส (+)</th>
              <th className="py-3.5 px-3 text-right">หัก (-)</th>
              <th className="py-3.5 px-4 text-right bg-amber-500/10 text-amber-300 font-black border-l border-slate-800">
                ยอดสุทธิ (Total)
              </th>
              <th className="py-3.5 px-3 text-center w-24">สลิป</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredItems.map((item, index) => (
              <tr key={item.officer_discord_id} className="hover:bg-slate-800/40 transition-colors group">
                
                {/* Badge Number */}
                <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                  #{item.badge_number}
                </td>

                {/* Officer Name & Rank */}
                <td className="py-2.5 px-4">
                  <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.officer_name}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.rank} &bull; {item.department}</div>
                </td>

                {/* Normal Cases (Editable Inline) */}
                <td className="py-2.5 px-3 text-center bg-blue-950/10 border-x border-slate-800/60">
                  <input
                    type="number"
                    min="0"
                    value={item.cases_normal}
                    onChange={(e) => handleItemChange(index, 'cases_normal', e.target.value)}
                    className="w-16 text-center py-1 bg-slate-900 border border-slate-700/80 rounded font-mono font-bold text-blue-300 focus:border-blue-400 focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    ฿{item.reward_normal.toLocaleString()}
                  </div>
                </td>

                {/* TAKE2 Cases (Editable Inline) */}
                <td className="py-2.5 px-3 text-center bg-amber-950/10 border-r border-slate-800/60">
                  <input
                    type="number"
                    min="0"
                    value={item.cases_take2}
                    onChange={(e) => handleItemChange(index, 'cases_take2', e.target.value)}
                    className="w-16 text-center py-1 bg-slate-900 border border-slate-700/80 rounded font-mono font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    ฿{item.reward_take2.toLocaleString()}
                  </div>
                </td>

                {/* Red Cases (Editable Inline) */}
                <td className="py-2.5 px-3 text-center bg-rose-950/10 border-r border-slate-800/60">
                  <input
                    type="number"
                    min="0"
                    value={item.cases_red}
                    onChange={(e) => handleItemChange(index, 'cases_red', e.target.value)}
                    className="w-16 text-center py-1 bg-slate-900 border border-rose-900/60 rounded font-mono font-bold text-rose-400 focus:border-rose-400 focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    ฿{item.reward_red.toLocaleString()}
                  </div>
                </td>

                {/* Duty Hours (Editable Inline) */}
                <td className="py-2.5 px-3 text-center bg-emerald-950/10 border-r border-slate-800/60">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={item.duty_hours}
                    onChange={(e) => handleItemChange(index, 'duty_hours', e.target.value)}
                    className="w-16 text-center py-1 bg-slate-900 border border-slate-700/80 rounded font-mono font-bold text-emerald-300 focus:border-emerald-400 focus:outline-none"
                  />
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    ฿{item.reward_duty.toLocaleString()}
                  </div>
                </td>

                {/* Base Salary */}
                <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                  ฿{item.base_salary.toLocaleString()}
                </td>

                {/* Bonus */}
                <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                  <input
                    type="number"
                    value={item.bonus}
                    onChange={(e) => handleItemChange(index, 'bonus', e.target.value)}
                    className="w-16 text-right py-0.5 px-1 bg-slate-900 border border-slate-800 rounded font-mono text-emerald-400 text-xs focus:outline-none"
                  />
                </td>

                {/* Deductions */}
                <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                  <input
                    type="number"
                    value={item.deductions}
                    onChange={(e) => handleItemChange(index, 'deductions', e.target.value)}
                    className="w-16 text-right py-0.5 px-1 bg-slate-900 border border-slate-800 rounded font-mono text-rose-400 text-xs focus:outline-none"
                  />
                </td>

                {/* Grand Total Payout per Officer */}
                <td className="py-2.5 px-4 text-right font-mono font-black text-amber-300 text-sm bg-amber-500/5 border-l border-slate-800">
                  ฿{item.total_payout.toLocaleString()}
                </td>

                {/* Slip print preview action */}
                <td className="py-2.5 px-3 text-center">
                  <button
                    onClick={() => setSelectedOfficerSlip(item)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors"
                    title="ดูสลิปเงินเดือน"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </td>

              </tr>
            ))}
          </tbody>

          {/* Grand Total Footer Row */}
          <tfoot>
            <tr className="bg-[#11192b] border-t-2 border-amber-500/60 font-mono font-black text-white text-xs">
              <td colSpan={2} className="py-3 px-4 text-amber-400 uppercase tracking-wider">
                รวมทั้งหมดทั้งสถานี (GRAND TOTAL)
              </td>
              <td className="py-3 px-3 text-center text-blue-300">
                {grandTotals.totalNormal} เคส
              </td>
              <td className="py-3 px-3 text-center text-amber-300">
                {grandTotals.totalTake2} เคส
              </td>
              <td className="py-3 px-3 text-center text-rose-400">
                {grandTotals.totalRed} เคส
              </td>
              <td className="py-3 px-3 text-center text-emerald-400">
                {grandTotals.totalDutyHours.toFixed(1)} ชม.
              </td>
              <td colSpan={3} className="py-3 px-3 text-right text-slate-400 font-normal">
                {tableItems.length} เจ้าหน้าที่
              </td>
              <td className="py-3 px-4 text-right text-base text-amber-300 bg-amber-500/20 border-l border-slate-700">
                ฿{grandTotals.totalAmount.toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Police Payout Slip Modal (พิมพ์สลิปเงินเดือน) */}
      {selectedOfficerSlip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">AROUND TOWN POLICE DEPARTMENT</h3>
                  <p className="text-[10px] text-slate-400">ใบสำคัญการจ่ายเงินค่าตอบแทน & เบี้ยเลี้ยงประจำรอบ</p>
                </div>
              </div>
              <button onClick={() => setSelectedOfficerSlip(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Slip Paper Format */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <p className="text-slate-400">ชื่อเจ้าหน้าที่:</p>
                  <p className="text-sm font-bold text-white">{selectedOfficerSlip.officer_name}</p>
                  <p className="text-[11px] text-amber-400">{selectedOfficerSlip.rank} &bull; {selectedOfficerSlip.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">หมายเลขประจำตัว:</p>
                  <p className="text-base font-mono font-black text-amber-400">#{selectedOfficerSlip.badge_number}</p>
                  <p className="text-[10px] text-slate-500">{selectedCycleName}</p>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 text-slate-300 font-mono">
                <div className="flex justify-between">
                  <span>เงินเดือนประจำตำแหน่ง:</span>
                  <span>฿{selectedOfficerSlip.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>เคสปกติ ({selectedOfficerSlip.cases_normal} เคส x ฿{rates.rate_normal}):</span>
                  <span className="text-blue-400">฿{selectedOfficerSlip.reward_normal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>เคส TAKE2 ({selectedOfficerSlip.cases_take2} เคส x ฿{rates.rate_take2}):</span>
                  <span className="text-amber-400">฿{selectedOfficerSlip.reward_take2.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>คดีแดง ({selectedOfficerSlip.cases_red} เคส x ฿{rates.rate_red}):</span>
                  <span className="text-rose-400">฿{selectedOfficerSlip.reward_red.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>เบี้ยเลี้ยงเข้าเวร ({selectedOfficerSlip.duty_hours} ชม. x ฿{rates.rate_duty_hour}):</span>
                  <span className="text-emerald-400">฿{selectedOfficerSlip.reward_duty.toLocaleString()}</span>
                </div>
                {selectedOfficerSlip.bonus > 0 && (
                  <div className="flex justify-between text-emerald-300">
                    <span>โบนัสตำแหน่งพิเศษ:</span>
                    <span>+฿{selectedOfficerSlip.bonus.toLocaleString()}</span>
                  </div>
                )}
                {selectedOfficerSlip.deductions > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>หักภาษี/ค่าปรับ:</span>
                    <span>-฿{selectedOfficerSlip.deductions.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-bold text-white text-sm">ยอดเงินสุทธิที่ได้รับ:</span>
                <span className="font-mono font-black text-xl text-amber-300">
                  ฿{selectedOfficerSlip.total_payout.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบสลิป</span>
              </button>
              <button
                onClick={() => setSelectedOfficerSlip(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
