import { XIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useComposeForm } from '~/hooks/useComposeForm';
import { useUIStore } from '~/hooks/useUIStore';
import ComposeForm from './ComposeForm';

export default function ComposePanel() {
  const { closeCompose, closePanel } = useUIStore();
  const compose = useComposeForm();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 min-h-14 border-b border-border shrink-0 md:px-6">
        <h2 className="text-base font-semibold text-foreground">{compose.formTitle}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closeCompose}
          disabled={compose.isSending}
          aria-label="Close compose"
        >
          <XIcon />
        </Button>
      </div>
      <ComposeForm form={compose} onClose={closePanel} onDiscard={closeCompose} layout="panel" />
    </div>
  );
}
