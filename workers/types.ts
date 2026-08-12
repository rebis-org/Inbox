export interface Env extends Cloudflare.Env {
  POLICY_AUD: string,
  TEAM_DOMAIN: string,
  RESEND_API_KEY: string,
  RESEND_WEBHOOK_SECRET: string
}

export interface Attachment {
  id: string,
  email_id: string,
  filename: string,
  mimetype: string,
  size: number,
  content_id: string | null,
  disposition: string | null
}

export interface Email {
  id: string,
  folder_id: string,
  subject: string | null,
  sender: string | null,
  recipient: string | null,
  cc: string | null,
  bcc: string | null,
  date: string | null,
  read: boolean,
  starred: boolean,
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
  thread_count?: number,
  thread_unread_count?: number,
  participants?: string,
  needs_reply?: boolean,
  has_draft?: boolean
}

export interface EmailFull extends Email {
  attachments: Attachment[]
}

export interface NewEmail {
  id: string,
  subject: string,
  sender: string,
  recipient: string,
  cc?: string | null,
  bcc?: string | null,
  date: string,
  body: string,
  read?: boolean,
  starred?: boolean,
  in_reply_to?: string | null,
  email_references?: string | null,
  thread_id?: string | null,
  message_id?: string | null,
  raw_headers?: string | null,
  resend_id?: string | null,
  delivery_status?: string | null
}

export interface Folder {
  id: string,
  name: string,
  unreadCount: number
}
