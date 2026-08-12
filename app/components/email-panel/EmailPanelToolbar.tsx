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
import type { Email, Folder } from '~/types';

interface EmailPanelToolbarProps {
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

export default function EmailPanelToolbar({
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
}: EmailPanelToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 md:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        aria-label="Back to list"
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
              {isSending ? 'Sending...' : 'Send'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onEditDraft}>
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
          </>
        )
        : (
          <>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onReply} aria-label="Reply" />
              }
              >
                <ReplyIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">Reply</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onReplyAll} aria-label="Reply All" />
              }
              >
                <MessageCircleIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">Reply All</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="ghost" size="icon-sm" onClick={onForward} aria-label="Forward" />
              }
              >
                <ForwardIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">Forward</TooltipContent>
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
            aria-label={email.starred ? 'Unstar' : 'Star'}
          />
        }
        >
          <StarIcon
            fill={email.starred ? 'currentColor' : 'none'}
            className={email.starred ? 'text-warning' : ''}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">{email.starred ? 'Unstar' : 'Star'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleRead}
            aria-label={email.read ? 'Mark as unread' : 'Mark as read'}
          />
        }
        >
          {email.read ? <MailIcon /> : <MailOpenIcon />}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {email.read ? 'Mark as unread' : 'Mark as read'}
        </TooltipContent>
      </Tooltip>

      <MoveToFolderMenu folders={moveToFolders} onMove={onMove} />

      <div className="ml-auto flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={onViewSource} aria-label="View source" />
          }
          >
            <CodeIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">View source</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete" />
          }
          >
            <Trash2Icon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label="Close"
              className="hidden md:inline-flex"
            />
          }
          >
            <XIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function MoveToFolderMenu({
  folders,
  onMove
}: {
  folders: Folder[],
  onMove: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon-sm" aria-label="Move to folder" />
          }
          />
        }
        >
          <FolderIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">Move to folder</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Move to
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {folders.map((f) => (
          <DropdownMenuItem key={f.id} onClick={() => onMove(f.id)}>
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
