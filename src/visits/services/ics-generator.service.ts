import { Injectable } from '@nestjs/common';
import { VisitPolicy } from '../domain/visit-policy.js';

export interface IcsEventOptions {
  uid: string;
  title: string;
  description: string;
  location: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  durationMinutes?: number;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
}

@Injectable()
export class IcsGeneratorService {
  /**
   * Formats a UTC Date to iCalendar RFC 5545 timestamp format: YYYYMMDDTHHmmssZ
   */
  private formatIcsUtc(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }

  /**
   * Generates a standard RFC 5545 .ics calendar string.
   */
  generateIcs(opts: IcsEventOptions): string {
    const startUtc = VisitPolicy.parseSlotDateTime(opts.scheduledDate, opts.scheduledTime);
    const durationMs = (opts.durationMinutes || 45) * 60 * 1000;
    const endUtc = new Date(startUtc.getTime() + durationMs);
    const dtStamp = this.formatIcsUtc(new Date());

    const cleanLocation = (opts.location || 'Dhaka, Bangladesh').replace(/\n/g, ', ');
    const cleanTitle = opts.title.replace(/\n/g, ' ');
    const cleanDescription = (opts.description || 'Property inspection visit via Basha Vara.')
      .replace(/\n/g, '\\n');

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Basha Vara//Property Visit Scheduling//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${opts.uid}@bashavara.com.bd`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${this.formatIcsUtc(startUtc)}`,
      `DTEND:${this.formatIcsUtc(endUtc)}`,
      `SUMMARY:${cleanTitle}`,
      `DESCRIPTION:${cleanDescription}`,
      `LOCATION:${cleanLocation}`,
      'STATUS:CONFIRMED',
    ];

    if (opts.organizerEmail) {
      lines.push(`ORGANIZER;CN=${opts.organizerName || 'Landlord'}:mailto:${opts.organizerEmail}`);
    }

    if (opts.attendeeEmail) {
      lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;CN=${opts.attendeeName || 'Tenant'}:mailto:${opts.attendeeEmail}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
  }
}
