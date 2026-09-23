import { Folders } from 'shared/folders';
import { formatDetailDate } from 'shared/dates';
import Delivery from '~/components/Delivery';
import Attachments from '~/components/Attachments';
import AuthWarning from '~/components/AuthWarning';
import Frame from '~/components/Frame';
import { rewriteInlineImages } from '~/lib/attachments';
import type { Email } from '~/types';

interface MessageProps {
  email: Email,
  mailboxId?: string,
  onPreviewImage: (url: string, filename: string) => void
}

export default function Message({
  email,
  mailboxId,
  onPreviewImage
}: MessageProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
              {email.sender.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{email.sender}</div>
              <div className="text-xs text-muted-foreground">To: {email.recipient}</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDetailDate(email.date)}
          </span>
        </div>
        {email.folder_id === Folders.SENT && (
          <Delivery status={email.delivery_status} className="mt-2" />
        )}
        {email.sender_auth === 'fail' && (
          <div className="mt-3">
            <AuthWarning />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <div className="px-4 py-4 md:px-6">
          <Frame
            body={rewriteInlineImages(email.body || '', mailboxId || '', email.id, email.attachments)}
          />
        </div>
      </div>

      <Attachments
        mailboxId={mailboxId}
        emailId={email.id}
        attachments={email.attachments}
        onPreviewImage={onPreviewImage}
        className="px-4 py-3 border-t border-border shrink-0 md:px-6"
        showHeading
      />
    </div>
  );
}
