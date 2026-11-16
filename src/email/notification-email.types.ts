export const NOTIFICATION_EMAIL_QUEUE = 'notification-email-queue' as const;

export type NotificationEmailPurpose =
  | 'NEW_VISIT_REQUEST'
  | 'NEW_APPLICATION'
  | 'APPLICATION_SELECTED'
  | 'VISIT_ACCEPTED'
  | 'VISIT_CANCELLED'
  | 'DIGEST_SUMMARY'; // New: Batched digest emails

export interface NotificationEmailJob {
  userId: string;
  purpose: NotificationEmailPurpose;
  data: {
    propertyTitle?: string;
    tenantName?: string;
    landlordName?: string;
    visitDate?: string;
    visitTime?: string;
    propertyId?: string;
    visitId?: string;
    applicationId?: string;
    // Digest fields
    count?: number;
    items?: Array<{
      type: string;
      propertyTitle: string;
      tenantName?: string;
      visitDate?: string;
      visitTime?: string;
      applicationId?: string;
      visitId?: string;
    }>;
  };
}
