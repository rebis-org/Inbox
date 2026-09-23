import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ChevronLeftIcon,
  FileIcon,
  FolderIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Folders, SYSTEM_FOLDER_IDS, getFolderDisplayName } from 'shared/folders';
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
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/store';
import { cn } from '~/lib/utils';
import { m } from '~/paraglide/messages';
import { useCreateFolder, useDeleteFolder, useFolders } from '~/queries/folders';
import { useMailbox } from '~/queries/mailboxes';
import { split0th } from 'foxts/split-nth';

const FOLDER_ICONS: Record<string, React.ReactNode> = {
  [Folders.INBOX]: <InboxIcon size={16} />,
  [Folders.SENT]: <SendIcon size={16} />,
  [Folders.DRAFT]: <FileIcon size={16} />,
  [Folders.ARCHIVE]: <ArchiveIcon size={16} />,
  [Folders.TRASH]: <Trash2Icon size={16} />
};

const SYSTEM_FOLDER_LINKS = [
  Folders.INBOX,
  Folders.SENT,
  Folders.DRAFT,
  Folders.ARCHIVE,
  Folders.TRASH
];

interface FolderLinkProps {
  to: string,
  icon: React.ReactNode,
  label: string,
  unreadCount?: number,
  onClick?: () => void,
  className?: string,
  collapsed?: boolean
}

function FolderLink({ to, icon, label, unreadCount, onClick, className, collapsed }: FolderLinkProps) {
  const rowClass = cn(
    'flex items-center gap-3 py-2 px-3 rounded-xl text-sm transition-colors',
    collapsed && 'relative justify-center px-2',
    className
  );
  const link = (
    <Link
      to={to}
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      activeProps={{
        className: cn(rowClass, 'bg-accent font-semibold text-foreground')
      }}
      inactiveProps={{
        className: cn(rowClass, 'text-foreground hover:bg-muted')
      }}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && unreadCount != null && unreadCount > 0 && (
        <Badge variant="secondary">{unreadCount}</Badge>
      )}
      {collapsed && unreadCount != null && unreadCount > 0 && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">
        {label}
        {unreadCount != null && unreadCount > 0 ? ` (${unreadCount})` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function CustomFolderLink({
  to,
  icon,
  label,
  unreadCount,
  onClick,
  onDelete,
  collapsed
}: FolderLinkProps & { onDelete: () => void }) {
  return (
    <div className="group relative">
      <FolderLink
        to={to}
        icon={icon}
        label={label}
        unreadCount={unreadCount}
        onClick={onClick}
        collapsed={collapsed}
        className={collapsed ? undefined : 'pr-8'}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-destructive group-hover:flex"
        aria-label={`${m.navDeleteFolder()}: ${label}`}
      >
        <Trash2Icon size={14} />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const { mailboxId, folder: currentFolderId } = useParams({
    strict: false
  });
  const navigate = useNavigate();
  const { data: folders = [] } = useFolders(mailboxId);
  const createFolderMutation = useCreateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const { startCompose, closeSidebar, isSidebarCollapsed, locale } = useUIStore();
  const { data: currentMailbox } = useMailbox(mailboxId);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<{
    id: string,
    name: string
  } | null>(null);

  const customFolders = useMemo(
    () => folders.filter((f) => !(SYSTEM_FOLDER_IDS as readonly string[]).includes(f.id)),
    [folders]
  );

  const getUnreadCount = (folderId: string) => {
    const found = folders.find((f) => f.id === folderId);
    return found?.unreadCount || 0;
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (mailboxId && newFolderName.trim()) {
      createFolderMutation.mutate({ mailboxId, name: newFolderName.trim() });
      setNewFolderName('');
      setIsCreateFolderOpen(false);
    }
  };

  const handleDeleteFolder = () => {
    if (!folderToDelete || !mailboxId) return;
    deleteFolderMutation.mutate({ mailboxId, id: folderToDelete.id });
    if (currentFolderId === folderToDelete.id) {
      navigate({
        to: '/mailbox/$mailboxId/emails/$folder',
        params: { mailboxId, folder: 'inbox' }
      });
    }
    setFolderToDelete(null);
  };

  const displayName = useMemo(() => {
    if (!currentMailbox) return mailboxId?.split('@', 1)[0] || 'Mailbox';
    if (currentMailbox.settings?.fromName) {
      return currentMailbox.settings.fromName;
    }
    if (currentMailbox.name && currentMailbox.name !== currentMailbox.email) {
      return currentMailbox.name;
    }
    return split0th(currentMailbox.email, '@') || currentMailbox.name;
  }, [currentMailbox, mailboxId]);

  const handleNavClick = () => {
    closeSidebar();
  };

  return (
    <aside className={cn(
      'h-full bg-muted flex flex-col shrink-0 border-r border-border',
      isSidebarCollapsed ? 'w-16' : 'w-64'
    )}
    >
      <div className={cn('pt-4 pb-1', isSidebarCollapsed ? 'px-2' : 'px-5')}>
        {isSidebarCollapsed
          ? (
            <Tooltip>
              <TooltipTrigger render={
                <button
                  type="button"
                  onClick={() => {
                    navigate({ to: '/' });
                    closeSidebar();
                  }}
                  className="flex items-center justify-center w-full py-1.5 text-muted-foreground hover:text-foreground transition-colors mb-2.5 cursor-pointer bg-transparent border-0 p-0"
                  aria-label={m.navMailboxes()}
                />
              }
              >
                <ChevronLeftIcon size={16} />
              </TooltipTrigger>
              <TooltipContent side="right">{m.navMailboxes()}</TooltipContent>
            </Tooltip>
          )
          : (
            <button
              type="button"
              onClick={() => {
                navigate({ to: '/' });
                closeSidebar();
              }}
              className="flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground transition-colors mb-2.5 cursor-pointer bg-transparent border-0 p-0"
            >
              <ChevronLeftIcon size={16} />
              <span>{m.navMailboxes()}</span>
            </button>
          )}
        {!isSidebarCollapsed && (
          <div className="px-1">
            <div className="text-base font-semibold text-foreground truncate">{displayName}</div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">
              {currentMailbox?.email || mailboxId}
            </div>
          </div>
        )}
      </div>

      <div className="px-2 py-3">
        {isSidebarCollapsed
          ? (
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => startCompose()}
                  className="w-full"
                  aria-label={m.navComposeShortcut()}
                />
              }
              >
                <PencilIcon />
              </TooltipTrigger>
              <TooltipContent side="right">{m.navComposeShortcut()}</TooltipContent>
            </Tooltip>
          )
          : (
            <Button variant="default" onClick={() => startCompose()} className="w-full justify-start">
              <PencilIcon data-icon="inline-start" />
              {m.navCompose()}
            </Button>
          )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
        {SYSTEM_FOLDER_LINKS.map((folderId) => (
          <FolderLink
            key={folderId}
            to={`/mailbox/${mailboxId}/emails/${folderId}`}
            icon={FOLDER_ICONS[folderId]}
            label={getFolderDisplayName(folderId, locale)}
            unreadCount={getUnreadCount(folderId)}
            onClick={handleNavClick}
            collapsed={isSidebarCollapsed}
          />
        ))}

        <div className="pt-5">
          <div className={cn(
            'flex items-center mb-1.5',
            isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
          )}
          >
            {!isSidebarCollapsed && (
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                {m.navFolders()}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsCreateFolderOpen(true)}
                  aria-label={m.navNewFolder()}
                />
              }
              >
                <PlusIcon />
              </TooltipTrigger>
              <TooltipContent>{m.navNewFolder()}</TooltipContent>
            </Tooltip>
          </div>
          {customFolders.map((folder) => (
            <CustomFolderLink
              key={folder.id}
              to={`/mailbox/${mailboxId}/emails/${folder.id}`}
              icon={<FolderIcon size={16} />}
              label={folder.name}
              unreadCount={folder.unreadCount}
              onClick={handleNavClick}
              collapsed={isSidebarCollapsed}
              onDelete={() => setFolderToDelete({ id: folder.id, name: folder.name })}
            />
          ))}
        </div>
      </nav>

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="p-6 sm:max-w-xs">
          <DialogTitle className="text-base font-semibold mb-4">{m.navCreateFolder()}</DialogTitle>
          <form onSubmit={handleCreateFolder} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="folder-name">{m.navFolderName()}</FieldLabel>
              <Input
                id="folder-name"
                placeholder={m.navFolderNamePlaceholder()}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
              />
            </Field>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary" />}>{m.navCancel()}</DialogClose>
              <Button type="submit" variant="default" disabled={!newFolderName.trim()}>
                {m.navCreate()}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={folderToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFolderToDelete(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>{m.navDeleteFolder()}</AlertDialogTitle>
            <AlertDialogDescription>
              {folderToDelete && m.navDeleteFolderDesc({ name: folderToDelete.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.navCancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteFolder}
              disabled={deleteFolderMutation.isPending}
            >
              {deleteFolderMutation.isPending ? m.navDeleting() : m.navDelete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
