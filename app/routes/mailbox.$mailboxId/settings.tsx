import type { SubmitHandler } from '@formisch/react';
import { Field, Form, reset, useForm } from '@formisch/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from '~/components/ui/toast';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Field as UIField,
  FieldError as UIFieldError,
  FieldLabel as UIFieldLabel
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import {
  EMPTY_SETTINGS_INPUT,
  formInputToSettings,
  SettingsFormSchema,
  settingsToFormInput
} from '~/lib/form-schemas';
import { useMailbox, useUpdateMailbox } from '~/queries/mailboxes';

function ToggleField({
  id,
  of,
  path,
  label
}: {
  id: string,
  of: ReturnType<typeof useForm<typeof SettingsFormSchema>>,
  path: ['forwardingEnabled'] | ['signatureEnabled'] | ['autoReplyEnabled'],
  label: string
}) {
  return (
    <Field of={of} path={path}>
      {(field) => (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={field.input}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
          <UIFieldLabel htmlFor={id} className="font-normal cursor-pointer">
            {label}
          </UIFieldLabel>
        </div>
      )}
    </Field>
  );
}

export const Route = createFileRoute('/mailbox/$mailboxId/settings')({
  component: SettingsRoute
});

function SettingsRoute() {
  const { mailboxId } = Route.useParams();
  const { data: mailbox } = useMailbox(mailboxId);
  const updateMailboxMutation = useUpdateMailbox();

  const settingsForm = useForm<typeof SettingsFormSchema>({
    schema: SettingsFormSchema,
    initialInput: EMPTY_SETTINGS_INPUT,
    validate: 'submit'
  });

  useEffect(() => {
    if (!mailbox) return;
    reset(settingsForm, {
      initialInput: settingsToFormInput(mailbox.settings, mailbox.name || mailbox.email)
    });
  }, [mailbox, settingsForm]);

  const handleSave: SubmitHandler<typeof SettingsFormSchema> = async (values) => {
    if (!mailbox || !mailboxId) return;
    try {
      await updateMailboxMutation.mutateAsync({
        mailboxId,
        settings: formInputToSettings(values)
      });
      reset(settingsForm, { initialInput: values });
      toast.add({ title: 'Settings saved!' });
    } catch {
      toast.add({ title: 'Failed to save settings', type: 'error' });
    }
  };

  if (!mailbox) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const dirty = settingsForm.isDirty;

  return (
    <div className="max-w-2xl px-4 py-4 md:px-8 md:py-6 h-full overflow-y-auto">
      <h1 className="text-lg font-semibold text-foreground mb-6">Settings</h1>

      <Form of={settingsForm} onSubmit={handleSave} className="flex flex-col gap-6">
        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-medium text-foreground mb-4">Account</div>
          <div className="flex flex-col gap-3">
            <Field of={settingsForm} path={['fromName']}>
              {(field) => (
                <UIField>
                  <UIFieldLabel htmlFor="fromName">Display Name</UIFieldLabel>
                  <Input
                    id="fromName"
                    value={field.input}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </UIField>
              )}
            </Field>
            <UIField data-disabled>
              <UIFieldLabel htmlFor="account-email">Email</UIFieldLabel>
              <Input id="account-email" type="email" value={mailbox.email} disabled />
            </UIField>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-medium text-foreground mb-4">Forwarding</div>
          <Field of={settingsForm} path={['forwardingEnabled']}>
            {(field) => (
              <div className="flex flex-col gap-3">
                <ToggleField
                  id="forwardingEnabled"
                  of={settingsForm}
                  path={['forwardingEnabled']}
                  label="Forward incoming email to another address"
                />
                <Field of={settingsForm} path={['forwardingEmail']}>
                  {(emailField) => (
                    <UIField data-invalid={!!emailField.errors?.[0]} data-disabled={!field.input}>
                      <UIFieldLabel htmlFor="forwardingEmail">Forward to</UIFieldLabel>
                      <Input
                        id="forwardingEmail"
                        type="email"
                        placeholder="forward@example.com"
                        value={emailField.input}
                        onChange={(e) => emailField.onChange(e.target.value)}
                        aria-invalid={!!emailField.errors?.[0]}
                        disabled={!field.input}
                      />
                      {emailField.errors?.[0]
                        ? (
                          <UIFieldError>{emailField.errors[0]}</UIFieldError>
                        )
                        : null}
                    </UIField>
                  )}
                </Field>
              </div>
            )}
          </Field>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-medium text-foreground mb-4">Signature</div>
          <Field of={settingsForm} path={['signatureEnabled']}>
            {(field) => (
              <div className="flex flex-col gap-3">
                <ToggleField
                  id="signatureEnabled"
                  of={settingsForm}
                  path={['signatureEnabled']}
                  label="Append a signature to new messages"
                />
                <Field of={settingsForm} path={['signatureText']}>
                  {(sigField) => (
                    <UIField data-disabled={!field.input}>
                      <UIFieldLabel htmlFor="signatureText">Signature text</UIFieldLabel>
                      <Textarea
                        id="signatureText"
                        placeholder="Best,"
                        value={sigField.input}
                        onChange={(e) => sigField.onChange(e.target.value)}
                        disabled={!field.input}
                      />
                    </UIField>
                  )}
                </Field>
                <Field of={settingsForm} path={['signatureHtml']}>
                  {(htmlField) => (
                    <UIField data-disabled={!field.input}>
                      <UIFieldLabel htmlFor="signatureHtml">Signature HTML (optional)</UIFieldLabel>
                      <Textarea
                        id="signatureHtml"
                        placeholder="<p>Best,<br><strong>Your Name</strong></p>"
                        value={htmlField.input}
                        onChange={(e) => htmlField.onChange(e.target.value)}
                        disabled={!field.input}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        HTML is sanitized before it is appended to outgoing mail.
                      </p>
                    </UIField>
                  )}
                </Field>
              </div>
            )}
          </Field>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="text-sm font-medium text-foreground mb-4">Auto-reply</div>
          <Field of={settingsForm} path={['autoReplyEnabled']}>
            {(field) => (
              <div className="flex flex-col gap-3">
                <ToggleField
                  id="autoReplyEnabled"
                  of={settingsForm}
                  path={['autoReplyEnabled']}
                  label="Automatically reply to incoming email"
                />
                <Field of={settingsForm} path={['autoReplySubject']}>
                  {(subjField) => (
                    <UIField data-disabled={!field.input}>
                      <UIFieldLabel htmlFor="autoReplySubject">Reply subject</UIFieldLabel>
                      <Input
                        id="autoReplySubject"
                        placeholder="Re: Your message"
                        value={subjField.input}
                        onChange={(e) => subjField.onChange(e.target.value)}
                        disabled={!field.input}
                      />
                    </UIField>
                  )}
                </Field>
                <Field of={settingsForm} path={['autoReplyMessage']}>
                  {(msgField) => (
                    <UIField data-disabled={!field.input}>
                      <UIFieldLabel htmlFor="autoReplyMessage">Reply message</UIFieldLabel>
                      <Textarea
                        id="autoReplyMessage"
                        placeholder="Thanks for your email! I'll get back to you soon."
                        value={msgField.input}
                        onChange={(e) => msgField.onChange(e.target.value)}
                        disabled={!field.input}
                      />
                    </UIField>
                  )}
                </Field>
              </div>
            )}
          </Field>
        </section>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset(settingsForm)}
            disabled={!dirty}
          >
            Reset
          </Button>
          <Button type="submit" variant="default" disabled={settingsForm.isSubmitting || !dirty}>
            {settingsForm.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
}
