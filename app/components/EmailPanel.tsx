import { useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Folders } from 'shared/folders';
import { toast } from '~/components/ui/toast';
import EmailPanelDialogs from '~/components/email-panel/EmailPanelDialogs';
import EmailPanelHeader from '~/components/email-panel/EmailPanelHeader';
import EmailPanelToolbar from '~/components/email-panel/EmailPanelToolbar';
import SingleMessageView from '~/components/email-panel/SingleMessageView';
import ThreadMessage from '~/components/email-panel/ThreadMessage';
import { useUIStore } from '~/hooks/useUIStore';
import { buildEmailPayload } from '~/lib/emails';
import { splitEmailList } from '~/lib/utils';
import {
  useDeleteEmail,
  useDeliveryStatus,
  useEmail,
  useMoveEmail,
  useReplyToEmail,
  useSendEmail,
  useThreadReplies,
  useUpdateEmail
} from '~/queries/emails';
import { useFolders } from '~/queries/folders';
import { useMailbox } from '~/queries/mailboxes';
import api from '~/services/api';
import type { Email, Folder, Mailbox } from '~/types';

function EmailPanelSkeleton() {
  return (
    <div className="animate-pulse p-5 flex flex-col gap-4">
      <div className="h-5 w-2/3 rounded bg-muted" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="h-2.5 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-4">
        <div className="h-2.5 w-full rounded bg-muted" />
        <div className="h-2.5 w-5/6 rounded bg-muted" />
        <div className="h-2.5 w-4/6 rounded bg-muted" />
        <div className="h-2.5 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function EmailPanel({ emailId }: { emailId: string }) {
  const { mailboxId, folder } = useParams({ strict: false });
  const { data: email } = useEmail(mailboxId, emailId) as { data?: Email };

  const pendingDeliveryStatuses = new Set(['sent', 'queued', 'scheduled', 'delayed']);
  const shouldSyncDeliveryStatus = !!(
    email?.folder_id === Folders.SENT
    && email.resend_id
    && pendingDeliveryStatuses.has(email.delivery_status ?? 'sent')
  );
  useDeliveryStatus(mailboxId, emailId, {
    enabled: shouldSyncDeliveryStatus
  });

  const { data: threadRepliesRaw } = useThreadReplies(mailboxId, email?.thread_id) as {
    data?: Email[]
  };
  const updateEmailMutation = useUpdateEmail();
  const deleteEmailMutation = useDeleteEmail();
  const moveEmailMutation = useMoveEmail();
  const sendEmailMutation = useSendEmail();
  const replyMutation = useReplyToEmail();
  const { data: folders = [] } = useFolders(mailboxId) as { data?: Folder[] };
  const { data: currentMailbox } = useMailbox(mailboxId) as {
    data?: Mailbox
  };
  const { closePanel, startCompose } = useUIStore();
  const [isSending, setIsSending] = useState(false);
  const [sourceViewEmail, setSourceViewEmail] = useState<Email | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  const [previewImage, setPreviewImage] = useState<{
    url: string,
    filename: string
  } | null>(null);
  const isDraftFolder = folder === Folders.DRAFT;

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
  const threadSize = allMessages.length;
  const newestMessageId = allMessages[0]?.id;

  const [previousEmailId, setPreviousEmailId] = useState(currentEmailId);
  if (previousEmailId !== currentEmailId) {
    setPreviousEmailId(currentEmailId);
    setExpandedMessages(newestMessageId && threadSize > 1 ? new Set([newestMessageId]) : new Set());
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
      if (msg.folder_id === Folders.DRAFT || (isDraftFolder && msg.id === emailId)) {
        ids.add(msg.id);
      }
    }
    return ids;
  }, [allMessages, isDraftFolder, emailId]);

  const lastReceivedMessage = useMemo(() => {
    const ce = currentMailbox?.email;
    const received = allMessages.filter((msg) => !draftMessageIds.has(msg.id) && msg.sender !== ce);
    if (received.length > 0) return received[0];
    const nonDrafts = allMessages.filter((msg) => !draftMessageIds.has(msg.id));
    return nonDrafts.length > 0 ? nonDrafts[0] : email;
  }, [allMessages, draftMessageIds, currentMailbox?.email, email]);

  const moveToFolders = useMemo(() => {
    const cur = folder || email?.folder_id;
    return folders.filter((f) => f.id !== cur);
  }, [folders, folder, email?.folder_id]);

  if (!email) return <EmailPanelSkeleton />;

  const toggleStar = () => {
    if (mailboxId) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { starred: !email.starred }
      });
    }
  };
  const handleMove = (folderId: string) => {
    if (mailboxId) {
      moveEmailMutation.mutate({ mailboxId, id: email.id, folderId });
      closePanel();
    }
  };
  const handleDelete = () => {
    if (mailboxId) {
      // eslint-disable-next-line no-alert
      if (!window.confirm('Are you sure you want to delete this email?')) {
        return;
      }
      deleteEmailMutation.mutate({ mailboxId, id: email.id });
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

  const handleDeleteDraft = (draftMsg?: Email) => {
    if (!mailboxId) return;
    const target = draftMsg || email;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Discard this draft?')) return;
    deleteEmailMutation.mutate({ mailboxId, id: target.id });
    toast.add({ title: 'Draft discarded' });
    if (target.id === emailId) closePanel();
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
        toast.add({ title: 'Cannot send: this draft has no recipient.', type: 'error' });
        return;
      }
      const toRecipients = splitEmailList(target.recipient);
      if (toRecipients.length === 0) {
        toast.add({ title: 'Cannot send: this draft has no valid recipient.', type: 'error' });
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
        body: target.body || ''
      });
      if (originalEmail) {
        await replyMutation.mutateAsync({
          mailboxId,
          emailId: originalEmail.id,
          email: emailData
        });
      } else await sendEmailMutation.mutateAsync({ mailboxId, email: emailData });
      await deleteEmailMutation.mutateAsync({ mailboxId, id: target.id });
      toast.add({ title: 'Email sent!' });
      if (isDraftFolder) closePanel();
    } catch (err) {
      const message = (err instanceof Error ? err.message : null) || 'Failed to send email.';
      toast.add({ title: message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const hasThread = allMessages.length > 1;

  return (
    <div className="flex flex-col h-full">
      <EmailPanelToolbar
        email={email}
        isDraftFolder={isDraftFolder}
        isSending={isSending}
        moveToFolders={moveToFolders}
        onBack={closePanel}
        onSendDraft={() => handleSendDraft()}
        onEditDraft={() => handleEditDraft()}
        onReply={() => startCompose({ mode: 'reply', originalEmail: lastReceivedMessage })}
        onReplyAll={() => startCompose({
          mode: 'reply-all',
          originalEmail: lastReceivedMessage
        })}
        onForward={() => startCompose({ mode: 'forward', originalEmail: email })}
        onToggleStar={toggleStar}
        onToggleRead={() => {
          if (mailboxId) {
            updateEmailMutation.mutate({
              mailboxId,
              id: email.id,
              data: { read: !email.read }
            });
          }
        }}
        onMove={handleMove}
        onViewSource={() => setSourceViewEmail(email)}
        onDelete={handleDelete}
      />

      <EmailPanelHeader
        subject={email.subject}
        messageCount={allMessages.length}
        showThreadCount={hasThread}
      />

      <div className="flex-1 overflow-y-auto">
        {hasThread
          ? (
            allMessages.map((msg, idx) => {
              const isDraft = draftMessageIds.has(msg.id);
              return (
                <ThreadMessage
                  key={msg.id}
                  email={msg}
                  mailboxId={mailboxId}
                  mailboxEmail={currentMailbox?.email}
                  isLast={idx === allMessages.length - 1}
                  isDraft={isDraft}
                  isSending={isDraft ? isSending : false}
                  isExpanded={expandedMessages.has(msg.id)}
                  onToggleExpand={() => toggleExpand(msg.id)}
                  onSendDraft={isDraft ? () => handleSendDraft(msg) : undefined}
                  onEditDraft={isDraft ? () => handleEditDraft(msg) : undefined}
                  onDeleteDraft={isDraft ? () => handleDeleteDraft(msg) : undefined}
                  onViewSource={() => setSourceViewEmail(msg)}
                  onPreviewImage={(url, filename) => setPreviewImage({ url, filename })}
                />
              );
            })
          )
          : (
            <SingleMessageView
              email={email}
              mailboxId={mailboxId}
              onPreviewImage={(url, filename) => setPreviewImage({ url, filename })}
            />
          )}
      </div>

      <EmailPanelDialogs
        sourceViewEmail={sourceViewEmail}
        previewImage={previewImage}
        onCloseSource={() => setSourceViewEmail(null)}
        onClosePreview={() => setPreviewImage(null)}
      />
    </div>
  );
}
