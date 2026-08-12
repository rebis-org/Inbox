import { DurableObject } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import type { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { none, some } from '@moeru/results';
import type { Option } from '@moeru/results';
import { tryCatch } from '@moeru/std/try-catch';
import { clamp } from 'foxts/clamp';
import { Folders } from '../shared/folders';
import { attachmentKey, deleteR2Keys } from './attachments';
import { applyMigrations, mailboxMigrations } from './migrations';
import { attachmentsTable, emailsTable } from './schema';
import type { EmailRow } from './schema';
import type { Attachment, Email, EmailFull, Env, Folder, NewEmail } from './types';

const col = (column: { name: string }) => sql.identifier(column.name);

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

type SortColumn = 'id' | 'subject' | 'sender' | 'recipient' | 'date' | 'read' | 'starred';
const SORT_COLUMNS: Partial<Record<SortColumn, SQLiteColumn>> = {
  id: emailsTable.id,
  subject: emailsTable.subject,
  sender: emailsTable.sender,
  recipient: emailsTable.recipient,
  date: emailsTable.date,
  read: emailsTable.read,
  starred: emailsTable.starred
};

export type { SortColumn };

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

function folderRef(folder: string): SQL {
  return sql`(SELECT id FROM folders WHERE name = ${folder} OR id = ${folder} LIMIT 1)`;
}

function emailCol(alias: string, field: EmailField): SQL {
  return alias ? sql.raw(`${alias}.${field}`) : EMAIL_FIELDS[field].getSQL();
}

const REPLY_PREFIX_REGEX = /^(?:(?:re|fwd?|aw|wg|r[eé]f|sv)\s*:\s*)+/i;

function searchConditions(options: SearchFilterOptions, alias = ''): { conditions: SQL[] } {
  const conditions: SQL[] = [];
  const { query, folder, from, to, subject, dateStart, dateEnd, isRead, isStarred, hasAttachment } =
    options;

  const addLikeConditions = (fields: readonly EmailField[], value: string) => {
    const terms = splitLikeTerm(value);
    for (let i = 0, len = terms.length; i < len; i++) {
      const term = terms[i];
      const columnConditions = fields.map(
        (field) => sql`${emailCol(alias, field)} LIKE ${`%${term}%`}`
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

interface ListEmailsOptions {
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

function splitLikeTerm(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length; i += MAX_LIKE_TERM_LENGTH) {
    chunks.push(trimmed.slice(i, i + MAX_LIKE_TERM_LENGTH));
  }
  return chunks;
}

function toEmail(row: EmailRow): Email {
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
    snippet: row.snippet,
    folder_name: row.folder_name
  };
}

function threadsSql(folderRef: SQL, limit: number, offset: number) {
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
          ELSE MIN(raw_key) OVER (PARTITION BY normalized_subject)
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

function draftThreadsSql(folderRef: SQL, limit: number, offset: number) {
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

function threadsCountSql(folderRef: SQL) {
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

function draftThreadsCountSql(folderRef: SQL) {
  return sql`
    SELECT COUNT(DISTINCT COALESCE(in_reply_to, id)) AS total
    FROM emails
    WHERE folder_id = ${folderRef}
  `;
}

export class MailboxDO extends DurableObject<Env> {
  readonly #db: DrizzleSqliteDODatabase;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    applyMigrations(state.storage.sql, mailboxMigrations, state.storage);

    this.#db = drizzle(state.storage);
  }

  #all<T>(query: SQL): T[] {
    return this.#db.all<T>(query);
  }

  #first<T>(query: SQL): T | undefined {
    return this.#db.get<T>(query);
  }

  listEmails(options: ListEmailsOptions = {}): Email[] {
    const { folder, threadId, page = 1, limit = 25, sortColumn, sortDirection } = options;
    const conditions: SQL[] = [];
    if (folder) conditions.push(sql`folder_id = ${folderRef(folder)}`);
    if (threadId) conditions.push(sql`thread_id = ${threadId}`);
    const lim = clamp(limit, 1, 100);
    const col = (sortColumn && SORT_COLUMNS[sortColumn]) || emailsTable.date;
    const dir = sortDirection === 'ASC' ? sql`ASC` : sql`DESC`;
    const rows = this.#all<EmailRow>(sql`
      SELECT id, subject, sender, recipient, cc, bcc, date, read, starred,
        in_reply_to, email_references, thread_id, folder_id, resend_id, delivery_status,
        SUBSTR(body, 1, 300) AS snippet
       FROM emails
       ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
       ORDER BY ${col} ${dir} LIMIT ${lim} OFFSET ${(page - 1) * lim}
    `);
    return rows.map(toEmail);
  }

  countEmails(options: { folder?: string, threadId?: string } = {}): number {
    const conditions: SQL[] = [];
    if (options.folder) {
      conditions.push(sql`folder_id = ${folderRef(options.folder)}`);
    }
    if (options.threadId) {
      conditions.push(sql`thread_id = ${options.threadId}`);
    }
    const row = this.#first<{ total: number }>(sql`
      SELECT COUNT(*) AS total FROM emails
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
    return row?.total ?? 0;
  }

  listThreads(folder: string, page = 1, limit = 25): Email[] {
    const lim = clamp(limit, 1, 100);
    const folderRefSql = folderRef(folder);
    const isDraft = folder === Folders.DRAFT;
    const rows = this.#all<EmailRow>(
      isDraft
        ? draftThreadsSql(folderRefSql, lim, (page - 1) * lim)
        : threadsSql(folderRefSql, lim, (page - 1) * lim)
    );
    return rows.map((row) => ({
      ...toEmail(row),
      thread_count: row.thread_count || 1,
      thread_unread_count: row.thread_unread_count || 0,
      participants: row.participants || row.sender || undefined,
      ...(!isDraft && { needs_reply: !!row.needs_reply, has_draft: !!row.has_draft })
    }));
  }

  countThreads(folder: string): number {
    const folderRefSql = folderRef(folder);
    const row = this.#first<{ total: number }>(
      folder === Folders.DRAFT ? draftThreadsCountSql(folderRefSql) : threadsCountSql(folderRefSql)
    );
    return row?.total ?? 0;
  }

  getEmail(id: string): Option<EmailFull> {
    const row = this.#first<EmailRow>(sql`SELECT * FROM emails WHERE id = ${id}`);
    if (!row) return none;
    return some({
      ...toEmail(row),
      attachments: this.#all<Attachment>(sql`SELECT * FROM attachments WHERE email_id = ${id}`)
    });
  }

  listThreadEmails(threadId: string): EmailFull[] {
    const rows = this.#all<EmailRow>(
      sql`SELECT * FROM emails WHERE thread_id = ${threadId} ORDER BY date ASC`
    );
    if (rows.length === 0) return [];
    const attachmentRows = this.#all<Attachment>(
      sql`SELECT * FROM attachments WHERE email_id IN (${sql.join(
        rows.map((row) => row.id),
        sql`, `
      )})`
    );
    const byEmail = new Map<string, Attachment[]>();
    for (let i = 0, len = attachmentRows.length; i < len; i++) {
      const attachment = attachmentRows[i];
      const list = byEmail.get(attachment.email_id) ?? [];
      list.push(attachment);
      byEmail.set(attachment.email_id, list);
    }
    return rows.map((row) => ({
      ...toEmail(row),
      attachments: byEmail.get(row.id) ?? []
    }));
  }

  updateEmail(id: string, patch: { read?: boolean, starred?: boolean }): Option<EmailFull> {
    const sets: SQL[] = [];
    if (patch.read !== undefined) {
      sets.push(sql`read = ${patch.read ? 1 : 0}`);
    }
    if (patch.starred !== undefined) {
      sets.push(sql`starred = ${patch.starred ? 1 : 0}`);
    }
    if (sets.length) {
      this.#db.run(sql`UPDATE emails SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
    }
    return this.getEmail(id);
  }

  markThreadRead(threadId: string): { threadId: string, markedRead: true } {
    this.#db.run(sql`UPDATE emails SET read = 1 WHERE thread_id = ${threadId} AND read = 0`);
    return { threadId, markedRead: true };
  }

  deleteEmail(id: string): Array<{ id: string, filename: string }> | null {
    if (!this.#first(sql`SELECT id FROM emails WHERE id = ${id}`)) return null;
    const attachments = this.#all<{ id: string, filename: string }>(
      sql`SELECT id, filename FROM attachments WHERE email_id = ${id}`
    );
    this.#db.run(sql`DELETE FROM emails WHERE id = ${id}`);
    return attachments;
  }

  getAttachment(id: string): Option<Attachment> {
    const row = this.#first<Attachment>(sql`SELECT * FROM attachments WHERE id = ${id}`);
    return row ? some(row) : none;
  }

  listFolders(): Folder[] {
    return this.#all<Folder>(
      sql`
        SELECT f.id, f.name,
                COALESCE(SUM(CASE WHEN e.read = 0 THEN 1 ELSE 0 END), 0) AS unreadCount
               FROM folders f
               LEFT JOIN emails e ON e.folder_id = f.id
               GROUP BY f.id, f.name
      `
    );
  }

  createFolder(
    id: string,
    name: string
  ): Option<{ id: string, name: string, unreadCount: number }> {
    const result = tryCatch(() => this.#db.run(sql`INSERT INTO folders (id, name, is_deletable) VALUES (${id}, ${name}, 1)`));
    if (result.error) {
      let current: unknown = result.error;
      while (current instanceof Error) {
        if (current.message.includes('UNIQUE constraint failed')) return none;
        current = current.cause;
      }
      throw result.error instanceof Error ? result.error : new Error(JSON.stringify(result.error));
    }
    return some({ id, name, unreadCount: 0 });
  }

  renameFolder(id: string, name: string): Option<{ id: string, name: string }> {
    if (!this.#first(sql`SELECT id FROM folders WHERE id = ${id}`)) return none;
    this.#db.run(sql`UPDATE folders SET name = ${name} WHERE id = ${id}`);
    return some({ id, name });
  }

  deleteFolder(id: string): Array<{ id: string, email_id: string, filename: string }> | false {
    const folder = this.#first<{ is_deletable: number }>(
      sql`SELECT is_deletable FROM folders WHERE id = ${id}`
    );
    if (!folder || folder.is_deletable === 0) return false;

    const attachments = this.#all<{
      id: string,
      email_id: string,
      filename: string
    }>(
      sql`
        SELECT a.id, a.email_id, a.filename FROM attachments a
               JOIN emails e ON a.email_id = e.id
               WHERE e.folder_id = ${id}
      `
    );
    this.#db.run(sql`DELETE FROM folders WHERE id = ${id}`);
    return attachments;
  }

  moveEmail(id: string, folderId: string): boolean {
    if (!this.#first(sql`SELECT id FROM folders WHERE id = ${folderId}`)) {
      return false;
    }
    this.#db.run(sql`UPDATE emails SET folder_id = ${folderId} WHERE id = ${id}`);
    return true;
  }

  searchEmails(options: SearchFilterOptions & { page?: number, limit?: number }): Email[] {
    const { page = 1, limit = 25 } = options;
    const { conditions } = searchConditions(options, 'e');
    const lim = clamp(limit, 1, 100);
    const rows = this.#all<EmailRow>(sql`
      SELECT e.id, e.subject, e.sender, e.recipient, e.cc, e.bcc, e.date,
        e.read, e.starred, e.in_reply_to, e.email_references,
        e.thread_id, e.folder_id,
        SUBSTR(e.body, 1, 300) AS snippet,
        f.name AS folder_name
       FROM emails e
       LEFT JOIN folders f ON e.folder_id = f.id
       ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
       ORDER BY e.date DESC LIMIT ${lim} OFFSET ${(page - 1) * lim}
    `);
    return rows.map(toEmail);
  }

  countSearchResults(options: SearchFilterOptions): number {
    const { conditions } = searchConditions(options);
    const row = this.#first<{ total: number }>(sql`
      SELECT COUNT(*) AS total FROM emails
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
    return row?.total ?? 0;
  }

  findThreadBySubject(subject: string, senderAddress?: string): Option<string> {
    const normalized = subject.replace(REPLY_PREFIX_REGEX, '').trim().toLowerCase();
    if (!normalized) return none;

    const rows = this.#all<{
      thread_id: string,
      subject: string | null,
      senders: string | null,
      recipients: string | null
    }>(
      sql`
        SELECT thread_id, subject,
                      GROUP_CONCAT(DISTINCT LOWER(sender)) AS senders,
                      GROUP_CONCAT(DISTINCT LOWER(recipient)) AS recipients
               FROM emails
               WHERE thread_id IS NOT NULL
                 AND thread_id != id
                 AND date >= datetime('now', '-7 days')
               GROUP BY thread_id
               ORDER BY MAX(date) DESC
               LIMIT 50
      `
    );

    const sender = senderAddress?.toLowerCase().trim();
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i];
      const rowSubject = (row.subject || '').replace(REPLY_PREFIX_REGEX, '').trim().toLowerCase();
      if (rowSubject !== normalized) continue;
      if (sender) {
        const participants = `${row.senders || ''},${row.recipients || ''}`;
        if (!participants.includes(sender)) continue;
      }
      return some(row.thread_id);
    }
    return none;
  }

  checkSendRateLimit(): string | null {
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const hour = this.#first<{ cnt: number }>(
      sql`
        SELECT COUNT(*) AS cnt FROM emails
               WHERE folder_id = ${Folders.SENT} AND date >= ${sinceHour}
      `
    );
    if ((hour?.cnt ?? 0) >= 20) {
      return 'Rate limit exceeded: max 20 emails per hour per mailbox';
    }
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const day = this.#first<{ cnt: number }>(
      sql`
        SELECT COUNT(*) AS cnt FROM emails
               WHERE folder_id = ${Folders.SENT} AND date >= ${sinceDay}
      `
    );
    if ((day?.cnt ?? 0) >= 100) {
      return 'Rate limit exceeded: max 100 emails per day per mailbox';
    }
    return null;
  }

  createEmail(folder: string, email: NewEmail, attachments: Attachment[]): void {
    const folderRow = this.#first<{ id: string }>(
      sql`SELECT id FROM folders WHERE id = ${folder} OR name = ${folder} LIMIT 1`
    );
    if (!folderRow) {
      throw new Error(`Cannot create email: folder "${folder}" does not exist.`);
    }
    const isSent = folderRow.id === Folders.SENT;
    this.#db.run(sql`
      INSERT INTO ${emailsTable} (${col(emailsTable.id)}, ${col(emailsTable.folderId)},
        ${col(emailsTable.subject)}, ${col(emailsTable.sender)}, ${col(emailsTable.recipient)},
        ${col(emailsTable.cc)}, ${col(emailsTable.bcc)}, ${col(emailsTable.date)},
        ${col(emailsTable.read)}, ${col(emailsTable.starred)}, ${col(emailsTable.body)},
        ${col(emailsTable.inReplyTo)}, ${col(emailsTable.emailReferences)},
        ${col(emailsTable.threadId)}, ${col(emailsTable.messageId)},
        ${col(emailsTable.rawHeaders)}, ${col(emailsTable.resendId)},
        ${col(emailsTable.deliveryStatus)})
       VALUES (${email.id}, ${folderRow.id},
        ${email.subject}, ${email.sender}, ${email.recipient},
        ${email.cc ?? null}, ${email.bcc ?? null}, ${email.date},
        ${isSent || email.read ? 1 : 0}, ${email.starred ? 1 : 0},
        ${email.body}, ${email.in_reply_to ?? null},
        ${email.email_references ?? null}, ${email.thread_id ?? null},
        ${email.message_id ?? null}, ${email.raw_headers ?? null},
        ${email.resend_id ?? null}, ${email.delivery_status ?? 'sent'})
    `);
    for (let i = 0, len = attachments.length; i < len; i++) {
      const attachment = attachments[i];
      this.#db.run(sql`
        INSERT INTO ${attachmentsTable} (${col(attachmentsTable.id)},
          ${col(attachmentsTable.emailId)}, ${col(attachmentsTable.filename)},
          ${col(attachmentsTable.mimetype)}, ${col(attachmentsTable.size)},
          ${col(attachmentsTable.contentId)}, ${col(attachmentsTable.disposition)})
         VALUES (${attachment.id}, ${attachment.email_id},
          ${attachment.filename}, ${attachment.mimetype},
          ${attachment.size}, ${attachment.content_id},
          ${attachment.disposition})
      `);
    }
  }

  setResendInfo(id: string, resendId: string): void {
    this.#db.run(sql`UPDATE emails SET resend_id = ${resendId} WHERE id = ${id}`);
  }

  setDeliveryStatus(id: string, status: string): void {
    this.#db.run(sql`UPDATE emails SET delivery_status = ${status} WHERE id = ${id}`);
  }

  async destroyMailbox(): Promise<void> {
    const rows = this.#all<Attachment>(sql`SELECT email_id, id, filename FROM attachments`);
    await deleteR2Keys(
      this.env.BUCKET,
      rows.map((row) => attachmentKey(row.email_id, row.id, row.filename))
    );
    await this.ctx.storage.deleteAll();

    setTimeout(() => this.ctx.abort('destroyed'), 0);
  }
}
