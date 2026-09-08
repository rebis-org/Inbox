import { XIcon } from 'lucide-react';
import Bar from '~/components/Bar';
import { Button } from '~/components/ui/button';
import { useComposeForm } from '~/hooks/composer';
import { useUIStore } from '~/hooks/store';
import { m } from '~/paraglide/messages';
import Compose from './Compose';

export default function Panel() {
  const { closeCompose, closePanel } = useUIStore();
  const compose = useComposeForm();

  return (
    <div className="flex flex-col h-full bg-background">
      <Bar
        title={compose.formTitle}
        titleClassName="text-base"
        actions={(
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeCompose}
            disabled={compose.isSending}
            aria-label={m.mailboxCloseCompose()}
          >
            <XIcon />
          </Button>
        )}
      />
      <Compose form={compose} onClose={closePanel} onDiscard={closeCompose} layout="panel" />
    </div>
  );
}
