import {
  ArrowLeftIcon,
  CodeIcon,
  FolderIcon,
  ForwardIcon,
  MailIcon,
  MailOpenIcon,
  MessageCircleIcon,
  PencilIcon,
  ReplyIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Spinner } from '~/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/store';
import { m } from '~/paraglide/messages';
import { SYSTEM_FOLDER_IDS, getFolderDisplayName } from 'shared/folders';
import type { Email, Folder } from '~/types';

interface ActionsProps {
  email: Email,
  isDraftFolder: boolean,
  isSending: boolean,
  moveToFolders: Folder[],
  onBack: () => void,
  onSendDraft: () => void,
  onEditDraft: () => void,
  onReply: () => void,
  onReplyAll: () => void,
  onForward: () => void,
  onToggleStar: () => void,
  onToggleRead: () => void,
  onMove: (folderId: string) => void,
  onViewSource: () => void,
  onDelete: () => void
}

export default function Actions({
  email,
  isDraftFolder,
  isSending,
  moveToFolders,
  onBack,
  onSendDraft,
  onEditDraft,
  onReply,
  onReplyAll,
  onForward,
  onToggleStar,
  onToggleRead,
  onMove,
  onViewSource,
  onDelete
}: ActionsProps) {
  const { locale } = useUIStore();
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 md:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        aria-label={m.navBackToList()}
        className="md:hidden shrink-0"
      >
        <ArrowLeftIcon />
      </Button>

      {isDraftFolder
        ? (
          <>
            <Button variant="default" size="sm" onClick={onSendDraft} disabled={isSending}>
              {isSending
                ? (
                  <Spinner data-icon="inline-start" />
                )
                : (
                  <SendIcon data-icon="inline-start" />
                )}
              {isSending ? m.viewSending() : m.viewSend()}
            </Button>
            <Button variant="secondary" size="sm" onClick={onEditDraft}>
              <PencilIcon data-icon="inline-start" />
              {m.viewEdit()}
            </Button>
          </>
        )
        : (
          <>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onReply} aria-label={m.viewReply()} />
              }
              >
                <ReplyIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">{m.viewReply()}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onReplyAll} aria-label={m.viewReplyAll()} />
              }
              >
                <MessageCircleIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">{m.viewReplyAll()}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onForward} aria-label={m.viewForward()} />
              }
              >
                <ForwardIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">{m.viewForward()}</TooltipContent>
            </Tooltip>
          </>
        )}

      <div className="h-5 w-px bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleStar}
            aria-label={email.starred ? m.viewUnstar() : m.viewStar()}
          />
        }
        >
          <StarIcon
            fill={email.starred ? 'currentColor' : 'none'}
            className={email.starred ? 'text-warning' : ''}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">{email.starred ? m.viewUnstar() : m.viewStar()}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleRead}
            aria-label={email.read ? m.viewMarkUnread() : m.viewMarkRead()}
          />
        }
        >
          {email.read ? <MailIcon /> : <MailOpenIcon />}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {email.read ? m.viewMarkUnread() : m.viewMarkRead()}
        </TooltipContent>
      </Tooltip>

      <MoveToFolderMenu folders={moveToFolders} onMove={onMove} locale={locale} />

      <div className="ml-auto flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={onViewSource} aria-label={m.viewSource()} />
          }
          >
            <CodeIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{m.viewSource()}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={m.viewDelete()} />
          }
          >
            <Trash2Icon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{m.viewDelete()}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label={m.viewClose()}
              className="hidden md:inline-flex"
            />
          }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{m.viewClose()}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function MoveToFolderMenu({
  folders,
  onMove,
  locale
}: {
  folders: Folder[],
  onMove: (id: string) => void,
  locale: 'en' | 'zh'
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon-sm" aria-label={m.viewMoveToFolder()} />
          }
          />
        }
        >
          <FolderIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">{m.viewMoveToFolder()}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {m.viewMoveTo()}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {folders.map((f) => (
          <DropdownMenuItem key={f.id} onClick={() => onMove(f.id)}>
            {(SYSTEM_FOLDER_IDS as readonly string[]).includes(f.id)
              ? getFolderDisplayName(f.id, locale)
              : f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
