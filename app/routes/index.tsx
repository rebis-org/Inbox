import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAbortableEffect } from 'foxact/use-abortable-effect';
import { noop } from 'foxts/noop';
import { MailIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from '~/components/ui/toast';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '~/components/ui/dialog';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { queryKeys } from '~/queries/keys';
import { useCreateMailbox, useDeleteMailbox, useMailboxes } from '~/queries/mailboxes';
import api from '~/services/api';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Inbox' }] }),
  component: HomeRoute
});

function HomeRoute() {
  const {
    data: mailboxes = [],
    refetch: refetchMailboxes,
    isFetched: mailboxesFetched
  } = useMailboxes();
  const createMailbox = useCreateMailbox();
  const deleteMailbox = useDeleteMailbox();

  const { data: configData } = useQuery({
    queryKey: queryKeys.config,
    queryFn: () => api.getConfig(),
    staleTime: Infinity
  });

  const domains = useMemo(() => configData?.domains ?? [], [configData]);
  const emailAddresses = useMemo(() => configData?.emailAddresses ?? [], [configData]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPrefix, setNewPrefix] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mailboxToDelete, setMailboxToDelete] = useState<{
    id: string,
    email: string
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const firstDomain = domains[0];
  if (!selectedDomain && firstDomain) {
    setSelectedDomain(firstDomain);
  }

  const domainItems = [
    { label: 'Select domain', value: null },
    ...domains.map((d) => ({ label: d, value: d }))
  ];

  const autoCreateDoneRef = useRef(false);
  useAbortableEffect(
    (signal) => {
      if (autoCreateDoneRef.current) return;
      if (!mailboxesFetched || emailAddresses.length === 0) return;
      const existingEmails = new Set(mailboxes.map((m) => m.email.toLowerCase()));
      const toCreate = emailAddresses.filter((addr) => !existingEmails.has(addr.toLowerCase()));
      if (toCreate.length === 0) {
        autoCreateDoneRef.current = true;
        return;
      }
      autoCreateDoneRef.current = true;
      Promise.all(
        toCreate.map((addr) => {
          const localPart = addr.split('@', 1)[0] || addr;
          return api.createMailbox(addr, localPart).catch(noop);
        })
      )
        .then(() => {
          if (!signal.aborted) refetchMailboxes();
        })
        .catch(noop);
    },
    [emailAddresses, mailboxes, mailboxesFetched, refetchMailboxes]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!newPrefix || !selectedDomain) {
      setCreateError('Please fill in all fields');
      return;
    }
    const email = `${newPrefix}@${selectedDomain}`;
    const name = newName || newPrefix;
    setIsCreating(true);
    try {
      await createMailbox.mutateAsync({ email, name });
      toast.add({ title: 'Mailbox created successfully!' });
      setIsCreateOpen(false);
      setNewPrefix('');
      setNewName('');
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : null) || 'Failed to create mailbox';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!mailboxToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMailbox.mutateAsync(mailboxToDelete.id);
      toast.add({ title: 'Mailbox deleted' });
      setIsDeleteOpen(false);
      setMailboxToDelete(null);
    } catch {
      toast.add({ title: 'Failed to delete mailbox', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfigured = emailAddresses.length > 0;
  const accounts = isConfigured
    ? emailAddresses.map((addr) => ({
      id: addr,
      email: addr,
      name: addr.split('@', 1)[0] || addr
    }))
    : mailboxes;

  const isLoading = !configData;

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Mailboxes</h1>
            {!isConfigured && (
              <Button variant="default" onClick={() => setIsCreateOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                New Mailbox
              </Button>
            )}
          </div>
          {domains.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{domains.join(', ')}</p>
          )}
        </div>

        {isLoading
          ? (
            <div className="flex justify-center py-20">
              <Spinner className="size-8" />
            </div>
          )
          : (accounts.length > 0
            ? (
              <div className="rounded-2xl border border-border bg-background overflow-hidden">
                {accounts.map((account, idx) => (
                  <Link
                    key={account.id}
                    to="/mailbox/$mailboxId"
                    params={{ mailboxId: account.id }}
                    className={`group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-muted ${
                      idx > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{account.name}</div>
                      <div className="text-sm text-muted-foreground">{account.email}</div>
                    </div>
                    {!isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete mailbox ${account.email}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMailboxToDelete({
                            id: account.id,
                            email: account.email
                          });
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </Link>
                ))}
              </div>
            )
            : (
              <div className="rounded-2xl border border-border bg-background py-16 px-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-muted">
                    <MailIcon className="text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1.5">No mailboxes yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-5">
                    {isConfigured
                      ? 'Your email routing is configured but no mailboxes have been created yet. They will appear here automatically.'
                      : 'Create a mailbox to start sending and receiving emails with your domain.'}
                  </p>
                  {!isConfigured && (
                    <Button variant="default" onClick={() => setIsCreateOpen(true)}>
                      <PlusIcon data-icon="inline-start" />
                      Create Mailbox
                    </Button>
                  )}
                </div>
              </div>
            ))}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="p-6 sm:max-w-xs">
          <DialogTitle className="text-base font-semibold mb-5">Create New Mailbox</DialogTitle>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <Field>
              <FieldLabel htmlFor="address-prefix">Email Address</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    id="address-prefix"
                    placeholder="info"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    required
                  />
                </div>
                <span className="text-sm text-muted-foreground">@</span>
                {domains.length > 1
                  ? (
                    <div className="flex-1">
                      <Select
                        items={domainItems}
                        value={selectedDomain}
                        onValueChange={(value) => {
                          if (value) setSelectedDomain(value);
                        }}
                      >
                        <SelectTrigger aria-label="Domain" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {domainItems.map((item) => (
                              <SelectItem
                                key={item.value ?? 'placeholder'}
                                value={item.value}
                              >
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                  : (
                    <span className="text-sm text-muted-foreground">
                      {selectedDomain || 'no domain'}
                    </span>
                  )}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="display-name">Display Name (optional)</FieldLabel>
              <Input
                id="display-name"
                placeholder="Info"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="secondary" size="sm" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isCreating || !selectedDomain}
              >
                {isCreating ? <Spinner data-icon="inline-start" /> : null}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setMailboxToDelete(null);
        }}
      >
        <DialogContent className="p-6 sm:max-w-xs">
          <DialogTitle className="text-base font-semibold mb-2">Delete Mailbox</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mb-5">
            Are you sure you want to delete{' '}
            <strong className="text-foreground">{mailboxToDelete?.email}</strong> ? This action
            cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="secondary" size="sm" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" size="sm" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? <Spinner data-icon="inline-start" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
