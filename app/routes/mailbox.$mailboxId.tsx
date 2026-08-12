import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import ComposeEmail from '~/components/ComposeEmail';
import Header from '~/components/Header';
import Sidebar from '~/components/Sidebar';
import { useUIStore } from '~/hooks/useUIStore';
import { useMailbox } from '~/queries/mailboxes';

export const Route = createFileRoute('/mailbox/$mailboxId')({
  component: MailboxRoute
});

function MailboxRoute() {
  const { mailboxId } = Route.useParams();

  useMailbox(mailboxId);
  const { isSidebarOpen, closeSidebar, closePanel, closeComposeModal } = useUIStore();

  const [previousMailboxId, setPreviousMailboxId] = useState(mailboxId);
  const mailboxChanged = previousMailboxId !== mailboxId;
  if (mailboxChanged) {
    setPreviousMailboxId(mailboxId);
  }
  useEffect(() => {
    if (mailboxChanged) {
      closePanel();
      closeComposeModal();
      closeSidebar();
    }
  }, [mailboxChanged, closeComposeModal, closePanel, closeSidebar]);

  return (
    <div className="flex h-screen overflow-hidden">
      {isSidebarOpen && (
        <button
          type="button"
          onClick={closeSidebar}
          onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:z-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      <ComposeEmail />
    </div>
  );
}
