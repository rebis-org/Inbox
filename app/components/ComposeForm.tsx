import { Field, Form } from '@formisch/react';
import { SaveIcon, SendIcon } from 'lucide-react';
import { Alert, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import type { useComposeForm } from '~/hooks/useComposeForm';
import RichTextEditor from './RichTextEditor';

const labelClassName = 'w-14 shrink-0 text-muted-foreground mt-2';

function AddressField({
  form,
  path,
  id,
  label,
  placeholder
}: {
  form: ReturnType<typeof useComposeForm>,
  path: ['to'] | ['cc'] | ['bcc'] | ['subject'],
  id: string,
  label: string,
  placeholder: string
}) {
  return (
    <Field of={form.composeForm} path={path}>
      {(field) => (
        <div className="flex items-start gap-2">
          <FieldLabel htmlFor={id} className={labelClassName}>
            {label}
          </FieldLabel>
          <div className="flex-1 flex flex-col min-w-0">
            <Input
              id={id}
              type="text"
              placeholder={placeholder}
              value={field.input}
              onChange={(e) => field.onChange(e.target.value)}
              aria-invalid={!!field.errors?.[0]}
              required={path[0] === 'to'}
            />
            {field.errors?.[0] ? <FieldError>{field.errors[0]}</FieldError> : null}
          </div>
        </div>
      )}
    </Field>
  );
}

function RecipientFields({ form }: { form: ReturnType<typeof useComposeForm> }) {
  return (
    <>
      <Field of={form.composeForm} path={['to']}>
        {(field) => (
          <div className="flex items-start gap-2">
            <FieldLabel htmlFor="compose-to" className={labelClassName}>
              To
            </FieldLabel>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Input
                  id="compose-to"
                  type="text"
                  placeholder="recipient@example.com, another@example.com"
                  value={field.input}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-invalid={!!field.errors?.[0]}
                  required
                />
                <Field of={form.composeForm} path={['showCcBcc']}>
                  {(ccField) => (
                    <>
                      {ccField.input
                        ? null
                        : (
                          <button
                            type="button"
                            onClick={() => ccField.onChange(true)}
                            className="shrink-0 text-xs text-primary hover:text-primary font-medium"
                          >
                            CC / BCC
                          </button>
                        )}
                    </>
                  )}
                </Field>
              </div>
              {field.errors?.[0] ? <FieldError>{field.errors[0]}</FieldError> : null}
            </div>
          </div>
        )}
      </Field>
      <Field of={form.composeForm} path={['showCcBcc']}>
        {(ccField) => (
          <>
            {ccField.input
              ? (
                <>
                  <AddressField
                    form={form}
                    path={['cc']}
                    id="compose-cc"
                    label="CC"
                    placeholder="Separate multiple addresses with commas"
                  />
                  <AddressField
                    form={form}
                    path={['bcc']}
                    id="compose-bcc"
                    label="BCC"
                    placeholder="Separate multiple addresses with commas"
                  />
                </>
              )
              : null}
          </>
        )}
      </Field>
    </>
  );
}

export default function ComposeForm({
  form,
  onClose,
  onDiscard,
  layout
}: {
  form: ReturnType<typeof useComposeForm>,
  onClose: () => void,
  onDiscard: () => void,
  layout: 'modal' | 'panel'
}) {
  const { composeForm, error, isSavingDraft, isSending, handleSaveDraft, sendFlow } = form;
  const actions = (
    <div className="flex items-center justify-between">
      <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSending}>
        Discard
      </Button>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isSavingDraft || isSending}
          onClick={handleSaveDraft}
        >
          {isSavingDraft
            ? (
              <Spinner data-icon="inline-start" />
            )
            : (
              <SaveIcon data-icon="inline-start" />
            )}
          {isSavingDraft ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={isSavingDraft || isSending}>
          {isSending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );

  const fields = (
    <>
      <RecipientFields form={form} />
      <AddressField
        form={form}
        path={['subject']}
        id="compose-subject"
        label="Subject"
        placeholder="Email subject"
      />
      <Field of={composeForm} path={['body']}>
        {(field) => <RichTextEditor value={field.input ?? ''} onChange={field.onChange} />}
      </Field>
    </>
  );

  return (
    <Form
      of={composeForm}
      onSubmit={(output) => sendFlow(output, onClose)}
      className={layout === 'panel' ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col gap-4'}
    >
      {layout === 'panel'
        ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <div className="flex flex-col gap-3">{fields}</div>
            </div>
            <div className="mt-auto px-4 py-3 border-t border-border bg-muted/30 shrink-0 md:px-6">
              {actions}
            </div>
          </>
        )
        : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            {fields}
            <div className="pt-2">{actions}</div>
          </>
        )}
    </Form>
  );
}
