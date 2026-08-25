import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  DollarSign, 
  AlertTriangle, 
  MessageSquare, 
  Users, 
  Crown, 
  ChevronRight, 
  ArrowLeft 
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { BadgeManagementView } from './components/BadgeManagementView';
import { PayrollCalculatorView } from './components/PayrollCalculatorView';
import { ValidationLayerView } from './components/ValidationLayerView';
import { DiscordSyncView } from './components/DiscordSyncView';
import { ActivitiesView } from './components/ActivitiesView';
import { AdminCenterView } from './components/AdminCenterView';
import { AllOfficersDirectoryView } from './components/AllOfficersDirectoryView';
import { AccessDeniedView } from './components/AccessDeniedView';
import { CaseDetailModal } from './components/CaseDetailModal';
import { CaseCreateView } from './components/CaseCreateView';
import { CaseHistoryView } from './components/CaseHistoryView';
import { NotificationsView } from './components/NotificationsView';
import { OfficerExistenceCheckerModal } from './components/OfficerExistenceCheckerModal';
import { DiscordLoginView } from './components/DiscordLoginView';
import { LoadingScreen } from './components/LoadingScreen';
import { 
  Officer, 
  CaseLog, 
  DutyLog, 
  BadgeSlot, 
  BadgeRequest, 
  AnomalyLog, 
  ActivityTraining, 
  PayrollPeriod, 
  PayrollRates, 
  AuditLog,
  AppNotification,
  CaseStatus,
  CaseEditRequest
} from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Officer | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Officer[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasLoadedInitialIntro, setHasLoadedInitialIntro] = useState(false);

  // App Data States
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [cases, setCases] = useState<CaseLog[]>([]);
  const [dutyLogs, setDutyLogs] = useState<DutyLog[]>([]);
  const [badgeSlots, setBadgeSlots] = useState<BadgeSlot[]>([]);
  const [badgeRequests, setBadgeRequests] = useState<BadgeRequest[]>([]);
  const [caseEditRequests, setCaseEditRequests] = useState<CaseEditRequest[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [activities, setActivities] = useState<ActivityTraining[]>([]);
  const [payrollRates, setPayrollRates] = useState<PayrollRates>({
    rate_normal: 1000,
    rate_take2: 2500,
    rate_red: 5000,
    rate_duty_hour: 350,
    base_salary: 2500
  });
  const [payrollCycles, setPayrollCycles] = useState<PayrollPeriod[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Modals
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseLog | null>(null);
  const [showGlobalCheckerModal, setShowGlobalCheckerModal] = useState(false);
  const [pendingClockOutData, setPendingClockOutData] = useState<{
    activeCasesCount: number;
    activeCases: any[];
    message: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Initial Data Fetching
  const fetchAllData = useCallback(async () => {
    try {
      // Current user
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();
      if (userData.user) {
        setCurrentUser(userData.user);
      }
      if (userData.available_users) {
        setAvailableUsers(userData.available_users || []);
      }

      // Officers
      const offRes = await fetch('/api/officers');
      const offData = await offRes.json();
      if (offData.officers) setOfficers(offData.officers);

      // Cases
      const caseRes = await fetch('/api/cases');
      const caseData = await caseRes.json();
      if (caseData.cases) setCases(caseData.cases);

      // Notifications
      const notifRes = await fetch('/api/notifications');
      const notifData = await notifRes.json();
      if (notifData.notifications) setNotifications(notifData.notifications);

      // Duty Logs
      const dutyRes = await fetch('/api/duty/logs');
      const dutyData = await dutyRes.json();
      if (dutyData.dutyLogs) setDutyLogs(dutyData.dutyLogs);

      // Badges
      const badgeRes = await fetch('/api/badges');
      const badgeData = await badgeRes.json();
      if (badgeData.slots) setBadgeSlots(badgeData.slots);
      if (badgeData.requests) setBadgeRequests(badgeData.requests);

      // Anomalies
      const anomalyRes = await fetch('/api/validation/anomalies');
      const anomalyData = await anomalyRes.json();
      if (anomalyData.anomalies) setAnomalies(anomalyData.anomalies);

      // Activities
      const actRes = await fetch('/api/activities');
      const actData = await actRes.json();
      if (actData.activities) setActivities(actData.activities);

      // Payroll
      const payRes = await fetch('/api/payroll/current');
      const payData = await payRes.json();
      if (payData.rates) setPayrollRates(payData.rates);

      const cyclesRes = await fetch('/api/payroll/cycles');
      const cyclesData = await cyclesRes.json();
      if (cyclesData.cycles) setPayrollCycles(cyclesData.cycles);

      // Audit Logs
      const auditRes = await fetch('/api/audit-logs');
      const auditData = await auditRes.json();
      if (auditData.auditLogs) setAuditLogs(auditData.auditLogs);

      // Case Edit Requests
      const editReqRes = await fetch('/api/case-edit-requests');
      const editReqData = await editReqRes.json();
      if (editReqData.requests) setCaseEditRequests(editReqData.requests);

    } catch (err) {
      console.error("Failed fetching MDT data:", err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

// ============================================================
// DUTY HEARTBEAT + AUTO CLOCK-OUT
// 1) ส่ง Heartbeat ทุก 60 วินาที
// 2) หากปิด/รีเฟรชหน้า ใช้ sendBeacon ปิดเวรทันที
// 3) หาก Browser/เน็ตล่ม Server จะปิดเวรจาก Heartbeat ครั้งสุดท้าย
// ============================================================
useEffect(() => {
  if (!currentUser) return;

  const sendHeartbeat = async () => {
    try {
      await fetch('/api/duty/heartbeat', {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      });
    } catch (err) {
      // ไม่แสดง Toast เพราะจะลองใหม่ในรอบถัดไป
      console.warn('Duty heartbeat failed', err);
    }
  };

  // ยืนยันสถานะทันทีเมื่อ Login/โหลดข้อมูลเสร็จ
  sendHeartbeat();
  const interval = window.setInterval(sendHeartbeat, 60 * 1000);

  const handlePageExit = () => {
    const activeDuty = dutyLogs.find(
      d =>
        d.officer_discord_id === currentUser.discord_id &&
        d.is_active
    );

    if (!activeDuty) return;

    const blob = new Blob([JSON.stringify({})], {
      type: 'application/json'
    });

    navigator.sendBeacon('/api/duty/auto-clock-out', blob);
  };

  window.addEventListener('pagehide', handlePageExit);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('pagehide', handlePageExit);
  };
}, [currentUser, dutyLogs]);
  const handleLoginSuccess = useCallback((officer: Officer) => {
    setCurrentUser(officer);
    fetchAllData();
  }, [fetchAllData]);

  // Case Edit Request Handlers
  const handleApproveEditRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/case-edit-requests/${requestId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'อนุมัติคำร้องขอแก้ไขคดีเรียบร้อยแล้ว', 'success');
        fetchAllData();
      } else {
        showToast(data.error || 'ไม่สามารถอนุมัติคำร้องได้', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'warning');
    }
  };

  const handleRejectEditRequest = async (requestId: string, reason: string) => {
    try {
      const res = await fetch(`/api/case-edit-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'ปฏิเสธคำร้องขอแก้ไขคดีเรียบร้อยแล้ว', 'info');
        fetchAllData();
      } else {
        showToast(data.error || 'ไม่สามารถปฏิเสธคำร้องได้', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'warning');
    }
  };

  // Case & Notification handlers
  const handleCaseCreated = (newCase: CaseLog) => {
    setCases(prev => [newCase, ...prev]);
    showToast(`✅ บันทึกคดีสำเร็จ! รหัสคดี: ${newCase.case_number}`, 'success');
    fetchAllData();
  };

  const handleUpdateCaseStatus = async (caseId: string, newStatus: CaseStatus, note?: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note })
      });
      const data = await res.json();
      if (data.case) {
        setCases(prev => prev.map(c => c.id === caseId ? data.case : c));
        if (selectedCaseDetail?.id === caseId) {
          setSelectedCaseDetail(data.case);
        }
        showToast(`อัปเดตสถานะคดี ${data.case.case_number} เป็น ${newStatus} เรียบร้อย`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showToast('ไม่สามารถอัปเดตสถานะคดีได้', 'warning');
    }
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      showToast('ทำเครื่องหมายว่าอ่านการแจ้งเตือนทั้งหมดแล้ว', 'info');
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCaseById = (caseId: string) => {
    const found = cases.find(c => c.id === caseId || c.case_number === caseId);
    if (found) {
      setSelectedCaseDetail(found);
    } else {
      showToast('ไม่พบคดีในระบบ', 'warning');
    }
  };

  // Switch User (Role change simulation)
  const handleSwitchUser = async (discordId: string) => {
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_id: discordId })
      });
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        showToast(`สลับบัญชีผู้ใช้เป็น: ${data.user.officer_name} (${data.user.rank} - ${data.user.role})`, 'info');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Duty (Clock-in / Clock-out)
  const handleToggleDuty = async (forceClockOut = false) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/duty/clock-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_discord_id: currentUser.discord_id,
          force_clock_out: forceClockOut
        })
      });
      const data = await res.json();

      // Check if backend warned about active cases (409 Conflict)
      if (res.status === 409 && data.require_confirmation) {
        setPendingClockOutData({
          activeCasesCount: data.activeCasesCount || 0,
          activeCases: data.activeCases || [],
          message: data.message || 'ตรวจพบคดีที่คุณเปิดไว้ยังไม่เสร็จสิ้น'
        });
        return;
      }

      if (data.success) {
        setPendingClockOutData(null);
        if (data.action === 'CLOCK_IN') {
          showToast(`🟢 เข้าเวรปฏิบัติหน้าที่ (10-8) เรียบร้อยแล้ว`, 'success');
        } else {
          const detailStr = data.timeDetailStr || (data.duty?.duration_minutes ? `${data.duty.duration_minutes} นาที` : 'เรียบร้อย');
          showToast(`🔴 ออกเวร (10-7) ปฏิบัติหน้าที่จริง: ${detailStr}`, 'info');
        }
        fetchAllData();
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะเวร', 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'warning');
    }
  };

  // Request Badge Swap
  const handleRequestBadge = async (requestedBadge: string, reason: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/badges/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officer_discord_id: currentUser.discord_id,
          requested_badge: requestedBadge,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`ยื่นคำขอเปลี่ยนหมายเลขเป็น #${requestedBadge} สำเร็จแล้ว`, 'success');
        fetchAllData();
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาดในการยื่นคำขอ', 'warning');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Approve Badge Request (Leader)
  const handleApproveBadge = async (requestId: string, reviewNotes?: string) => {
    try {
      const res = await fetch('/api/badges/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, review_notes: reviewNotes })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`[อนุมัติ] เปลี่ยนเลขประจำตัวของ ${data.officer.officer_name} เป็น #${data.officer.badge_number} เรียบร้อย`, 'success');
        fetchAllData();
      } else {
        showToast(data.error || 'ไม่มีสิทธิ์ในการอนุมัติ', 'warning');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reject Badge Request (Leader)
  const handleRejectBadge = async (requestId: string, reviewNotes?: string) => {
    try {
      const res = await fetch('/api/badges/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, review_notes: reviewNotes })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`[ปฏิเสธ] คำขอเปลี่ยนเลขประจำตัวเรียบร้อย`, 'info');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Expand / Add Badge Slots (Admin / Leader)
  const handleExpandBadgeSlots = async (additionalSlots?: number, totalSlots?: number) => {
    try {
      const res = await fetch('/api/badges/expand-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          additional_slots: additionalSlots,
          total_slots: totalSlots
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `อัปเดตจำนวนเลขวิทยุสำเร็จ`, 'success');
        fetchAllData();
        return data;
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาดในการเพิ่มเลขวิทยุ', 'warning');
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  // Run Anomaly Scan
  const handleRunScan = async () => {
    try {
      const res = await fetch('/api/validation/scan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`สแกนเสร็จสิ้น: ตรวจพบรายการผิดปกติใหม่ ${data.detected_count} รายการ`, data.detected_count > 0 ? 'warning' : 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve Anomaly
  const handleResolveAnomaly = async (anomalyId: string, action: 'Approve' | 'Dismiss', note?: string) => {
    try {
      const res = await fetch('/api/validation/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomaly_id: anomalyId, action, note })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`จัดการความผิดปกติ: ${data.anomaly.status} เรียบร้อย`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Discord Log Parser
  const handleParseDiscordLog = async (rawText: string) => {
    try {
      const res = await fetch('/api/discord/parse-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Discord Sync: ${data.message}`, 'success');
        fetchAllData();
      }
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Activity Vote
  const handleActivityVote = async (activityId: string, voteType: 'up' | 'down') => {
    try {
      const res = await fetch('/api/activities/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId, vote_type: voteType })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Activity Quiz
  const handleSubmitQuiz = async (activityId: string, answers: Record<number, number>) => {
    try {
      const res = await fetch('/api/activities/quiz-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId, answers })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`ส่งคำตอบ SOP สำเร็จ! ได้รับคะแนน ${data.score}/${data.max_score}`, 'success');
        fetchAllData();
      }
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Create Activity
  const handleCreateActivity = async (actData: Partial<ActivityTraining>) => {
    try {
      const res = await fetch('/api/activities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`สร้างกิจกรรมใหม่เรียบร้อยแล้ว`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Payroll Rates
  const handleUpdateRates = async (newRates: PayrollRates) => {
    try {
      const res = await fetch('/api/payroll/update-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRates)
      });
      const data = await res.json();
      if (data.success) {
        setPayrollRates(data.rates);
        showToast(`อัปเดตอัตราค่าคดีใหม่เรียบร้อยแล้ว`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Payroll Cycle
  const handleSaveCycle = async (cycleData: Partial<PayrollPeriod>) => {
    try {
      const res = await fetch('/api/payroll/save-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cycleData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`บันทึกประวัติรอบการจ่ายเงินเรียบร้อย`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Officer
  const handleAddOfficer = async (offData: Partial<Officer>) => {
    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`เพิ่มเจ้าหน้าที่ ${data.officer.officer_name} สำเร็จ`, 'success');
        fetchAllData();
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาด', 'warning');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Officer
  const handleUpdateOfficer = async (discordId: string, offData: Partial<Officer>) => {
    try {
      const res = await fetch(`/api/officers/${discordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`อัปเดตข้อมูลเจ้าหน้าที่เรียบร้อย`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Officer
  const handleDeleteOfficer = async (discordId: string) => {
    try {
      const res = await fetch(`/api/officers/${discordId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `ลบข้อมูลเจ้าหน้าที่เรียบร้อยแล้ว`, 'info');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showToast('ไม่สามารถลบข้อมูลเจ้าหน้าที่ได้', 'warning');
    }
  };

  // Delete Case
  const handleDeleteCase = async (caseId: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคดีนี้ (${caseId}) ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('ลบคดีออกจากระบบเรียบร้อยแล้ว', 'success');
        if (selectedCaseDetail && (selectedCaseDetail.id === caseId || selectedCaseDetail.case_number === caseId)) {
          setSelectedCaseDetail(null);
        }
        fetchAllData();
      } else {
        showToast(data.error || 'ไม่สามารถลบคดีได้', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'warning');
    }
  };

  // Re-sort Roster A-Z & Sequential Badge Renumbering
  const handleReorderAZ = async () => {
    try {
      const res = await fetch('/api/officers/reorder-az-badges', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `จัดเรียงรายชื่อ A-Z และรันเลขประจำตัวสำเร็จ`, 'success');
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      showToast('ไม่สามารถจัดเรียงรายชื่อได้', 'warning');
    }
  };

  // Logout & Disconnect Discord
  const handleLogout = async () => {
  try {
    // ออกเวรก่อน Logout
    if (currentUser) {
      const activeDuty = dutyLogs.find(
        d =>
          d.officer_discord_id === currentUser.discord_id &&
          d.is_active
      );

      if (activeDuty) {
        await fetch('/api/duty/auto-clock-out', {
          method: 'POST',
          credentials: 'include',
          keepalive: true
        });
      }
    }

    // จากนั้นค่อย Logout
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    setCurrentUser(null);

    showToast(
      'ออกเวรและออกจากระบบเรียบร้อยแล้ว',
      'info'
    );

  } catch (err) {
    console.error(err);
    setCurrentUser(null);
  }
};

  const unresolvedAnomaliesCount = anomalies.filter(a => a.status === 'Unresolved').length;
  const pendingBadgesCount = badgeRequests.filter(r => r.status === 'Pending').length;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050811] text-slate-200 bg-tactical-grid flex flex-col font-sans selection:bg-rose-500 selection:text-white relative">
        {/* Fullscreen Video Loading Intro Screen (Covers entire screen on first visit) */}
        {!hasLoadedInitialIntro && (
          <LoadingScreen
            isAppReady={isInitialized}
            onFinish={() => setHasLoadedInitialIntro(true)}
          />
        )}

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 animate-bounce">
            <div className={`px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center space-x-2 border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200 shadow-emerald-950/50'
                : toastMessage.type === 'warning'
                ? 'bg-rose-950/95 border-rose-500/60 text-rose-200 shadow-rose-950/50'
                : 'bg-indigo-950/95 border-indigo-500/60 text-indigo-200 shadow-indigo-950/50'
            }`}>
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <DiscordLoginView
          availableUsers={officers.length > 0 ? officers : (availableUsers as unknown as Officer[])}
          onLoginSuccess={handleLoginSuccess}
          onShowToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060911] text-slate-200 bg-tactical-grid flex flex-col font-sans selection:bg-rose-500 selection:text-white relative">
      {/* Fullscreen Video Loading Intro Screen */}
      {!hasLoadedInitialIntro && (
        <LoadingScreen
          isAppReady={isInitialized}
          onFinish={() => setHasLoadedInitialIntro(true)}
        />
      )}
      
      {/* Top Navbar HUD */}
      <Navbar
        currentUser={currentUser}
        availableUsers={availableUsers}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onToggleDuty={() => handleToggleDuty(false)}
        anomaliesCount={unresolvedAnomaliesCount}
        pendingBadgesCount={pendingBadgesCount}
        notificationsCount={notifications.filter(n => !n.read).length}
        onOpenCheckerModal={() => setShowGlobalCheckerModal(true)}
        dutyLogs={dutyLogs}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center space-x-2 border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200 shadow-emerald-950/50'
              : toastMessage.type === 'warning'
              ? 'bg-rose-950/95 border-rose-500/60 text-rose-200 shadow-rose-950/50'
              : 'bg-indigo-950/95 border-indigo-500/60 text-indigo-200 shadow-indigo-950/50'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
        
        {/* Permission Check for Admin-Only Tabs */}
        {['all-officers', 'payroll', 'validation', 'discord-sync', 'admin'].includes(activeTab) && !(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') ? (
          <AccessDeniedView
            currentUser={currentUser}
            onReturnDashboard={() => setActiveTab('dashboard')}
          />
        ) : (
          <>
            {/* Admin Command Quick Navigation Bar (Visible when in Admin sub-modules for Admin/Leader only) */}
            {['all-officers', 'payroll', 'validation', 'discord-sync', 'admin'].includes(activeTab) && (
              <div className="mb-6 p-2 rounded-2xl bg-[#090e1a] border border-rose-500/40 shadow-xl flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 px-2">
                  <div className="flex items-center space-x-1.5 text-xs font-black text-rose-400">
                    <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="uppercase tracking-wider">ADMIN COMMAND CENTER</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </div>

                {/* Quick Admin Tabs Switcher */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('all-officers')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'all-officers'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>ทำเนียบรายชื่อทั้งหมด</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      {officers.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('payroll')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'payroll'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>คำนวณเบี้ยเลี้ยง</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('validation')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'validation'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>ตรวจสอบความสอดคล้อง</span>
                    {unresolvedAnomaliesCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-rose-500 text-white">
                        {unresolvedAnomaliesCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>ศูนย์บริหารสถานี</span>
                  </button>

                  <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                    title="กลับสู่แดชบอร์ดหลัก"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>ออกโหมด Admin</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'all-officers' && (
              <AllOfficersDirectoryView
                currentUser={currentUser}
                officers={officers}
                cases={cases}
                dutyLogs={dutyLogs}
                anomalies={anomalies}
                onAddOfficer={handleAddOfficer}
                onUpdateOfficer={handleUpdateOfficer}
                onDeleteOfficer={handleDeleteOfficer}
                onRefreshData={fetchAllData}
                onReorderAZ={handleReorderAZ}
                onSelectCase={(c) => setSelectedCaseDetail(c)}
              />
            )}

            {activeTab === 'cases-create' && (
              <CaseCreateView
                currentUser={currentUser}
                officers={officers}
                onCaseCreated={handleCaseCreated}
                onNavigateToHistory={() => setActiveTab('cases')}
                onToggleDuty={() => handleToggleDuty(false)}
              />
            )}

            {activeTab === 'cases' && (
              <CaseHistoryView
                currentUser={currentUser}
                cases={cases}
                onSelectCase={(c) => setSelectedCaseDetail(c)}
                onNavigateToCreate={() => setActiveTab('cases-create')}
                onUpdateStatus={handleUpdateCaseStatus}
                onDeleteCase={handleDeleteCase}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsView
                currentUser={currentUser}
                notifications={notifications}
                onMarkAsRead={handleMarkNotificationAsRead}
                onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                onOpenCaseById={handleOpenCaseById}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                currentUser={currentUser}
                cases={cases}
                dutyLogs={dutyLogs}
                officers={officers}
                activities={activities}
                onNavigateToDiscordSync={() => setActiveTab('discord-sync')}
                onNavigateToCreateCase={() => setActiveTab('cases-create')}
                onNavigateToCases={() => setActiveTab('cases')}
                onToggleDuty={() => handleToggleDuty(false)}
                onSelectCase={(c) => setSelectedCaseDetail(c)}
              />
            )}

            {activeTab === 'badges' && (
              <BadgeManagementView
                currentUser={currentUser}
                badgeSlots={badgeSlots}
                badgeRequests={badgeRequests}
                allOfficers={officers}
                onRequestBadge={handleRequestBadge}
                onApproveBadge={handleApproveBadge}
                onRejectBadge={handleRejectBadge}
                onRefreshData={fetchAllData}
                onReorderAZ={handleReorderAZ}
                onExpandSlots={handleExpandBadgeSlots}
              />
            )}

            {activeTab === 'payroll' && (
              <PayrollCalculatorView
                officers={officers}
                payrollRates={payrollRates}
                payrollCycles={payrollCycles}
                cases={cases}
                dutyLogs={dutyLogs}
                onUpdateRates={handleUpdateRates}
                onSaveCycle={handleSaveCycle}
              />
            )}

            {activeTab === 'validation' && (
              <ValidationLayerView
                currentUser={currentUser}
                anomalies={anomalies}
                onRunScan={handleRunScan}
                onResolveAnomaly={handleResolveAnomaly}
              />
            )}

            {activeTab === 'discord-sync' && (
              <DiscordSyncView
                currentUser={currentUser}
                cases={cases}
                dutyLogs={dutyLogs}
                onParseDiscordLog={handleParseDiscordLog}
              />
            )}

            {activeTab === 'activities' && (
              <ActivitiesView
                currentUser={currentUser}
                activities={activities}
                onVote={handleActivityVote}
                onSubmitQuiz={handleSubmitQuiz}
                onCreateActivity={handleCreateActivity}
              />
            )}

            {activeTab === 'admin' && (
              <AdminCenterView
                currentUser={currentUser}
                officers={officers}
                auditLogs={auditLogs}
                cases={cases}
                dutyLogs={dutyLogs}
                caseEditRequests={caseEditRequests}
                onAddOfficer={handleAddOfficer}
                onUpdateOfficer={handleUpdateOfficer}
                onRefreshData={fetchAllData}
                onReorderAZ={handleReorderAZ}
                onDeleteCase={handleDeleteCase}
                onSelectCase={(c) => setSelectedCaseDetail(c)}
                onApproveEditRequest={handleApproveEditRequest}
                onRejectEditRequest={handleRejectEditRequest}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {selectedCaseDetail && (
        <CaseDetailModal
          caseItem={selectedCaseDetail}
          currentUser={currentUser}
          officers={officers}
          onClose={() => setSelectedCaseDetail(null)}
          onUpdateStatus={handleUpdateCaseStatus}
          onDeleteCase={handleDeleteCase}
          onRequestEditSuccess={(msg) => {
            showToast(msg || 'ส่งคำร้องขอแก้ไขคดีเรียบร้อยแล้ว', 'success');
            fetchAllData();
          }}
        />
      )}

      {/* Force Clock Out Confirmation Modal (When Active Cases Exist) */}
      {pendingClockOutData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b1220] border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">แจ้งเตือน: มีคดีค้างอยู่ในความรับผิดชอบ</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ระบบตรวจพบว่าคุณมีคดีที่ยังไม่เสร็จสิ้น (<span className="font-bold text-amber-300">OPEN / IN_PROGRESS</span>) จำนวน <span className="font-mono font-bold text-white px-1.5 py-0.5 rounded bg-amber-500/20">{pendingClockOutData.activeCasesCount} คดี</span>
                </p>
              </div>
            </div>

            {pendingClockOutData.activeCases && pendingClockOutData.activeCases.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                {pendingClockOutData.activeCases.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
                    <span className="font-mono text-amber-300 font-bold">{c.case_number || c.id}</span>
                    <span className="text-slate-300 truncate max-w-[180px]">{c.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">{c.status || 'OPEN'}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              คุณต้องการยืนยันการออกเวร (Force Clock Out) หรือกลับไปปิดคดีให้เรียบร้อยก่อน?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPendingClockOutData(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                ยกเลิก / ไปปิดคดีก่อน
              </button>
              <button
                type="button"
                onClick={() => handleToggleDuty(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all shadow-lg shadow-amber-950/50 cursor-pointer"
              >
                ยืนยันออกเวรทันที (Force Clock Out)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Officer Existence & Identity Checker Modal (Admin / Leader Only) */}
      {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
        <OfficerExistenceCheckerModal
          isOpen={showGlobalCheckerModal}
          onClose={() => setShowGlobalCheckerModal(false)}
          allOfficers={officers}
          onAddOfficerQuick={(name) => {
            setActiveTab('admin');
            handleAddOfficer({
              officer_name: name,
              rank: 'นักเรียนตำรวจ',
              department: 'Patrol Division',
              role: 'Member',
              badge_number: `${officers.length + 1}`.padStart(2, '0')
            });
          }}
          onRefreshData={fetchAllData}
        />
      )}

      {/* Tactical Footer */}
      <footer className="border-t border-slate-900 bg-[#070b14]/80 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <p>POLICE AROUND TOWN SYSTEM &bull; BY SEKROLEPLAY</p>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400">&bull; Live Server Online</span>
            <span>Discord OAuth2 Verified</span>
            <span>Encryption: AES-256</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
