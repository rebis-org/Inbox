import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const foldersTable = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  isDeletable: integer('is_deletable').notNull()
});

export const emailsTable = sqliteTable('emails', {
  id: text('id').primaryKey(),
  folderId: text('folder_id').notNull(),
  subject: text('subject'),
  sender: text('sender'),
  recipient: text('recipient'),
  cc: text('cc'),
  bcc: text('bcc'),
  date: text('date'),
  read: integer('read'),
  starred: integer('starred'),
  body: text('body'),
  inReplyTo: text('in_reply_to'),
  emailReferences: text('email_references'),
  threadId: text('thread_id'),
  messageId: text('message_id'),
  rawHeaders: text('raw_headers'),
  resendId: text('resend_id'),
  deliveryStatus: text('delivery_status')
});

export const attachmentsTable = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  emailId: text('email_id').notNull(),
  filename: text('filename').notNull(),
  mimetype: text('mimetype').notNull(),
  size: integer('size').notNull(),
  contentId: text('content_id'),
  disposition: text('disposition')
});

export interface EmailRow {
  id: string,
  folder_id: string,
  subject: string | null,
  sender: string | null,
  recipient: string | null,
  cc: string | null,
  bcc: string | null,
  date: string | null,
  read: number,
  starred: number,
  body: string | null,
  in_reply_to: string | null,
  email_references: string | null,
  thread_id: string | null,
  message_id: string | null,
  raw_headers: string | null,
  resend_id: string | null,
  delivery_status: string,
  snippet?: string | null,
  folder_name?: string,
  participants?: string | null,
  thread_count?: number,
  thread_unread_count?: number,
  needs_reply?: number,
  has_draft?: number
}
