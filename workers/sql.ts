import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { clamp } from 'foxts/clamp';
import { emailsTable } from './schema';
import type { EmailRow } from './schema';
import type { Attachment, Email } from './types';

const NORMALIZED_SUBJECT_SQL = sql`
  LOWER(TRIM(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      LOWER(subject),
      'aw: ', ''), 'wg: ', ''), 'réf: ', ''), 'sv: ', ''),
      're: ', ''), 'fwd: ', ''), 'fw: ', '')
  ))
`;

const DRAFT_FOLDER_SQL = sql`(SELECT id FROM folders WHERE name = 'draft' LIMIT 1)`;
const SENT_FOLDER_SQL = sql`(SELECT id FROM folders WHERE name = 'sent' LIMIT 1)`;

export type SortColumn = 'id' | 'subject' | 'sender' | 'recipient' | 'date' | 'read' | 'starred';
export const SORT_COLUMNS: Partial<Record<SortColumn, SQLiteColumn>> = {
  id: emailsTable.id,
  subject: emailsTable.subject,
  sender: emailsTable.sender,
  recipient: emailsTable.recipient,
  date: emailsTable.date,
  read: emailsTable.read,
  starred: emailsTable.starred
};

const EMAIL_FIELDS = {
  id: emailsTable.id,
  subject: emailsTable.subject,
  body: emailsTable.body,
  sender: emailsTable.sender,
  recipient: emailsTable.recipient,
  cc: emailsTable.cc,
  bcc: emailsTable.bcc,
  folder_id: emailsTable.folderId,
  date: emailsTable.date,
  read: emailsTable.read,
  starred: emailsTable.starred
} as const;

type EmailField = keyof typeof EMAIL_FIELDS;

export function folderRef(folder: string): SQL {
  return sql`(SELECT id FROM folders WHERE name = ${folder} OR id = ${folder} LIMIT 1)`;
}

function emailCol(alias: string, field: EmailField): SQL {
  return alias ? sql.raw(`${alias}.${field}`) : EMAIL_FIELDS[field].getSQL();
}

export const REPLY_PREFIX_REGEX = /^(?:(?:re|fwd?|aw|wg|r[eé]f|sv)\s*:\s*)+/i;

export interface SearchFilterOptions {
  query: string,
  folder?: string,
  from?: string,
  to?: string,
  subject?: string,
  dateStart?: string,
  dateEnd?: string,
  isRead?: boolean,
  isStarred?: boolean,
  hasAttachment?: boolean
}

export interface ListEmailsOptions {
  folder?: string,
  threadId?: string,
  page?: number,
  limit?: number,
  sortColumn?: SortColumn,
  sortDirection?: 'ASC' | 'DESC'
}

const SQLITE_LIKE_PATTERN_LIMIT = 50;
const LIKE_WILDCARD_PADDING = 2;
const MAX_LIKE_TERM_LENGTH = SQLITE_LIKE_PATTERN_LIMIT - LIKE_WILDCARD_PADDING;
const MAX_LIKE_CHUNKS = 4;
const LIKE_SPECIAL_CHARS_REGEX = /[\\%_]/g;

function escapeLikeTerm(term: string): string {
  return term.replaceAll(LIKE_SPECIAL_CHARS_REGEX, (char) => `\\${char}`);
}

function splitLikeTerm(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const chunks: string[] = [];
  const count = Math.min(MAX_LIKE_CHUNKS, Math.ceil(trimmed.length / MAX_LIKE_TERM_LENGTH));
  for (let i = 0; i < count; i++) {
    chunks.push(trimmed.slice(i * MAX_LIKE_TERM_LENGTH, (i + 1) * MAX_LIKE_TERM_LENGTH));
  }
  return chunks;
}

export function searchConditions(options: SearchFilterOptions, alias = ''): { conditions: SQL[] } {
  const conditions: SQL[] = [];
  const { query, folder, from, to, subject, dateStart, dateEnd, isRead, isStarred, hasAttachment } =
    options;

  const addLikeConditions = (fields: readonly EmailField[], value: string) => {
    const terms = splitLikeTerm(value);
    for (let i = 0, len = terms.length; i < len; i++) {
      const term = escapeLikeTerm(terms[i]);
      const columnConditions = fields.map(
        (field) => sql`${emailCol(alias, field)} LIKE ${`%${term}%`} ESCAPE '\\'`
      );
      conditions.push(sql`(${sql.join(columnConditions, sql` OR `)})`);
    }
  };

  if (query) {
    addLikeConditions(['subject', 'body', 'sender', 'recipient', 'cc', 'bcc'], query);
  }
  if (folder) {
    conditions.push(sql`${emailCol(alias, 'folder_id')} = ${folderRef(folder)}`);
  }
  if (from) addLikeConditions(['sender'], from);
  if (to) addLikeConditions(['recipient', 'cc', 'bcc'], to);
  if (subject) addLikeConditions(['subject'], subject);
  if (dateStart) {
    conditions.push(sql`${emailCol(alias, 'date')} >= ${dateStart}`);
  }
  if (dateEnd) {
    conditions.push(sql`${emailCol(alias, 'date')} <= ${dateEnd}`);
  }
  if (isRead !== undefined) {
    conditions.push(sql`${emailCol(alias, 'read')} = ${isRead ? 1 : 0}`);
  }
  if (isStarred !== undefined) {
    conditions.push(sql`${emailCol(alias, 'starred')} = ${isStarred ? 1 : 0}`);
  }
  if (hasAttachment) {
    conditions.push(sql`${emailCol(alias, 'id')} IN (SELECT DISTINCT email_id FROM attachments)`);
  }
  return { conditions };
}

export function toEmail(row: EmailRow): Email {
  return {
    id: row.id,
    folder_id: row.folder_id,
    subject: row.subject,
    sender: row.sender,
    recipient: row.recipient,
    cc: row.cc,
    bcc: row.bcc,
    date: row.date,
    read: !!row.read,
    starred: !!row.starred,
    body: row.body,
    in_reply_to: row.in_reply_to,
    email_references: row.email_references,
    thread_id: row.thread_id,
    message_id: row.message_id,
    raw_headers: row.raw_headers,
    resend_id: row.resend_id,
    delivery_status: row.delivery_status,
    sender_auth: row.sender_auth ?? null,
    snippet: row.snippet,
    folder_name: row.folder_name
  };
}

export function toThread(row: EmailRow, isDraft: boolean): Email {
  return {
    ...toEmail(row),
    thread_count: row.thread_count || 1,
    thread_unread_count: row.thread_unread_count || 0,
    participants: row.participants || row.sender || undefined,
    ...(!isDraft && { needs_reply: !!row.needs_reply, has_draft: !!row.has_draft })
  };
}

export function groupAttachments(rows: Attachment[]): ReadonlyMap<string, Attachment[]> {
  return Map.groupBy(rows, (attachment) => attachment.email_id);
}

export function pageWindow(page = 1, limit = 25) {
  const lim = clamp(limit, 1, 100);
  return { lim, offset: (page - 1) * lim };
}

export function threadsSql(folderRef: SQL, limit: number, offset: number) {
  return sql`
    WITH folder_emails AS (
      SELECT *,
        COALESCE(thread_id, id) AS raw_key,
        ${NORMALIZED_SUBJECT_SQL} AS normalized_subject
      FROM emails
      WHERE folder_id = ${folderRef}
    ),
    thread_to_conversation AS (
      SELECT raw_key, normalized_subject, thread_id,
        CASE WHEN thread_id IS NOT NULL THEN raw_key
          WHEN normalized_subject != '' THEN MIN(raw_key) OVER (PARTITION BY normalized_subject)
          ELSE raw_key
        END AS conversation_id
      FROM folder_emails
      GROUP BY raw_key, normalized_subject, thread_id
    ),
    all_emails_with_conversation AS (
      SELECT e.*,
        COALESCE(tc.conversation_id, COALESCE(e.thread_id, e.id)) AS conversation_id
      FROM emails e
      LEFT JOIN thread_to_conversation tc
        ON COALESCE(e.thread_id, e.id) = tc.raw_key
    ),
    conversation_stats AS (
      SELECT conversation_id,
        COUNT(*) AS thread_count,
        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) AS thread_unread_count,
        SUM(CASE WHEN read = 1 THEN 1 ELSE 0 END) AS thread_read_count,
        GROUP_CONCAT(DISTINCT sender) AS participants,
        SUM(CASE WHEN folder_id = ${DRAFT_FOLDER_SQL} THEN 1 ELSE 0 END) AS has_draft
      FROM all_emails_with_conversation
      WHERE conversation_id IN (
        SELECT DISTINCT conversation_id FROM all_emails_with_conversation
        WHERE folder_id = ${folderRef}
      )
      GROUP BY conversation_id
    ),
    latest_per_conversation AS (
      SELECT conversation_id, folder_id,
        ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY date DESC) AS rn
      FROM all_emails_with_conversation
    ),
    latest_in_folder AS (
      SELECT fe.*, COALESCE(tc.conversation_id, fe.raw_key) AS conversation_id,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(tc.conversation_id, fe.raw_key)
          ORDER BY fe.date DESC
        ) AS rn
      FROM folder_emails fe
      LEFT JOIN thread_to_conversation tc ON fe.raw_key = tc.raw_key
    )
    SELECT lif.id, lif.subject, lif.sender, lif.recipient, lif.date,
      lif.read, lif.starred, lif.thread_id, lif.folder_id,
      lif.in_reply_to, lif.email_references,
      lif.resend_id, lif.delivery_status,
      SUBSTR(lif.body, 1, 300) AS snippet,
      cs.thread_count, cs.thread_unread_count, cs.participants,
      CASE WHEN lpc.folder_id != ${SENT_FOLDER_SQL}
        AND lpc.folder_id != ${DRAFT_FOLDER_SQL}
        AND cs.thread_read_count > 0
        THEN 1 ELSE 0 END AS needs_reply,
      cs.has_draft
    FROM latest_in_folder lif
    JOIN conversation_stats cs ON lif.conversation_id = cs.conversation_id
    LEFT JOIN latest_per_conversation lpc
      ON lpc.conversation_id = lif.conversation_id AND lpc.rn = 1
    WHERE lif.rn = 1
    ORDER BY lif.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function draftThreadsSql(folderRef: SQL, limit: number, offset: number) {
  return sql`
    WITH folder_emails AS (
      SELECT *,
        COALESCE(in_reply_to, id) AS raw_key
      FROM emails
      WHERE folder_id = ${folderRef}
    ),
    conversation_stats AS (
      SELECT raw_key AS conversation_id,
        COUNT(*) AS thread_count,
        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) AS thread_unread_count,
        GROUP_CONCAT(DISTINCT sender) AS participants
      FROM folder_emails
      GROUP BY raw_key
    ),
    latest_in_folder AS (
      SELECT fe.*, fe.raw_key AS conversation_id,
        ROW_NUMBER() OVER (PARTITION BY fe.raw_key ORDER BY fe.date DESC) AS rn
      FROM folder_emails fe
    )
    SELECT lif.id, lif.subject, lif.sender, lif.recipient, lif.date,
      lif.read, lif.starred, lif.thread_id, lif.folder_id,
      lif.in_reply_to, lif.email_references,
      lif.resend_id, lif.delivery_status,
      SUBSTR(lif.body, 1, 300) AS snippet,
      cs.thread_count, cs.thread_unread_count, cs.participants
    FROM latest_in_folder lif
    JOIN conversation_stats cs ON lif.conversation_id = cs.conversation_id
    WHERE lif.rn = 1
    ORDER BY lif.date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function threadsCountSql(folderRef: SQL) {
  return sql`
    WITH folder_emails AS (
      SELECT COALESCE(thread_id, id) AS raw_key, thread_id,
        ${NORMALIZED_SUBJECT_SQL} AS normalized_subject
      FROM emails
      WHERE folder_id = ${folderRef}
    ),
    thread_to_conversation AS (
      SELECT raw_key,
        CASE WHEN thread_id IS NOT NULL THEN raw_key
          WHEN normalized_subject != '' THEN MIN(raw_key) OVER (PARTITION BY normalized_subject)
          ELSE raw_key
        END AS conversation_id
      FROM folder_emails
      GROUP BY raw_key, normalized_subject, thread_id
    )
    SELECT COUNT(DISTINCT conversation_id) AS total FROM thread_to_conversation
  `;
}

export function draftThreadsCountSql(folderRef: SQL) {
  return sql`
    SELECT COUNT(DISTINCT COALESCE(in_reply_to, id)) AS total
    FROM emails
    WHERE folder_id = ${folderRef}
  `;
}
