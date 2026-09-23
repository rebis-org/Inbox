import { DurableObject } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/durable-sqlite';
import type { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { none, some } from '@moeru/results';
import type { Option } from '@moeru/results';
import { tryCatch } from '@moeru/std/try-catch';
import { Folders } from '../shared/folders';
import { attachmentKey, deleteR2Keys } from './attachments';
import { applyMigrations, mailboxMigrations } from './migrations';
import {
  REPLY_PREFIX_REGEX,
  SORT_COLUMNS,
  draftThreadsCountSql,
  draftThreadsSql,
  folderRef,
  groupAttachments,
  pageWindow,
  searchConditions,
  threadsCountSql,
  threadsSql,
  toEmail,
  toThread
} from './sql';
import type { ListEmailsOptions, SearchFilterOptions, SortColumn } from './sql';
import { attachmentsTable, emailsTable } from './schema';
import type { EmailRow } from './schema';
import type { Attachment, Email, EmailFull, Env, Folder, NewEmail } from './types';

export type { ListEmailsOptions, SearchFilterOptions, SortColumn };

const col = (column: { name: string }) => sql.identifier(column.name);

const SEARCH_RATE_KEY = 'ratelimit:search';
const SEARCH_RATE_WINDOW_MS = 60 * 1000;
const SEARCH_RATE_LIMIT = 60;

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
    const { folder, threadId, page, limit, sortColumn, sortDirection } = options;
    const conditions: SQL[] = [];
    if (folder) conditions.push(sql`folder_id = ${folderRef(folder)}`);
    if (threadId) conditions.push(sql`thread_id = ${threadId}`);
    const { lim, offset } = pageWindow(page, limit);
    const col = (sortColumn && SORT_COLUMNS[sortColumn]) || emailsTable.date;
    const dir = sortDirection === 'ASC' ? sql`ASC` : sql`DESC`;
    const rows = this.#all<EmailRow>(sql`
      SELECT id, subject, sender, recipient, cc, bcc, date, read, starred,
        in_reply_to, email_references, thread_id, folder_id, resend_id, delivery_status,
        SUBSTR(body, 1, 300) AS snippet
       FROM emails
       ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
       ORDER BY ${col} ${dir} LIMIT ${lim} OFFSET ${offset}
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
    const { lim, offset } = pageWindow(page, limit);
    const folderRefSql = folderRef(folder);
    const isDraft = folder === Folders.DRAFT;
    const rows = this.#all<EmailRow>(
      isDraft
        ? draftThreadsSql(folderRefSql, lim, offset)
        : threadsSql(folderRefSql, lim, offset)
    );
    return rows.map((row) => toThread(row, isDraft));
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
    const byEmail = groupAttachments(this.#all<Attachment>(
      sql`SELECT * FROM attachments WHERE email_id IN (${sql.join(
        rows.map((row) => row.id),
        sql`, `
      )})`
    ));
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
    this.#db.run(sql`DELETE FROM attachments WHERE email_id = ${id}`);
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
    this.#db.run(sql`DELETE FROM attachments WHERE email_id IN (SELECT id FROM emails WHERE folder_id = ${id})`);
    this.#db.run(sql`DELETE FROM emails WHERE folder_id = ${id}`);
    this.#db.run(sql`DELETE FROM folders WHERE id = ${id}`);
    return attachments;
  }

  moveEmail(id: string, folderId: string): boolean {
    if (!this.#first(sql`SELECT id FROM folders WHERE id = ${folderId}`)) {
      return false;
    }
    this.#db.run(sql`
      UPDATE emails
         SET folder_id = ${folderId},
           trashed_at = CASE WHEN ${folderId} = ${Folders.TRASH} THEN ${new Date().toISOString()} ELSE NULL END
       WHERE id = ${id}
    `);
    return true;
  }

  searchEmails(options: SearchFilterOptions & { page?: number, limit?: number }): Email[] {
    const { page, limit } = options;
    const { conditions } = searchConditions(options, 'e');
    const { lim, offset } = pageWindow(page, limit);
    const rows = this.#all<EmailRow>(sql`
      SELECT e.id, e.subject, e.sender, e.recipient, e.cc, e.bcc, e.date,
        e.read, e.starred, e.in_reply_to, e.email_references,
        e.thread_id, e.folder_id,
        SUBSTR(e.body, 1, 300) AS snippet,
        f.name AS folder_name
       FROM emails e
       LEFT JOIN folders f ON e.folder_id = f.id
       ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
       ORDER BY e.date DESC LIMIT ${lim} OFFSET ${offset}
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
    const match = rows.find((row) => {
      if ((row.subject || '').replace(REPLY_PREFIX_REGEX, '').trim().toLowerCase() !== normalized) {
        return false;
      }
      return !sender || `${row.senders || ''},${row.recipients || ''}`.includes(sender);
    });
    return match ? some(match.thread_id) : none;
  }

  #sentSince(since: string): number {
    return this.#first<{ cnt: number }>(
      sql`
        SELECT COUNT(*) AS cnt FROM emails
               WHERE folder_id = ${Folders.SENT} AND date >= ${since}
      `
    )?.cnt ?? 0;
  }

  checkSendRateLimit(): string | null {
    if (this.#sentSince(new Date(Date.now() - 60 * 60 * 1000).toISOString()) >= 20) {
      return 'Rate limit exceeded: max 20 emails per hour per mailbox';
    }
    if (this.#sentSince(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) >= 100) {
      return 'Rate limit exceeded: max 100 emails per day per mailbox';
    }
    return null;
  }

  checkSearchRateLimit(): boolean {
    const now = Date.now();
    const entry = this.ctx.storage.kv.get<{ count: number, reset: number }>(SEARCH_RATE_KEY);
    if (!entry || entry.reset <= now) {
      this.ctx.storage.kv.put(SEARCH_RATE_KEY, {
        count: 1,
        reset: now + SEARCH_RATE_WINDOW_MS
      });
      return true;
    }
    if (entry.count >= SEARCH_RATE_LIMIT) return false;
    this.ctx.storage.kv.put(SEARCH_RATE_KEY, { count: entry.count + 1, reset: entry.reset });
    return true;
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
        ${col(emailsTable.senderAuth)}, ${col(emailsTable.rawHeaders)},
        ${col(emailsTable.resendId)}, ${col(emailsTable.deliveryStatus)})
       VALUES (${email.id}, ${folderRow.id},
        ${email.subject}, ${email.sender}, ${email.recipient},
        ${email.cc ?? null}, ${email.bcc ?? null}, ${email.date},
        ${isSent || email.read ? 1 : 0}, ${email.starred ? 1 : 0},
        ${email.body}, ${email.in_reply_to ?? null},
        ${email.email_references ?? null}, ${email.thread_id ?? null},
        ${email.message_id ?? null}, ${email.sender_auth ?? null},
        ${email.raw_headers ?? null},
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

  async purgeTrash(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const ids = this.#all<{ id: string }>(
      sql`SELECT id FROM emails WHERE folder_id = ${Folders.TRASH} AND COALESCE(trashed_at, date) < ${cutoff}`
    ).map((row) => row.id);
    if (ids.length === 0) return 0;
    const inIds = sql.join(ids, sql`, `);
    const attachments = this.#all<Attachment>(
      sql`SELECT * FROM attachments WHERE email_id IN (${inIds})`
    );
    await deleteR2Keys(
      this.env.BUCKET,
      attachments.map((row) => attachmentKey(row.email_id, row.id, row.filename))
    );
    this.#db.run(sql`DELETE FROM attachments WHERE email_id IN (${inIds})`);
    this.#db.run(sql`DELETE FROM emails WHERE id IN (${inIds})`);
    return ids.length;
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
