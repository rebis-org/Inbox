import { getInput, reset, useForm } from '@formisch/react';
import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '~/components/ui/toast';
import { useUIStore } from '~/hooks/store';
import { buildEmailPayload } from '~/lib/emails';
import { composeSchema, EMPTY_COMPOSE_INPUT } from '~/lib/forms';
import type { ComposeFormValues } from '~/lib/forms';
import { buildQuotedReplyBlock, escapeHtml, getSignatureBlock, stripHtml } from '~/lib/html';
import { splitEmailList } from '~/lib/utils';
import { m } from '~/paraglide/messages';
import { formatQuotedDate } from 'shared/dates';
import {
  useDeleteEmail,
  useForwardEmail,
  useReplyToEmail,
  useSaveDraft,
  useSendEmail
} from '~/queries/emails';
import { useMailbox } from '~/queries/mailboxes';

function prefixedSubject(subject: string, prefix: 'Re' | 'Fwd') {
  return subject.startsWith(`${prefix}: `) ? subject : `${prefix}: ${subject}`;
}

function buildForwardBody(
  original: NonNullable<ReturnType<typeof useUIStore.getState>['composeOptions']['originalEmail']>,
  sigBlock: string
) {
  const safeBody = escapeHtml(stripHtml(original.body || '')).replaceAll('\n', '<br>');
  return `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ''}<div style="border: 1px solid #ddd; padding: 1em; background-color: #f9f9f9; margin: 1em 0;"><strong>${escapeHtml(m.composeForwarded())}</strong><br><strong>${escapeHtml(m.composeFrom())}</strong> ${escapeHtml(original.sender)}<br><strong>${escapeHtml(m.composeDate())}</strong> ${formatQuotedDate(original.date)}<br><strong>${escapeHtml(m.composeSubjectLabel())}</strong> ${escapeHtml(original.subject)}<br><br>${safeBody}</div>`;
}

function buildReplyAllFields(
  original: NonNullable<ReturnType<typeof useUIStore.getState>['composeOptions']['originalEmail']>,
  selfAddress?: string
) {
  const toSeen = new Set<string>();
  const toRecipients = [original.sender, ...splitEmailList(original.recipient)].reduce<string[]>(
    (acc, address) => {
      const trimmed = address.trim();
      const normalized = trimmed.toLowerCase();
      if (trimmed && normalized !== selfAddress && !toSeen.has(normalized)) {
        toSeen.add(normalized);
        acc.push(trimmed);
      }
      return acc;
    },
    []
  );
  const ccSeen = new Set<string>();
  const ccRecipients = splitEmailList(original.cc).reduce<string[]>((acc, recipient) => {
    const normalized = recipient.toLowerCase();
    if (normalized === selfAddress || toSeen.has(normalized) || ccSeen.has(normalized)) {
      return acc;
    }
    ccSeen.add(normalized);
    acc.push(recipient);
    return acc;
  }, []);
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
      body: `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ''}${buildQuotedReplyBlock(original.date, original.sender, original.body || '', m.composeWrote({ date: formatQuotedDate(original.date), sender: escapeHtml(original.sender) }))}`
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
  const { composeOptions, closePanel, closeCompose, locale } = useUIStore();
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

  const schema = useMemo(() => composeSchema({
    recipientRequired: m.formRecipientRequired({}, { locale }),
    invalidEmail: m.formInvalidEmail({}, { locale }),
    subjectRequired: m.formSubjectRequired({}, { locale }),
    invalidForward: m.formInvalidForward({}, { locale })
  }), [locale]);
  const composeForm = useForm<ReturnType<typeof composeSchema>>({
    schema,
    initialInput: EMPTY_COMPOSE_INPUT,
    validate: 'submit'
  });

  const formTitle = useMemo(() => {
    if (isDraftEdit) return m.composeEditDraft({}, { locale });
    switch (composeOptions.mode) {
      case 'reply':
        return m.composeReply({}, { locale });
      case 'reply-all':
        return m.composeReplyAll({}, { locale });
      case 'forward':
        return m.composeForward({}, { locale });
      default:
        return m.composeNew({}, { locale });
    }
  }, [composeOptions.mode, isDraftEdit, locale]);

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
  }, [composeOptions, currentMailbox?.email, currentMailbox?.settings, composeForm, locale]);

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
      toast.add({ title: m.composeDraftSaved() });
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : null) || m.composeDraftFailed();
      setError(message);
      toast.add({ title: message, type: 'error' });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const sendFlow = async (values: ComposeFormValues, onClose: () => void) => {
    if (!currentMailbox || !mailboxId) {
      setError(m.composeNoMailbox());
      return;
    }
    if (splitEmailList(values.to).length === 0) {
      setError(m.composeNoRecipient());
      return;
    }
    const draft = composeOptions.draftEmail;
    const emailData = buildEmailPayload(currentMailbox, {
      ...values,
      in_reply_to: draft?.in_reply_to ?? undefined,
      thread_id: draft?.thread_id ?? undefined
    });
    const draftId = draft?.id;
    const mode = composeOptions.mode;
    const originalId = composeOptions.originalEmail?.id || composeOptions.draftEmail?.in_reply_to;
    toast.add({ title: m.composeSendingToast() });
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
      toast.add({ title: m.composeSentToast() });
      onClose();
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : null) || m.composeFailed();
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
