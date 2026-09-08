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

const FOLDER_DISPLAY_NAMES_ZH: Record<string, string> = {
  [Folders.INBOX]: '收件箱',
  [Folders.SENT]: '已发送',
  [Folders.DRAFT]: '草稿',
  [Folders.ARCHIVE]: '归档',
  [Folders.TRASH]: '废纸篓',
  [Folders.SPAM]: '垃圾邮件'
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function getFolderDisplayName(folderId: string, locale: 'en' | 'zh' = 'en'): string {
  const names = locale === 'zh' ? FOLDER_DISPLAY_NAMES_ZH : FOLDER_DISPLAY_NAMES;
  return names[folderId.toLowerCase()] || capitalize(folderId);
}

const KNOWN_NAMES = new Map(
  Object.entries(FOLDER_DISPLAY_NAMES).map(([id, name]) => [name.toLowerCase(), id])
);

export function displayFolderLabel(folder: { id: string, name: string }, locale: 'en' | 'zh' = 'en'): string {
  const id = KNOWN_NAMES.get(folder.name.toLowerCase());
  return id ? getFolderDisplayName(id, locale) : folder.name;
}
