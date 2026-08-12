export interface SignatureSettings {
  enabled: boolean,
  text: string,
  html?: string
}

export interface MailboxSettings {
  fromName?: string,
  forwarding?: { enabled: boolean, email: string },
  signature?: SignatureSettings,
  autoReply?: { enabled: boolean, subject: string, message: string }
}

export interface Mailbox {
  id: string,
  email: string,
  name: string,
  settings?: MailboxSettings
}

export interface Email {
  id: string,
  thread_id?: string | null,
  folder_id?: string | null,
  subject: string,
  sender: string,
  recipient: string,
  cc?: string,
  bcc?: string,
  date: string,
  read: boolean,
  starred: boolean,
  body?: string | null,
  in_reply_to?: string | null,
  email_references?: string | null,
  message_id?: string | null,
  raw_headers?: string | null,
  resend_id?: string | null,
  delivery_status?: string | null,
  attachments?: Attachment[],
  snippet?: string | null,

  thread_count?: number,
  thread_unread_count?: number,
  participants?: string,
  needs_reply?: boolean,
  has_draft?: boolean
}

export interface Attachment {
  id: string,
  filename: string,
  mimetype: string,
  size: number,
  content_id?: string,
  disposition?: string
}

export interface Folder {
  id: string,
  name: string,
  unreadCount: number
}
