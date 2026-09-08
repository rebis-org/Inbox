import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/mailbox/$mailboxId/')({
  component: MailboxIndexRoute
});

function MailboxIndexRoute() {
  const { mailboxId } = Route.useParams();
  return (
    <Navigate
      to="/mailbox/$mailboxId/emails/$folder"
      params={{ mailboxId, folder: 'inbox' }}
      replace
    />
  );
}
