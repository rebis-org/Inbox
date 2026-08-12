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
import { Folders } from 'shared/folders';
import DeliveryStatusBadge from '~/components/DeliveryStatusBadge';
import EmailRow from '~/components/EmailRow';
import MailboxSplitView from '~/components/MailboxSplitView';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '~/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '~/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/useUIStore';
import { getSnippetText } from '~/lib/html';
import { useDeleteEmail, useEmails, useMarkThreadRead, useUpdateEmail } from '~/queries/emails';
import { useFolders } from '~/queries/folders';
import { queryKeys } from '~/queries/keys';
import type { Email } from '~/types';

const PAGE_SIZE = 25;

const FOLDER_EMPTY_STATES: Partial<Record<
  string,
  {
    icon: React.ReactNode,
    title: string,
    description: string,
    showCompose?: boolean
  }
>> = {
  [Folders.INBOX]: {
    icon: <InboxIcon className="text-muted-foreground" />,
    title: 'Your inbox is empty',
    description:
      'New emails will appear here when they arrive. Send an email to get the conversation started.',
    showCompose: true
  },
  [Folders.SENT]: {
    icon: <SendIcon className="text-muted-foreground" />,
    title: 'No sent emails',
    description: 'Emails you send will show up here.',
    showCompose: true
  },
  [Folders.DRAFT]: {
    icon: <FileIcon className="text-muted-foreground" />,
    title: 'No drafts',
    description: 'Emails you\'re still working on will be saved here.',
    showCompose: true
  },
  [Folders.ARCHIVE]: {
    icon: <ArchiveIcon className="text-muted-foreground" />,
    title: 'Archive is empty',
    description: 'Move emails here to keep your inbox clean without deleting them.'
  },
  [Folders.TRASH]: {
    icon: <Trash2Icon className="text-muted-foreground" />,
    title: 'Trash is empty',
    description: 'Deleted emails will appear here. You can restore them or permanently delete them.'
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
    title: 'No emails',
    description: 'This folder is empty.'
  };
  return (
    <Empty>
      <EmptyMedia variant="icon">{config.icon}</EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{config.title}</EmptyTitle>
        <EmptyDescription>{config.description}</EmptyDescription>
      </EmptyHeader>
      {'showCompose' in config && config.showCompose && (
        <EmptyContent>
          <Button variant="default" size="sm" onClick={onCompose}>
            <PencilIcon data-icon="inline-start" />
            Compose
          </Button>
        </EmptyContent>
      )}
    </Empty>
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
  const { selectedEmailId, isComposing, selectEmail, closePanel, startCompose } = useUIStore();
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();
  const updateEmailMutation = useUpdateEmail();
  const markThreadReadMutation = useMarkThreadRead();
  const deleteEmailMutation = useDeleteEmail();

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
    return found?.name ?? (folder ? folder.charAt(0).toUpperCase() + folder.slice(1) : 'Inbox');
  }, [folders, folder]);

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

  const handleDelete = (emailId: string) => {
    if (!mailboxId) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete this email?')) return;
    deleteEmailMutation.mutate({ mailboxId, id: emailId });
    if (selectedEmailId === emailId) closePanel();
  };

  const handleRefresh = () => {
    if (mailboxId) {
      queryClient.invalidateQueries({ queryKey: ['emails', mailboxId] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  };

  return (
    <MailboxSplitView selectedEmailId={selectedEmailId} isComposing={isComposing}>
      <div className="flex items-center justify-between px-4 min-h-14 border-b border-border shrink-0 md:px-6">
        <h1 className="text-lg font-semibold text-foreground">{folderName}</h1>
        <div className="flex items-center gap-1">
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
              {totalCount} conversation{totalCount === 1 ? '' : 's'}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="Refresh"
              />
            }
            >
              <RefreshCwIcon className={isRefreshing ? 'animate-spin' : ''} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isRefreshing && emails.length === 0
          ? (
            <EmailListSkeleton />
          )
          : (emails.length > 0
            ? (
              <div>
                {emails.map((email) => (
                  <EmailRow
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
                          <span className="shrink-0 text-xs text-destructive font-medium">Draft</span>
                        )}
                        {folder === Folders.SENT && (
                          <DeliveryStatusBadge status={email.delivery_status} />
                        )}
                        {email.needs_reply && !email.has_draft && (
                          <Tooltip>
                            <TooltipTrigger render={<span className="shrink-0 text-warning" />}>
                              <ReplyIcon size={16} />
                            </TooltipTrigger>
                            <TooltipContent>Needs reply</TooltipContent>
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
                              aria-label={email.read ? 'Mark unread' : 'Mark read'}
                            />
                          }
                          >
                            {email.read ? <MailIcon /> : <MailOpenIcon />}
                          </TooltipTrigger>
                          <TooltipContent>{email.read ? 'Mark unread' : 'Mark read'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(email.id);
                              }}
                              aria-label="Delete"
                            />
                          }
                          >
                            <Trash2Icon />
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
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
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="flex justify-center py-3 border-t border-border shrink-0">
          <Pagination className="gap-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={page <= 1}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage((p) => p - 1);
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < Math.ceil(totalCount / PAGE_SIZE)) {
                      setPage((p) => p + 1);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </MailboxSplitView>
  );
}
