import type { SubmitHandler } from '@formisch/react';
import { Field, Form, reset, useForm } from '@formisch/react';
import { createFileRoute } from '@tanstack/react-router';
import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useMemo } from 'react';
import { toast } from '~/components/ui/toast';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import Scroll from '~/components/Scroll';
import {
  Field as UIField,
  FieldError as UIFieldError,
  FieldLabel as UIFieldLabel
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import { useUIStore } from '~/hooks/store';
import {
  EMPTY_SETTINGS_INPUT,
  formInputToSettings,
  settingsSchema,
  settingsToFormInput
} from '~/lib/forms';
import type { SettingsFormValues } from '~/lib/forms';
import { m } from '~/paraglide/messages';
import { useMailbox, useUpdateMailbox } from '~/queries/mailboxes';

function ToggleField({
  id,
  of,
  path,
  label
}: {
  id: string,
  of: ReturnType<typeof useForm<ReturnType<typeof settingsSchema>>>,
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
  const { theme, setTheme } = useTheme();
  const { locale, language, setLanguage } = useUIStore();

  const schema = useMemo(() => settingsSchema({
    recipientRequired: m.formRecipientRequired({}, { locale }),
    invalidEmail: m.formInvalidEmail({}, { locale }),
    subjectRequired: m.formSubjectRequired({}, { locale }),
    invalidForward: m.formInvalidForward({}, { locale })
  }), [locale]);
  const settingsForm = useForm<ReturnType<typeof settingsSchema>>({
    schema,
    initialInput: EMPTY_SETTINGS_INPUT,
    validate: 'submit'
  });

  useEffect(() => {
    if (!mailbox) return;
    reset(settingsForm, {
      initialInput: settingsToFormInput(mailbox.settings, mailbox.name || mailbox.email)
    });
  }, [mailbox, settingsForm]);

  const handleSave: SubmitHandler<ReturnType<typeof settingsSchema>> = async (values: SettingsFormValues) => {
    if (!mailbox || !mailboxId) return;
    try {
      await updateMailboxMutation.mutateAsync({
        mailboxId,
        settings: formInputToSettings(values)
      });
      reset(settingsForm, { initialInput: values });
      toast.add({ title: m.settingsSaved() });
    } catch {
      toast.add({ title: m.settingsSaveFailed(), type: 'error' });
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
    <Form of={settingsForm} onSubmit={handleSave} className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-6">
          <h1 className="text-lg font-semibold text-foreground mb-6">{m.settingsTitle()}</h1>

          <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-medium text-foreground mb-1">{m.settingsAppearance()}</div>
              <p className="text-xs text-muted-foreground mb-4">
                {m.settingsDeviceOnly()}
              </p>
              <div className="flex gap-2">
                {[
                  { value: 'system', label: m.themeSystem(), icon: <LaptopIcon data-icon="inline-start" /> },
                  { value: 'light', label: m.themeLightShort(), icon: <SunIcon data-icon="inline-start" /> },
                  { value: 'dark', label: m.themeDarkShort(), icon: <MoonIcon data-icon="inline-start" /> }
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={theme === option.value ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setTheme(option.value)}
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="text-sm font-medium text-foreground mt-6 mb-4">{m.settingsLanguage()}</div>
              <div className="flex gap-2">
                {[
                  { value: 'system', label: m.settingsLangSystem() },
                  { value: 'en', label: m.settingsLangEnglish() },
                  { value: 'zh', label: m.settingsLangChinese() }
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={language === option.value ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setLanguage(option.value as 'system' | 'en' | 'zh')}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-medium text-foreground mb-4">{m.settingsAccount()}</div>
              <div className="flex flex-col gap-3">
                <Field of={settingsForm} path={['fromName']}>
                  {(field) => (
                    <UIField>
                      <UIFieldLabel htmlFor="fromName">{m.settingsDisplayName()}</UIFieldLabel>
                      <Input
                        id="fromName"
                        value={field.input}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </UIField>
                  )}
                </Field>
                <UIField data-disabled>
                  <UIFieldLabel htmlFor="account-email">{m.settingsEmail()}</UIFieldLabel>
                  <Input id="account-email" type="email" value={mailbox.email} disabled />
                </UIField>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-medium text-foreground mb-4">{m.settingsForwarding()}</div>
              <Field of={settingsForm} path={['forwardingEnabled']}>
                {(field) => (
                  <div className="flex flex-col gap-3">
                    <ToggleField
                      id="forwardingEnabled"
                      of={settingsForm}
                      path={['forwardingEnabled']}
                      label={m.settingsForwardLabel()}
                    />
                    <Field of={settingsForm} path={['forwardingEmail']}>
                      {(emailField) => (
                        <UIField data-invalid={!!emailField.errors?.[0]} data-disabled={!field.input}>
                          <UIFieldLabel htmlFor="forwardingEmail">{m.settingsForwardTo()}</UIFieldLabel>
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
              <div className="text-sm font-medium text-foreground mb-4">{m.settingsSignature()}</div>
              <Field of={settingsForm} path={['signatureEnabled']}>
                {(field) => (
                  <div className="flex flex-col gap-3">
                    <ToggleField
                      id="signatureEnabled"
                      of={settingsForm}
                      path={['signatureEnabled']}
                      label={m.settingsSignatureLabel()}
                    />
                    <Field of={settingsForm} path={['signatureText']}>
                      {(sigField) => (
                        <UIField data-disabled={!field.input}>
                          <UIFieldLabel htmlFor="signatureText">{m.settingsSignatureText()}</UIFieldLabel>
                          <Textarea
                            id="signatureText"
                            placeholder={m.settingsSignatureTextPlaceholder()}
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
                          <UIFieldLabel htmlFor="signatureHtml">{m.settingsSignatureHtml()}</UIFieldLabel>
                          <Textarea
                            id="signatureHtml"
                            placeholder="<p>Best,<br><strong>Your Name</strong></p>"
                            value={htmlField.input}
                            onChange={(e) => htmlField.onChange(e.target.value)}
                            disabled={!field.input}
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            {m.settingsSignatureNote()}
                          </p>
                        </UIField>
                      )}
                    </Field>
                  </div>
                )}
              </Field>
            </section>

            <section className="rounded-2xl border border-border bg-background p-5">
              <div className="text-sm font-medium text-foreground mb-4">{m.settingsAutoReply()}</div>
              <Field of={settingsForm} path={['autoReplyEnabled']}>
                {(field) => (
                  <div className="flex flex-col gap-3">
                    <ToggleField
                      id="autoReplyEnabled"
                      of={settingsForm}
                      path={['autoReplyEnabled']}
                      label={m.settingsAutoReplyLabel()}
                    />
                    <Field of={settingsForm} path={['autoReplySubject']}>
                      {(subjField) => (
                        <UIField data-disabled={!field.input}>
                          <UIFieldLabel htmlFor="autoReplySubject">{m.settingsAutoReplySubject()}</UIFieldLabel>
                          <Input
                            id="autoReplySubject"
                            placeholder={m.settingsAutoReplySubjectPlaceholder()}
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
                          <UIFieldLabel htmlFor="autoReplyMessage">{m.settingsAutoReplyMessage()}</UIFieldLabel>
                          <Textarea
                            id="autoReplyMessage"
                            placeholder={m.settingsAutoReplyMessagePlaceholder()}
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

          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background">
        <div className="mx-auto flex max-w-2xl justify-end gap-2 px-4 py-3 md:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset(settingsForm)}
            disabled={!dirty}
          >
            {m.settingsReset()}
          </Button>
          <Button type="submit" variant="default" disabled={settingsForm.isSubmitting || !dirty}>
            {settingsForm.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            {m.settingsSave()}
          </Button>
        </div>
      </div>
    </Form>
  );
}
