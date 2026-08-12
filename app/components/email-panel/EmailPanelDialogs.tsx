import { Button } from '~/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { downloadFile } from '~/lib/attachments';
import type { Email } from '~/types';

interface PreviewImage {
  url: string,
  filename: string
}

interface EmailPanelDialogsProps {
  sourceViewEmail: Email | null,
  previewImage: PreviewImage | null,
  onCloseSource: () => void,
  onClosePreview: () => void
}

function getSourceHeaders(msg: Email): Array<{ key: string, value: string }> {
  if (msg.raw_headers) {
    try {
      const parsed = JSON.parse(msg.raw_headers);
      if (Array.isArray(parsed)) {
        return parsed.map((header) => ({
          key: header.key || header.name || '',
          value: String(header.value || '')
        }));
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value)
        }));
      }
    } catch {}
  }

  const headers: Array<{ key: string, value: string }> = [];
  if (msg.sender) headers.push({ key: 'From', value: msg.sender });
  if (msg.recipient) headers.push({ key: 'To', value: msg.recipient });
  if (msg.cc) headers.push({ key: 'Cc', value: msg.cc });
  if (msg.bcc) headers.push({ key: 'Bcc', value: msg.bcc });
  if (msg.subject) headers.push({ key: 'Subject', value: msg.subject });
  if (msg.date) headers.push({ key: 'Date', value: msg.date });
  if (msg.message_id) {
    headers.push({ key: 'Message-ID', value: msg.message_id });
  }
  if (msg.in_reply_to) {
    headers.push({ key: 'In-Reply-To', value: msg.in_reply_to });
  }
  if (msg.email_references) {
    headers.push({ key: 'References', value: msg.email_references });
  }
  if (msg.thread_id) headers.push({ key: 'X-Thread-ID', value: msg.thread_id });
  return headers;
}

export default function EmailPanelDialogs({
  sourceViewEmail,
  previewImage,
  onCloseSource,
  onClosePreview
}: EmailPanelDialogsProps) {
  const sourceHeaders = sourceViewEmail ? getSourceHeaders(sourceViewEmail) : [];

  return (
    <>
      <Dialog
        open={sourceViewEmail !== null}
        onOpenChange={(open) => {
          if (!open) onCloseSource();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>
            Email Source Headers
            {sourceViewEmail && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {sourceViewEmail.subject}
              </span>
            )}
          </DialogTitle>
          {sourceViewEmail && (
            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {/* eslint-disable @eslint-react/no-array-index-key */}
                  {sourceHeaders.map((header, idx) => {
                    const zebra = idx % 2 === 0;
                    return (
                      <tr key={`${header.key}-${idx}`} className={zebra ? 'bg-muted/50' : ''}>
                        <td className="py-1.5 px-3 font-mono font-semibold text-foreground whitespace-nowrap align-top w-[160px]">
                          {header.key}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-muted-foreground break-all">
                          {header.value}
                        </td>
                      </tr>
                    );
                  })}
                  {/* eslint-enable @eslint-react/no-array-index-key */}
                </tbody>
              </table>
              {sourceHeaders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No header data available for this email.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <DialogClose render={<Button variant="secondary" size="sm" />}>
              Close
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) onClosePreview();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{previewImage?.filename}</DialogTitle>
          {previewImage && (
            <div className="mt-4 flex flex-col items-center justify-center bg-muted/30 rounded-2xl p-4 min-h-[200px]">
              <img
                src={previewImage.url}
                alt={previewImage.filename}
                className="max-w-full max-h-[70vh] object-contain rounded shadow-sm"
              />
            </div>
          )}
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (previewImage) {
                  downloadFile(previewImage.url, previewImage.filename);
                }
              }}
            >
              Download Original
            </Button>
            <DialogClose render={<Button variant="default" size="sm" />}>
              Close
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
