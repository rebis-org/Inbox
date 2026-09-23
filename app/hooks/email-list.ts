import { useEffect, useMemo, useState } from 'react';
import { Folders, displayFolderLabel, getFolderDisplayName } from 'shared/folders';
import type { Email } from '~/types';
import { useUIStore } from '~/hooks/store';
import { useShortcuts } from '~/hooks/shortcuts';
import { useDeleteEmail, useEmails, useMarkThreadRead, useMoveEmail, useRefreshEmails, useUpdateEmail } from '~/queries/emails';
import { useFolders } from '~/queries/folders';
import { PAGE_SIZE } from '~/queries/keys';

export interface EmailListContainer {
  emails: Email[],
  totalCount: number,
  isRefreshing: boolean,
  page: number,
  setPage: (page: number | ((page: number) => number)) => void,
  folderName: string,
  selectedEmailId: string | null,
  isComposing: boolean,
  isPanelOpen: boolean,
  deleteTarget: Email | null,
  setDeleteTarget: (email: Email | null) => void,
  isDeletePending: boolean,
  startCompose: () => void,
  openEmail: (email: Email) => void,
  toggleStar: (email: Email) => void,
  toggleRead: (email: Email) => void,
  confirmDelete: (email: Email) => void,
  refresh: () => void
}

export function useEmailListContainer(mailboxId: string, folder: string): EmailListContainer {
  const {
    selectedEmailId,
    isComposing,
    selectEmail,
    closePanel,
    startCompose,
    focusSearch,
    locale
  } = useUIStore();
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Email | null>(null);

  const updateEmailMutation = useUpdateEmail();
  const markThreadReadMutation = useMarkThreadRead();
  const deleteEmailMutation = useDeleteEmail();
  const moveEmailMutation = useMoveEmail();

  const params = useMemo(
    () => ({
      folder: folder || '',
      page: String(page),
      limit: String(PAGE_SIZE)
    }),
    [folder, page]
  );
  const { data: emailData, isFetching: isRefreshing } = useEmails(mailboxId, params, {
    refetchInterval: 30000
  });
  const emails = emailData?.emails ?? [];
  const totalCount = emailData?.totalCount ?? 0;
  const { data: folders = [] } = useFolders(mailboxId);

  const folderName = useMemo(() => {
    let found: (typeof folders)[number] | undefined;
    for (let i = 0, len = folders.length; i < len; i++) {
      if (folders[i].id === folder) {
        found = folders[i];
        break;
      }
    }
    return found ? displayFolderLabel(found, locale) : getFolderDisplayName(folder, locale);
  }, [folders, folder, locale]);

  const isPanelOpen = selectedEmailId !== null || isComposing;
  const folderKey = `${mailboxId}/${folder}`;
  const [previousFolderKey, setPreviousFolderKey] = useState(folderKey);
  const folderChanged = previousFolderKey !== folderKey;
  if (folderChanged) {
    setPreviousFolderKey(folderKey);
    setPage(1);
  }
  useEffect(() => {
    if (folderChanged) closePanel();
  }, [folderChanged, closePanel]);

  const openEmail = (email: Email) => {
    selectEmail(email.id);
    if (mailboxId && hasUnread(email)) {
      if (email.thread_id && email.thread_count && email.thread_count > 1) {
        markThreadReadMutation.mutate({ mailboxId, threadId: email.thread_id });
      } else {
        updateEmailMutation.mutate({
          mailboxId,
          id: email.id,
          data: { read: true }
        });
      }
    }
  };

  const toggleStar = (email: Email) => {
    if (mailboxId) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { starred: !email.starred }
      });
    }
  };

  const toggleRead = (email: Email) => {
    if (mailboxId) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { read: !email.read }
      });
    }
  };

  const confirmDelete = (email: Email) => {
    if (!mailboxId) return;
    if (folder === Folders.TRASH || folder === Folders.DRAFT) {
      deleteEmailMutation.mutate({ mailboxId, id: email.id });
    } else {
      moveEmailMutation.mutate({ mailboxId, id: email.id, folderId: Folders.TRASH });
    }
    if (selectedEmailId === email.id) closePanel();
    setDeleteTarget(null);
  };

  const refresh = useRefreshEmails(mailboxId);

  const stepSelection = (delta: 1 | -1) => {
    if (emails.length === 0) return;
    const idx = emails.findIndex((e) => e.id === selectedEmailId);
    const base = idx === -1 ? 0 : idx;
    const next = emails[Math.min(emails.length - 1, Math.max(0, base + delta))];
    if (next.id !== selectedEmailId) openEmail(next);
  };

  useShortcuts({
    onNext() {
      stepSelection(1);
    },
    onPrev() {
      stepSelection(-1);
    },
    onCompose() {
      startCompose();
    },
    onSearch() {
      focusSearch();
    },
    onEscape() {
      if (!isComposing && selectedEmailId) closePanel();
    }
  });

  return {
    emails,
    totalCount,
    isRefreshing,
    page,
    setPage,
    folderName,
    selectedEmailId,
    isComposing,
    isPanelOpen,
    deleteTarget,
    setDeleteTarget,
    isDeletePending: deleteEmailMutation.isPending,
    startCompose,
    openEmail,
    toggleStar,
    toggleRead,
    confirmDelete,
    refresh
  };
}

export function hasUnread(email: Email): boolean {
  return email.thread_unread_count === undefined ? !email.read : email.thread_unread_count > 0;
}
