import { Field, Form } from '@formisch/react';
import { SaveIcon, SendIcon } from 'lucide-react';
import { Alert, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import Scroll from '~/components/Scroll';
import type { useComposeForm } from '~/hooks/composer';
import { m } from '~/paraglide/messages';
import Editor from './Editor';

const labelClassName = 'w-14 shrink-0 text-muted-foreground mt-2';

function AddressField({
  form,
  path,
  id,
  label,
  placeholder,
  required,
  action
}: {
  form: ReturnType<typeof useComposeForm>,
  path: ['to'] | ['cc'] | ['bcc'] | ['subject'],
  id: string,
  label: string,
  placeholder: string,
  required?: boolean,
  action?: React.ReactNode
}) {
  return (
    <Field of={form.composeForm} path={path}>
      {(field) => (
        <div className="flex items-start gap-2">
          <FieldLabel htmlFor={id} className={labelClassName}>
            {label}
          </FieldLabel>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Input
                id={id}
                type="text"
                placeholder={placeholder}
                value={field.input}
                onChange={(e) => field.onChange(e.target.value)}
                aria-invalid={!!field.errors?.[0]}
                required={required ?? path[0] === 'to'}
                autoFocus={path[0] === 'to'}
              />
              {action}
            </div>
            {field.errors?.[0] ? <FieldError>{field.errors[0]}</FieldError> : null}
          </div>
        </div>
      )}
    </Field>
  );
}

function CcBccToggle({ form }: { form: ReturnType<typeof useComposeForm> }) {
  return (
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
  );
}

function RecipientFields({ form }: { form: ReturnType<typeof useComposeForm> }) {
  return (
    <>
      <AddressField
        form={form}
        path={['to']}
        id="compose-to"
        label={m.composeTo()}
        placeholder={m.composeToPlaceholder()}
        required
        action={<CcBccToggle form={form} />}
      />
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
                    label={m.composeCc()}
                    placeholder={m.composeCcBccPlaceholder()}
                  />
                  <AddressField
                    form={form}
                    path={['bcc']}
                    id="compose-bcc"
                    label={m.composeBcc()}
                    placeholder={m.composeCcBccPlaceholder()}
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

export default function Compose({
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
        {m.composeDiscard()}
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
          {isSavingDraft ? m.composeSaving() : m.composeSaveDraft()}
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={isSavingDraft || isSending}>
          {isSending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {isSending ? m.composeSending() : m.composeSend()}
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
        label={m.composeSubject()}
        placeholder={m.composeSubjectPlaceholder()}
      />
      <Field of={composeForm} path={['body']}>
        {(field) => <Editor value={field.input ?? ''} onChange={field.onChange} />}
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
            <Scroll className="min-h-0 p-4 md:p-6 flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <div className="flex flex-col gap-3">{fields}</div>
            </Scroll>
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
