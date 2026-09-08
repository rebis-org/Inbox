import { useMemo, useState } from 'react';
import { Folders } from 'shared/folders';
import type { Email, Folder } from '~/types';

export function usePanelThread(
  email: Email | undefined,
  threadRepliesRaw: Email[] | undefined,
  currentMailboxEmail: string | undefined,
  folders: Folder[],
  folder: string | undefined,
  emailId: string
) {
  const threadReplies = useMemo(() => {
    if (!threadRepliesRaw || !email) return [];
    return threadRepliesRaw.filter((e) => e.id !== email.id);
  }, [threadRepliesRaw, email]);

  const allMessages = useMemo(() => {
    if (!email) return [];
    return [email, ...threadReplies].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [email, threadReplies]);

  const currentEmailId = email?.id;
  const newestMessageId = allMessages[0]?.id;
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  const [previousEmailId, setPreviousEmailId] = useState(currentEmailId);
  if (previousEmailId !== currentEmailId) {
    setPreviousEmailId(currentEmailId);
    setExpandedMessages(
      newestMessageId && allMessages.length > 1 ? new Set([newestMessageId]) : new Set()
    );
  }

  const toggleExpand = (msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const draftMessageIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0, len = allMessages.length; i < len; i++) {
      const msg = allMessages[i];
      if (msg.folder_id === Folders.DRAFT || (folder === Folders.DRAFT && msg.id === emailId)) {
        ids.add(msg.id);
      }
    }
    return ids;
  }, [allMessages, folder, emailId]);

  const lastReceivedMessage = useMemo(() => {
    const received = allMessages.filter((msg) => !draftMessageIds.has(msg.id) && msg.sender !== currentMailboxEmail);
    if (received.length > 0) return received[0];
    const nonDrafts = allMessages.filter((msg) => !draftMessageIds.has(msg.id));
    return nonDrafts.length > 0 ? nonDrafts[0] : email;
  }, [allMessages, draftMessageIds, currentMailboxEmail, email]);

  const moveToFolders = useMemo(() => {
    const cur = folder || email?.folder_id;
    return folders.filter((f) => f.id !== cur);
  }, [folders, folder, email?.folder_id]);

  return {
    threadReplies,
    allMessages,
    expandedMessages,
    toggleExpand,
    draftMessageIds,
    lastReceivedMessage,
    moveToFolders,
    hasThread: allMessages.length > 1
  };
}
