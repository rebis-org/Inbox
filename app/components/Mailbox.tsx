import type { ReactNode } from 'react';
import Panel from '~/components/Panel';
import Viewer from '~/components/Viewer';

interface MailboxProps {
  selectedEmailId: string | null,
  isComposing: boolean,
  children: ReactNode
}

export default function Mailbox({
  selectedEmailId,
  isComposing,
  children
}: MailboxProps) {
  const isPanelOpen = selectedEmailId !== null || isComposing;
  let panel: ReactNode = null;
  if (isComposing && !selectedEmailId) {
    panel = <Panel />;
  } else if (isComposing && selectedEmailId) {
    panel = (
      <div className="flex flex-col h-full overflow-y-auto">
        <Panel />
        <div className="border-t border-border">
          <Viewer emailId={selectedEmailId} />
        </div>
      </div>
    );
  } else if (selectedEmailId) {
    panel = <Viewer emailId={selectedEmailId} />;
  }

  return (
    <div className="flex h-full">
      <div
        className={`flex flex-col min-w-0 shrink-0 ${
          isPanelOpen ? 'hidden md:flex md:w-[380px] md:border-r md:border-border' : 'w-full'
        }`}
      >
        {children}
      </div>
      {isPanelOpen && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full md:w-auto">
          {panel}
        </div>
      )}
    </div>
  );
}
