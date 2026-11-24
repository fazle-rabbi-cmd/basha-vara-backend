/**
 * Basha Vara - Typed Workflow Configuration Module
 * Centralized, strongly-typed tunables for timeouts, limits, fees, and scheduling policies.
 */

export interface VisitWorkflowConfig {
  /** Auto-expire requests if landlord does not respond within this window */
  requestExpiryHours: number;
  /** Cutoff window before scheduled visit start when cancel/reschedule is blocked */
  cancelCutoffHours: number;
  /** Maximum active visit requests a tenant can hold concurrently per listing */
  maxActivePerTenantPerListing: number;
  /** Maximum new visit requests a tenant can submit in a single calendar day */
  maxNewRequestsPerTenantPerDay: number;
  /** Hours before visit start when reminders should be sent */
  reminderHours: number[];
  /** Default duration for an in-person or video visit */
  defaultSlotDurationMinutes: number;
  /** Maximum number of candidate slots a tenant can propose in a request */
  maxProposedSlots: number;
  /** Timezone used for scheduling and display */
  timezone: string;
}

export interface ApplicationWorkflowConfig {
  /** Hours an accepted applicant has to deposit escrow before cascading to waitlist */
  escrowPaymentDeadlineHours: number;
  /** Maximum concurrent active applications per tenant */
  maxActiveApplicationsPerTenant: number;
  /** Hours token hold locks property before auto-expiry */
  tokenHoldLockHours: number;
}

export interface EscrowWorkflowConfig {
  /** Variable platform fee percentage: 2.9% */
  platformFeeRateBasisPoints: number; // 290 basis points = 2.9%
  /** Fixed platform fee in Poisha: 30 BDT = 3000 Poisha */
  platformFeeFixedPoisha: number; // 3000 poisha = 30 BDT
  /** Hours after tenant move-in date before uncontested funds auto-release */
  autoReleaseAfterMoveInHours: number; // 72 hours
  /** Days landlord has to respond to deposit return before auto-refunding to tenant */
  depositReturnTimeoutDays: number; // 14 days
  /** Sandbox mode flag (default true for safety) */
  sandboxMode: boolean;
  /** Feature flag to enable/disable escrow module */
  enabled: boolean;
  /** Legal review required before holding real customer funds in Bangladesh */
  legalReviewRequired: boolean;
}

export interface VerificationWorkflowConfig {
  /** Minutes before scheduled visit start when OTP becomes active/valid (default: 30) */
  otpWindowBeforeStartMinutes: number;
  /** Hours after scheduled visit end when OTP window closes (default: 2) */
  otpWindowAfterEndHours: number;
  /** Maximum failed verification attempts before visit verification is locked (default: 5) */
  maxFailedAttempts: number;
  /** Length of generated OTP (default: 6 digits) */
  otpLength: number;
  /** Days after which verified visitor status expires for that listing (default: 14) */
  verifiedVisitorExpiryDays: number;
  /** GPS threshold in meters for soft verification warning (default: 500m) */
  gpsSoftThresholdMeters: number;
}

export interface JobsWorkflowConfig {
  /** Minutes between failed job monitoring checks */
  failureCheckIntervalMinutes: number;
  /** Hours of failed job history to include in each alert */
  failureLookbackHours: number;
}

export interface WorkflowConfig {
  visit: VisitWorkflowConfig;
  verification: VerificationWorkflowConfig;
  application: ApplicationWorkflowConfig;
  escrow: EscrowWorkflowConfig;
  jobs: JobsWorkflowConfig;
}

export const WORKFLOW_CONFIG: WorkflowConfig = {
  visit: {
    requestExpiryHours: 48,
    cancelCutoffHours: 2,
    maxActivePerTenantPerListing: 1,
    maxNewRequestsPerTenantPerDay: 5,
    reminderHours: [24, 2],
    defaultSlotDurationMinutes: 45,
    maxProposedSlots: 3,
    timezone: 'Asia/Dhaka',
  },
  verification: {
    otpWindowBeforeStartMinutes: 30,
    otpWindowAfterEndHours: 2,
    maxFailedAttempts: 5,
    otpLength: 6,
    verifiedVisitorExpiryDays: 14,
    gpsSoftThresholdMeters: 500,
  },
  application: {
    escrowPaymentDeadlineHours: 48,
    maxActiveApplicationsPerTenant: 5,
    tokenHoldLockHours: 48,
  },
  escrow: {
    platformFeeRateBasisPoints: 290, // 2.9%
    platformFeeFixedPoisha: 3000, // 30 BDT
    autoReleaseAfterMoveInHours: 72,
    depositReturnTimeoutDays: 14,
    sandboxMode: true,
    enabled: true,
    legalReviewRequired: true,
  },
  jobs: {
    failureCheckIntervalMinutes: 60,
    failureLookbackHours: 24,
  },
};
