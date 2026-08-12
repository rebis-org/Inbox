export const Folders = {
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFT: 'draft',
  ARCHIVE: 'archive',
  TRASH: 'trash',
  SPAM: 'spam'
} as const;

export type FolderId = (typeof Folders)[keyof typeof Folders];

export const SYSTEM_FOLDER_IDS: readonly FolderId[] = [
  Folders.INBOX,
  Folders.SENT,
  Folders.DRAFT,
  Folders.ARCHIVE,
  Folders.TRASH
];

export const FOLDER_DISPLAY_NAMES: Record<string, string> = {
  [Folders.INBOX]: 'Inbox',
  [Folders.SENT]: 'Sent',
  [Folders.DRAFT]: 'Drafts',
  [Folders.ARCHIVE]: 'Archive',
  [Folders.TRASH]: 'Trash',
  [Folders.SPAM]: 'Spam'
};

export function getFolderDisplayName(folderId: string): string {
  return (
    FOLDER_DISPLAY_NAMES[folderId.toLowerCase()]
    || folderId.charAt(0).toUpperCase() + folderId.slice(1)
  );
}
