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
import { Folders } from 'shared/folders';
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
import { getSnippetText } from '~/lib/html';
import { m } from '~/paraglide/messages';
import type { Email } from '~/types';
import { hasUnread, useEmailListContainer } from '~/hooks/email-list';

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
  const c = useEmailListContainer(mailboxId, folder);

  return (
    <Mailbox selectedEmailId={c.selectedEmailId} isComposing={c.isComposing}>
      <Bar
        title={c.folderName}
        actions={(
          <div className="flex items-center gap-1">
            {c.totalCount > 0 && (
              <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">
                {c.totalCount === 1
                  ? m.listCountOne()
                  : m.listCountOther({ n: c.totalCount })}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={c.refresh}
                  disabled={c.isRefreshing}
                  aria-label={m.listRefresh()}
                />
              }
              >
                <RefreshCwIcon className={c.isRefreshing ? 'animate-spin' : ''} />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {c.isRefreshing ? m.listRefreshing() : m.listRefresh()}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      />

      <Scroll aria-keyshortcuts="j k c /">
        {c.isRefreshing && c.emails.length === 0
          ? (
            <EmailListSkeleton />
          )
          : (c.emails.length > 0
            ? (
              <div>
                {c.emails.map((email) => (
                  <Row
                    key={email.id}
                    email={email}
                    unread={hasUnread(email)}
                    isSelected={c.selectedEmailId === email.id}
                    dense={c.isPanelOpen}
                    onOpen={() => c.openEmail(email)}
                    leading={
                      <button
                        type="button"
                        className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          c.toggleStar(email);
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
                                c.toggleRead(email);
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
                                c.setDeleteTarget(email);
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
              <FolderEmptyState folder={folder} onCompose={c.startCompose} />
            ))}
      </Scroll>

      <Pager page={c.page} totalCount={c.totalCount} onPrev={() => c.setPage((p) => p - 1)} onNext={() => c.setPage((p) => p + 1)} />

      <AlertDialog
        open={c.deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) c.setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>{m.listDeleteTitle()}</AlertDialogTitle>
            <AlertDialogDescription>
              {c.deleteTarget && (folder === Folders.TRASH ? m.listDeleteDesc : m.emailTrashDesc)({ subject: c.deleteTarget.subject || m.composeNoSubject() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.navCancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => c.deleteTarget && c.confirmDelete(c.deleteTarget)}
              disabled={c.isDeletePending}
            >
              {c.isDeletePending ? m.navDeleting() : m.navDelete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Mailbox>
  );
}
