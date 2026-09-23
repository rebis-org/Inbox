import { useState } from 'react';
import { Folders } from 'shared/folders';
import { toast } from '~/components/ui/toast';
import type { useUIStore } from '~/hooks/store';
import { buildEmailPayload } from '~/lib/emails';
import { splitEmailList } from '~/lib/utils';
import { m } from '~/paraglide/messages';
import {
  useDeleteEmail,
  useMoveEmail,
  useReplyToEmail,
  useSendEmail,
  useUpdateEmail
} from '~/queries/emails';
import api from '~/services/api';
import type { Email, Mailbox } from '~/types';

export function usePanelActions(
  mailboxId: string | undefined,
  email: Email,
  emailId: string,
  allMessages: Email[],
  currentMailbox: Mailbox | undefined,
  isDraftFolder: boolean,
  closePanel: () => void,
  startCompose: ReturnType<typeof useUIStore.getState>['startCompose']
) {
  const updateEmailMutation = useUpdateEmail();
  const deleteEmailMutation = useDeleteEmail();
  const moveEmailMutation = useMoveEmail();
  const sendEmailMutation = useSendEmail();
  const replyMutation = useReplyToEmail();
  const [isSending, setIsSending] = useState(false);

  const toggleStar = () => {
    if (mailboxId) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { starred: !email.starred }
      });
    }
  };

  const toggleRead = () => {
    if (mailboxId) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { read: !email.read }
      });
    }
  };

  const handleMove = (folderId: string) => {
    if (mailboxId) {
      moveEmailMutation.mutate({ mailboxId, id: email.id, folderId });
      closePanel();
    }
  };

  const [deleteRequest, setDeleteRequest] = useState<{ target: Email, isDraft: boolean } | null>(null);

  const requestDelete = (target?: Email, isDraft = false) => {
    setDeleteRequest({ target: target || email, isDraft });
  };

  const cancelDelete = () => setDeleteRequest(null);

  const confirmDelete = () => {
    if (!mailboxId || !deleteRequest) return;
    const { target, isDraft } = deleteRequest;
    setDeleteRequest(null);
    if (isDraft || target.folder_id === Folders.TRASH) {
      deleteEmailMutation.mutate({ mailboxId, id: target.id });
    } else {
      moveEmailMutation.mutate({ mailboxId, id: target.id, folderId: Folders.TRASH });
    }
    if (isDraft) {
      toast.add({ title: m.viewToastDiscarded() });
      if (target.id === emailId) closePanel();
    } else {
      closePanel();
    }
  };

  const handleEditDraft = (draftMsg?: Email) => {
    const target = draftMsg || email;
    if (target.in_reply_to) {
      startCompose({
        mode: 'reply',
        originalEmail: allMessages.find((msg) => msg.id === target.in_reply_to),
        draftEmail: target
      });
    } else {
      startCompose({
        mode: 'new',
        originalEmail: undefined,
        draftEmail: target
      });
    }
  };

  const handleSendDraft = async (draftMsg?: Email) => {
    if (!mailboxId || !currentMailbox) return;
    let target = draftMsg || email;
    setIsSending(true);
    try {
      if (!target.recipient || !target.subject) {
        try {
          const fresh = await api.getEmail(mailboxId, target.id);
          target = fresh;
        } catch {}
      }
      if (!target.recipient) {
        toast.add({ title: m.viewToastNoRecipient(), type: 'error' });
        return;
      }
      const toRecipients = splitEmailList(target.recipient);
      if (toRecipients.length === 0) {
        toast.add({ title: m.viewToastNoValidRecipient(), type: 'error' });
        return;
      }
      const originalEmail = target.in_reply_to
        ? allMessages.find((msg) => msg.id === target.in_reply_to)
        : undefined;
      const emailData = buildEmailPayload(currentMailbox, {
        to: target.recipient,
        cc: target.cc,
        bcc: target.bcc,
        subject: target.subject || '(no subject)',
        body: target.body || '',
        in_reply_to: target.in_reply_to,
        thread_id: target.thread_id
      });
      if (originalEmail) {
        await replyMutation.mutateAsync({
          mailboxId,
          emailId: originalEmail.id,
          email: emailData
        });
      } else await sendEmailMutation.mutateAsync({ mailboxId, email: emailData });
      await deleteEmailMutation.mutateAsync({ mailboxId, id: target.id });
      toast.add({ title: m.viewToastSent() });
      if (isDraftFolder) closePanel();
    } catch (err) {
      const message = (err instanceof Error ? err.message : null) || m.viewToastFailed();
      toast.add({ title: message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return {
    isSending,
    toggleStar,
    toggleRead,
    handleMove,
    handleEditDraft,
    handleSendDraft,
    deleteRequest,
    requestDelete,
    cancelDelete,
    confirmDelete
  };
}
