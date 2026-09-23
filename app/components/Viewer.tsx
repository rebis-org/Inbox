import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { Folders } from 'shared/folders';
import Dialogs from '~/components/thread/Dialogs';
import Subject from '~/components/thread/Subject';
import Actions from '~/components/thread/Actions';
import Message from '~/components/thread/Message';
import Entry from '~/components/thread/Entry';
import Scroll from '~/components/Scroll';
import { usePanelActions } from '~/components/thread/mutations';
import { usePanelThread } from '~/components/thread/thread';
import { useUIStore } from '~/hooks/store';
import { m } from '~/paraglide/messages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '~/components/ui/alert-dialog';
import { useDeliveryStatus, useEmail, useThreadReplies } from '~/queries/emails';
import { useFolders } from '~/queries/folders';
import { useMailbox } from '~/queries/mailboxes';
import type { Email, Folder, Mailbox } from '~/types';

const viewerSkeleton = (
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

const PENDING_DELIVERY = new Set(['sent', 'queued', 'scheduled', 'delayed']);

export default function Viewer({ emailId }: { emailId: string }) {
  const { mailboxId, folder } = useParams({ strict: false });
  const { data: email } = useEmail(mailboxId, emailId) as { data?: Email };

  useDeliveryStatus(mailboxId, emailId, {
    enabled: !!(
      email?.folder_id === Folders.SENT
      && email.resend_id
      && PENDING_DELIVERY.has(email.delivery_status ?? 'sent')
    )
  });

  const { data: threadRepliesRaw } = useThreadReplies(mailboxId, email?.thread_id) as {
    data?: Email[]
  };
  const { data: folders = [] } = useFolders(mailboxId) as { data?: Folder[] };
  const { data: currentMailbox } = useMailbox(mailboxId) as {
    data?: Mailbox
  };
  const { closePanel, startCompose } = useUIStore();
  const [sourceViewEmail, setSourceViewEmail] = useState<Email | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string,
    filename: string
  } | null>(null);
  const isDraftFolder = folder === Folders.DRAFT;

  const {
    allMessages,
    expandedMessages,
    toggleExpand,
    draftMessageIds,
    lastReceivedMessage,
    moveToFolders,
    hasThread
  } = usePanelThread(email, threadRepliesRaw, currentMailbox?.email, folders, folder, emailId);

  const {
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
  } = usePanelActions(
    mailboxId,
    email!,
    emailId,
    allMessages,
    currentMailbox,
    isDraftFolder,
    closePanel,
    startCompose
  );

  if (!email) return viewerSkeleton;

  return (
    <div className="flex flex-col h-full">
      <Actions
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
        onToggleRead={toggleRead}
        onMove={handleMove}
        onViewSource={() => setSourceViewEmail(email)}
        onDelete={() => requestDelete()}
      />

      <Subject
        subject={email.subject}
        messageCount={allMessages.length}
        showThreadCount={hasThread}
      />

      <Scroll>
        {hasThread
          ? (
            allMessages.map((msg, idx) => {
              const isDraft = draftMessageIds.has(msg.id);
              return (
                <Entry
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
                  onDeleteDraft={isDraft ? () => requestDelete(msg, true) : undefined}
                  onViewSource={() => setSourceViewEmail(msg)}
                  onPreviewImage={(url, filename) => setPreviewImage({ url, filename })}
                />
              );
            })
          )
          : (
            <Message
              email={email}
              mailboxId={mailboxId}
              onPreviewImage={(url, filename) => setPreviewImage({ url, filename })}
            />
          )}
      </Scroll>

      <Dialogs
        sourceViewEmail={sourceViewEmail}
        previewImage={previewImage}
        onCloseSource={() => setSourceViewEmail(null)}
        onClosePreview={() => setPreviewImage(null)}
      />

      <AlertDialog
        open={deleteRequest !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
      >
        <AlertDialogContent className="sm:max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteRequest?.isDraft ? m.viewDeleteDraftTitle() : m.viewDeleteEmailTitle()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRequest?.isDraft
                ? m.viewDeleteDraftDesc()
                : (deleteRequest?.target.folder_id === Folders.TRASH
                  ? m.viewDeleteEmailDesc
                  : m.emailTrashDesc)({ subject: deleteRequest?.target.subject || m.composeNoSubject() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.viewCancel()}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {deleteRequest?.isDraft ? m.viewDiscardConfirm() : m.viewDeleteConfirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
