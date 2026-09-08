import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { createFixedArray } from 'foxts/create-fixed-array';
import {
  ArchiveIcon,
  FileIcon,
  InboxIcon,
  MailIcon,
  MailOpenIcon,
  PencilIcon,
  RefreshCwIcon,
  ReplyIcon,
  SendIcon,
  StarIcon,
  Trash2Icon
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Folders, displayFolderLabel, getFolderDisplayName } from 'shared/folders';
import Bar from '~/components/Bar';
import Delivery from '~/components/Delivery';
import Row from '~/components/Row';
import Mailbox from '~/components/Mailbox';
import Pager from '~/components/Pager';
import Scroll from '~/components/Scroll';
import State from '~/components/State';
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
import { Button } from '~/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useShortcuts } from '~/hooks/shortcuts';
import { useUIStore } from '~/hooks/store';
import { getSnippetText } from '~/lib/html';
import { m } from '~/paraglide/messages';
import { useDeleteEmail, useEmails, useMarkThreadRead, useMoveEmail, useUpdateEmail } from '~/queries/emails';
import { useFolders } from '~/queries/folders';
import { PAGE_SIZE, queryKeys } from '~/queries/keys';
import type { Email } from '~/types';

const FOLDER_EMPTY_STATES: Partial<Record<
  string,
  {
    icon: React.ReactNode,
    titleKey: 'listEmptyInboxTitle' | 'listEmptySentTitle' | 'listEmptyDraftTitle' | 'listEmptyArchiveTitle' | 'listEmptyTrashTitle',
    descKey: 'listEmptyInboxDesc' | 'listEmptySentDesc' | 'listEmptyDraftDesc' | 'listEmptyArchiveDesc' | 'listEmptyTrashDesc',
    showCompose?: boolean
  }
>> = {
  [Folders.INBOX]: {
    icon: <InboxIcon className="text-muted-foreground" />,
    titleKey: 'listEmptyInboxTitle',
    descKey: 'listEmptyInboxDesc',
    showCompose: true
  },
  [Folders.SENT]: {
    icon: <SendIcon className="text-muted-foreground" />,
    titleKey: 'listEmptySentTitle',
    descKey: 'listEmptySentDesc',
    showCompose: true
  },
  [Folders.DRAFT]: {
    icon: <FileIcon className="text-muted-foreground" />,
    titleKey: 'listEmptyDraftTitle',
    descKey: 'listEmptyDraftDesc',
    showCompose: true
  },
  [Folders.ARCHIVE]: {
    icon: <ArchiveIcon className="text-muted-foreground" />,
    titleKey: 'listEmptyArchiveTitle',
    descKey: 'listEmptyArchiveDesc'
  },
  [Folders.TRASH]: {
    icon: <Trash2Icon className="text-muted-foreground" />,
    titleKey: 'listEmptyTrashTitle',
    descKey: 'listEmptyTrashDesc'
  }
};

function EmailListSkeleton() {
  const rows = createFixedArray(8).map((i) => `skeleton-row-${i}`);
  return (
    <div className="animate-pulse flex flex-col gap-1 p-2">
      {rows.map((rowKey) => (
        <div key={rowKey} className="flex items-center gap-3 px-3 py-3">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="w-5 h-5 rounded bg-muted" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-4 rounded bg-muted" />
              <div className="h-3 flex-1 rounded bg-muted" />
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
            <div className="h-2.5 w-3/4 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FolderEmptyState({ folder, onCompose }: { folder?: string, onCompose: () => void }) {
  const config = (folder && FOLDER_EMPTY_STATES[folder]) || {
    icon: <MailIcon className="text-muted-foreground" />,
    titleKey: 'listEmptyGenericTitle',
    descKey: 'listEmptyGenericDesc'
  } as const;
  return (
    <State
      icon={config.icon}
      title={m[config.titleKey]()}
      desc={m[config.descKey]()}
      action={'showCompose' in config && config.showCompose
        ? (
          <Button variant="default" size="sm" onClick={onCompose}>
            <PencilIcon data-icon="inline-start" />
            {m.navCompose()}
          </Button>
        )
        : undefined}
    />
  );
}

function hasUnread(email: Email): boolean {
  return email.thread_unread_count === undefined ? !email.read : email.thread_unread_count > 0;
}

function formatParticipants(email: Email): string {
  if (email.participants) {
    const parts = email.participants.split(',');
    const names: string[] = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const name = parts[i].trim().split('@', 1)[0];
      if (name && !names.includes(name)) names.push(name);
    }
    return names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }
  return email.sender.split('@', 1)[0];
}

export const Route = createFileRoute('/mailbox/$mailboxId/emails/$folder')({
  component: EmailListRoute
});

function EmailListRoute() {
  const { mailboxId, folder } = Route.useParams();
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

  const queryClient = useQueryClient();
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

  const handleRowClick = (email: Email) => {
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

  const handleDelete = (email: Email) => {
    if (!mailboxId) return;
    if (folder === Folders.TRASH || folder === Folders.DRAFT) {
      deleteEmailMutation.mutate({ mailboxId, id: email.id });
    } else {
      moveEmailMutation.mutate({ mailboxId, id: email.id, folderId: Folders.TRASH });
    }
    if (selectedEmailId === email.id) closePanel();
    setDeleteTarget(null);
  };

  const handleRefresh = () => {
    if (mailboxId) {
      queryClient.invalidateQueries({ queryKey: ['emails', mailboxId] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  };

  const stepSelection = (delta: 1 | -1) => {
    if (emails.length === 0) return;
    const idx = emails.findIndex((e) => e.id === selectedEmailId);
    const base = idx === -1 ? 0 : idx;
    const next = emails[Math.min(emails.length - 1, Math.max(0, base + delta))];
    if (next.id !== selectedEmailId) handleRowClick(next);
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

  return (
    <Mailbox selectedEmailId={selectedEmailId} isComposing={isComposing}>
      <Bar
        title={folderName}
        actions={(
          <div className="flex items-center gap-1">
            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
                {totalCount === 1
                  ? m.listCountOne()
                  : m.listCountOther({ n: totalCount })}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label={m.listRefresh()}
                />
              }
              >
                <RefreshCwIcon className={isRefreshing ? 'animate-spin' : ''} />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isRefreshing ? m.listRefreshing() : m.listRefresh()}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      />

      <Scroll aria-keyshortcuts="j k c /">
        {isRefreshing && emails.length === 0
          ? (
            <EmailListSkeleton />
          )
          : (emails.length > 0
            ? (
              <div>
                {emails.map((email) => (
                  <Row
                    key={email.id}
                    email={email}
                    unread={hasUnread(email)}
                    isSelected={selectedEmailId === email.id}
                    dense={isPanelOpen}
                    onOpen={() => handleRowClick(email)}
                    leading={
                      <button
                        type="button"
                        className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(email);
                        }}
                        aria-label={email.starred ? m.listUnstar() : m.listStar()}
                      >
                        <StarIcon
                          size={16}
                          fill={email.starred ? 'currentColor' : 'none'}
                          className={
                            email.starred ? 'text-warning' : 'text-muted-foreground hover:text-warning'
                          }
                        />
                      </button>
                    }
                    title={formatParticipants(email)}
                    meta={
                      <>
                        {(email.thread_count ?? 1) > 1 && (
                          <span className="shrink-0 text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-medium">
                            {email.thread_count}
                          </span>
                        )}
                        {email.has_draft && (
                          <span className="shrink-0 text-xs text-destructive font-medium">{m.listDraft()}</span>
                        )}
                        {folder === Folders.SENT && (
                          <Delivery status={email.delivery_status} />
                        )}
                        {email.needs_reply && !email.has_draft && (
                          <Tooltip>
                            <TooltipTrigger render={<span className="shrink-0 text-warning" />}>
                              <ReplyIcon size={16} />
                            </TooltipTrigger>
                            <TooltipContent>{m.listNeedsReply()}</TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    }
                    subtitle={
                      <>
                        <span
                          className={
                            hasUnread(email) ? 'font-medium text-foreground' : 'text-muted-foreground'
                          }
                        >
                          {email.subject}
                        </span>
                        {getSnippetText(email.snippet) && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            &mdash; {getSnippetText(email.snippet)}
                          </span>
                        )}
                      </>
                    }
                    hoverActions={
                      <>
                        <Tooltip>
                          <TooltipTrigger render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (mailboxId) {
                                  updateEmailMutation.mutate({
                                    mailboxId,
                                    id: email.id,
                                    data: { read: !email.read }
                                  });
                                }
                              }}
                              aria-label={email.read ? m.listMarkUnread() : m.listMarkRead()}
                            />
                          }
                          >
                            {email.read ? <MailIcon /> : <MailOpenIcon />}
                          </TooltipTrigger>
                          <TooltipContent>{email.read ? m.listMarkUnread() : m.listMarkRead()}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(email);
                              }}
                              aria-label={m.listDelete()}
                            />
                          }
                          >
                            <Trash2Icon />
                          </TooltipTrigger>
                          <TooltipContent>{m.listDelete()}</TooltipContent>
                        </Tooltip>
                      </>
                    }
                  />
                ))}
              </div>
            )
            : (
              <FolderEmptyState folder={folder} onCompose={() => startCompose()} />
            ))}
      </Scroll>

      <Pager page={page} totalCount={totalCount} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>{m.listDeleteTitle()}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (folder === Folders.TRASH ? m.listDeleteDesc : m.emailTrashDesc)({ subject: deleteTarget.subject || m.composeNoSubject() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.navCancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deleteEmailMutation.isPending}
            >
              {deleteEmailMutation.isPending ? m.navDeleting() : m.navDelete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Mailbox>
  );
}
