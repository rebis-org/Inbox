import { getInput, reset, useForm } from '@formisch/react';
import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '~/components/ui/toast';
import { useUIStore } from '~/hooks/useUIStore';
import { buildEmailPayload } from '~/lib/emails';
import { ComposeFormSchema, EMPTY_COMPOSE_INPUT } from '~/lib/form-schemas';
import type { ComposeFormValues } from '~/lib/form-schemas';
import { buildQuotedReplyBlock, escapeHtml, getSignatureBlock, stripHtml } from '~/lib/html';
import { splitEmailList } from '~/lib/utils';
import { formatQuotedDate } from 'shared/dates';
import {
  useDeleteEmail,
  useForwardEmail,
  useReplyToEmail,
  useSaveDraft,
  useSendEmail
} from '~/queries/emails';
import { useMailbox } from '~/queries/mailboxes';

function appendUniqueAddress(
  addresses: string[],
  seen: Set<string>,
  address: string,
  exclude?: string
) {
  const trimmed = address.trim();
  if (!trimmed) return;
  const normalized = trimmed.toLowerCase();
  if (normalized === exclude || seen.has(normalized)) return;
  seen.add(normalized);
  addresses.push(trimmed);
}

function prefixedSubject(subject: string, prefix: 'Re' | 'Fwd') {
  return subject.startsWith(`${prefix}: `) ? subject : `${prefix}: ${subject}`;
}

function buildForwardBody(
  original: NonNullable<ReturnType<typeof useUIStore.getState>['composeOptions']['originalEmail']>,
  sigBlock: string
) {
  const safeBody = escapeHtml(stripHtml(original.body || '')).replaceAll('\n', '<br>');
  return `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ''}<div style="border: 1px solid #ddd; padding: 1em; background-color: #f9f9f9; margin: 1em 0;"><strong>Forwarded message:</strong><br><strong>From:</strong> ${escapeHtml(original.sender)}<br><strong>Date:</strong> ${formatQuotedDate(original.date)}<br><strong>Subject:</strong> ${escapeHtml(original.subject)}<br><br>${safeBody}</div>`;
}

function buildReplyAllFields(
  original: NonNullable<ReturnType<typeof useUIStore.getState>['composeOptions']['originalEmail']>,
  selfAddress?: string
) {
  const toRecipients: string[] = [];
  const toSeen = new Set<string>();
  appendUniqueAddress(toRecipients, toSeen, original.sender, selfAddress);
  const toRecipientsList = splitEmailList(original.recipient);
  for (let i = 0, len = toRecipientsList.length; i < len; i++) {
    const recipient = toRecipientsList[i];
    appendUniqueAddress(toRecipients, toSeen, recipient, selfAddress);
  }
  const ccRecipients: string[] = [];
  const ccSeen = new Set<string>();
  const ccRecipientsList = splitEmailList(original.cc);
  for (let i = 0, len = ccRecipientsList.length; i < len; i++) {
    const recipient = ccRecipientsList[i];
    const normalized = recipient.toLowerCase();
    if (normalized === selfAddress || toSeen.has(normalized) || ccSeen.has(normalized)) {
      continue;
    }
    ccSeen.add(normalized);
    ccRecipients.push(recipient);
  }
  return {
    to: toRecipients.join(', '),
    cc: ccRecipients.join(', '),
    showCcBcc: ccRecipients.length > 0
  };
}

function buildInitialComposeFields(
  composeOptions: ReturnType<typeof useUIStore.getState>['composeOptions'],
  mailboxEmail: string | undefined,
  sigBlock: string
): ComposeFormValues {
  const { draftEmail: draft, originalEmail: original, mode } = composeOptions;

  if (draft) {
    return {
      to: draft.recipient || '',
      cc: draft.cc || '',
      bcc: draft.bcc || '',
      showCcBcc: Boolean(draft.cc || draft.bcc),
      subject: draft.subject || '',
      body: draft.body || ''
    };
  }
  if (!original) {
    return {
      ...EMPTY_COMPOSE_INPUT,
      body: sigBlock ? `<p><br></p>${sigBlock}` : ''
    };
  }
  if (mode === 'reply' || mode === 'reply-all') {
    const recipients =
      mode === 'reply-all'
        ? buildReplyAllFields(original, mailboxEmail?.toLowerCase())
        : { to: original.sender, cc: '', showCcBcc: false };
    return {
      ...EMPTY_COMPOSE_INPUT,
      ...recipients,
      subject: prefixedSubject(original.subject, 'Re'),
      body: `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ''}${buildQuotedReplyBlock(original.date, original.sender, original.body || '')}`
    };
  }
  if (mode === 'forward') {
    return {
      ...EMPTY_COMPOSE_INPUT,
      subject: prefixedSubject(original.subject, 'Fwd'),
      body: buildForwardBody(original, sigBlock)
    };
  }
  return {
    ...EMPTY_COMPOSE_INPUT,
    body: sigBlock ? `<p><br></p>${sigBlock}` : ''
  };
}

export function useComposeForm() {
  const { mailboxId } = useParams({ strict: false });
  const { composeOptions, closePanel, closeCompose } = useUIStore();
  const { data: currentMailbox } = useMailbox(mailboxId);
  const sendEmailMutation = useSendEmail();
  const saveDraftMutation = useSaveDraft();
  const replyMutation = useReplyToEmail();
  const forwardMutation = useForwardEmail();
  const deleteEmailMutation = useDeleteEmail();

  const [error, setError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const lastInitializedOptionsRef = useRef<typeof composeOptions | null>(null);
  const isDraftEdit = !!composeOptions.draftEmail;

  const composeForm = useForm<typeof ComposeFormSchema>({
    schema: ComposeFormSchema,
    initialInput: EMPTY_COMPOSE_INPUT,
    validate: 'submit'
  });

  const formTitle = useMemo(() => {
    if (isDraftEdit) return 'Edit Draft';
    switch (composeOptions.mode) {
      case 'reply':
        return 'Reply';
      case 'reply-all':
        return 'Reply All';
      case 'forward':
        return 'Forward';
      default:
        return 'New Message';
    }
  }, [composeOptions.mode, isDraftEdit]);

  useEffect(() => {
    if (lastInitializedOptionsRef.current === composeOptions) return;
    lastInitializedOptionsRef.current = composeOptions;
    reset(composeForm, {
      initialInput: buildInitialComposeFields(
        composeOptions,
        currentMailbox?.email,
        getSignatureBlock(currentMailbox?.settings)
      )
    });
  }, [composeOptions, currentMailbox?.email, currentMailbox?.settings, composeForm]);

  const handleSaveDraft = async () => {
    if (!mailboxId || composeForm.isSubmitting) return;
    setIsSavingDraft(true);
    setError(null);
    const { to, cc, bcc, subject, body } = getInput(composeForm) as ComposeFormValues;
    try {
      await saveDraftMutation.mutateAsync({
        mailboxId,
        draft: {
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          body,
          in_reply_to:
            composeOptions.originalEmail?.id || composeOptions.draftEmail?.in_reply_to || undefined,
          thread_id:
            composeOptions.originalEmail?.thread_id
            || composeOptions.draftEmail?.thread_id
            || undefined,
          draft_id: composeOptions.draftEmail?.id || undefined
        }
      });
      toast.add({ title: 'Draft saved!' });
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : null) || 'Failed to save draft.';
      setError(message);
      toast.add({ title: message, type: 'error' });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const sendFlow = async (values: ComposeFormValues, onClose: () => void) => {
    if (!currentMailbox || !mailboxId) {
      setError('No mailbox selected.');
      return;
    }
    if (splitEmailList(values.to).length === 0) {
      setError('Add at least one recipient.');
      return;
    }
    const emailData = buildEmailPayload(currentMailbox, values);
    const draftId = composeOptions.draftEmail?.id;
    const mode = composeOptions.mode;
    const originalId = composeOptions.originalEmail?.id || composeOptions.draftEmail?.in_reply_to;
    toast.add({ title: 'Sending email...' });
    try {
      if (originalId && (mode === 'reply' || mode === 'reply-all')) {
        await replyMutation.mutateAsync({
          mailboxId,
          emailId: originalId,
          email: emailData
        });
      } else if (mode === 'forward' && originalId) {
        await forwardMutation.mutateAsync({
          mailboxId,
          emailId: originalId,
          email: emailData
        });
      } else await sendEmailMutation.mutateAsync({ mailboxId, email: emailData });
      if (draftId) deleteEmailMutation.mutate({ mailboxId, id: draftId });
      toast.add({ title: 'Email sent!' });
      onClose();
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : null) || 'Failed to send email.';
      setError(message);
      toast.add({ title: message, type: 'error' });
    }
  };

  return {
    composeForm,
    formTitle,
    error,
    isSavingDraft,
    isSending: composeForm.isSubmitting,
    isDraftEdit,
    handleSaveDraft,
    sendFlow,
    closeCompose,
    closePanel
  };
}
