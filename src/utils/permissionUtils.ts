import { Officer, CaseLog } from '../types';

/**
 * Centralized Permission & Duty Status Architecture for Around Town Police MDT
 * Ensures strict enforcement of ON_DUTY / OFF_DUTY rules across the entire application.
 */

/**
 * Checks whether an officer is actively ON_DUTY.
 */
export function isOnDuty(user: Officer | null | undefined): boolean {
  if (!user) return false;
  return user.status === 'On Duty' || user.status === 'In Action' || user.status === '10-8';
}

/**
 * Checks whether an officer is authorized to perform live operational actions
 * (such as creating cases, dispatching units, updating operational records).
 */
export function canPerformDutyAction(user: Officer | null | undefined): boolean {
  return isOnDuty(user);
}

/**
 * Checks whether an officer can create a new case.
 * Must be strictly ON_DUTY.
 */
export function canCreateCase(user: Officer | null | undefined): boolean {
  return isOnDuty(user);
}

/**
 * Checks whether an officer can modify/update a case (e.g. status transition).
 * Must be ON_DUTY, or an Admin/Leader with audit clearance.
 */
export function canModifyCase(user: Officer | null | undefined, caseItem?: CaseLog): boolean {
  if (!user) return false;
  // Admins / Leaders can review cases even if currently off-duty for administrative auditing
  if (user.role === 'Leader' || user.role === 'Admin') return true;
  return isOnDuty(user);
}

/**
 * Checks whether an officer is authorized to submit a Case Edit Request.
 * Must satisfy BOTH conditions:
 * 1. Must be the original creator of the case (case.created_by === currentUser.discord_id)
 * 2. Must be actively ON_DUTY at the time of request submission
 */
export function canRequestCaseEdit(
  user: Officer | null | undefined,
  caseItem: CaseLog | null | undefined
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' };
  }

  if (!caseItem) {
    return { allowed: false, reason: 'ไม่พบข้อมูลคดี' };
  }

  // 1. Must be the original creator
  const isCreator =
    (caseItem.created_by && caseItem.created_by === user.discord_id) ||
    (caseItem.officer_discord_id && caseItem.officer_discord_id === user.discord_id);

  if (!isCreator) {
    return {
      allowed: false,
      reason: 'เฉพาะเจ้าหน้าที่ผู้สร้าง/ลงคดีนี้เท่านั้นที่มีสิทธิ์ส่งคำร้องขอแก้ไข'
    };
  }

  // 2. Must be ON_DUTY
  if (!isOnDuty(user)) {
    return {
      allowed: false,
      reason: 'ต้องเข้าเวรปฏิบัติหน้าที่ (ON_DUTY) จึงจะสามารถส่งคำร้องขอแก้ไขคดีได้'
    };
  }

  return { allowed: true };
}

/**
 * Checks whether a target officer is eligible to be tagged as a helper, mentioned, or assigned.
 * Strictly requires the target officer to be ON_DUTY.
 */
export function canMentionOfficer(targetOfficer: Officer | null | undefined): boolean {
  if (!targetOfficer) return false;
  return isOnDuty(targetOfficer);
}

/**
 * Checks whether an officer is eligible for operational dispatch / assignment.
 */
export function canAssignOfficer(targetOfficer: Officer | null | undefined): boolean {
  return canMentionOfficer(targetOfficer);
}

/**
 * Filters a list of officers to ONLY return those who are ON_DUTY and eligible for tagging/dispatch.
 * Excludes the current user if excludeDiscordId is provided.
 */
export function getAvailableOnDutyOfficers(
  officers: Officer[],
  excludeDiscordId?: string,
  searchQuery: string = ''
): Officer[] {
  const query = searchQuery.toLowerCase().trim();

  return officers.filter((officer) => {
    // 1. Must be ON_DUTY
    if (!isOnDuty(officer)) return false;

    // 2. Exclude current user if requested
    if (excludeDiscordId && officer.discord_id === excludeDiscordId) return false;

    // 3. Search query matching
    if (query) {
      const matchName = officer.officer_name.toLowerCase().includes(query);
      const matchBadge = officer.badge_number.includes(query);
      const matchRank = officer.rank ? officer.rank.toLowerCase().includes(query) : false;
      const matchCallsign = officer.callsign ? officer.callsign.toLowerCase().includes(query) : false;
      return matchName || matchBadge || matchRank || matchCallsign;
    }

    return true;
  });
}

/**
 * Finds all active (unresolved / open / in-progress) cases where the officer is the creator or tagged helper.
 */
export function getActiveCasesForOfficer(cases: CaseLog[], officerDiscordId: string): CaseLog[] {
  if (!officerDiscordId) return [];
  return cases.filter((c) => {
    const isOwner = c.created_by === officerDiscordId || c.officer_discord_id === officerDiscordId;
    const isHelper = c.helpers?.some((h) => h.user_id === officerDiscordId || (h as any).discord_id === officerDiscordId);
    const isActive = c.status === 'OPEN' || c.status === 'IN_PROGRESS';
    return (isOwner || isHelper) && isActive;
  });
}
