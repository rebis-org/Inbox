import { emailSchema } from 'shared/schemas';
import * as v from 'valibot';
import type { MailboxSettings } from '~/types';

function emailList(message: string) {
  return v.check((value: string) => {
    const parts = value.split(',');
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      if (!v.is(emailSchema, part)) return false;
    }
    return true;
  }, message);
}

export const ComposeFormSchema = v.object({
  to: v.pipe(
    v.string(),
    v.nonEmpty('Add at least one recipient.'),
    emailList('Invalid email address.')
  ),
  cc: v.pipe(v.string(), emailList('Invalid email address.')),
  bcc: v.pipe(v.string(), emailList('Invalid email address.')),
  subject: v.pipe(v.string(), v.nonEmpty('Please enter a subject.')),
  body: v.string(),
  showCcBcc: v.boolean()
});

export type ComposeFormValues = v.InferOutput<typeof ComposeFormSchema>;

export const EMPTY_COMPOSE_INPUT: ComposeFormValues = {
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
  showCcBcc: false
};

export const SettingsFormSchema = v.object({
  fromName: v.string(),
  forwardingEnabled: v.boolean(),
  forwardingEmail: v.pipe(
    v.string(),
    v.check(
      (value) => value.trim() === '' || v.is(emailSchema, value.trim()),
      'Invalid forwarding email address.'
    )
  ),
  signatureEnabled: v.boolean(),
  signatureText: v.string(),
  signatureHtml: v.string(),
  autoReplyEnabled: v.boolean(),
  autoReplySubject: v.string(),
  autoReplyMessage: v.string()
});

export type SettingsFormValues = v.InferOutput<typeof SettingsFormSchema>;

export const EMPTY_SETTINGS_INPUT: SettingsFormValues = {
  fromName: '',
  forwardingEnabled: false,
  forwardingEmail: '',
  signatureEnabled: false,
  signatureText: '',
  signatureHtml: '',
  autoReplyEnabled: false,
  autoReplySubject: '',
  autoReplyMessage: ''
};

export function settingsToFormInput(
  settings: MailboxSettings | undefined,
  fallbackName: string
): SettingsFormValues {
  return {
    fromName: settings?.fromName || fallbackName,
    forwardingEnabled: settings?.forwarding?.enabled ?? false,
    forwardingEmail: settings?.forwarding?.email ?? '',
    signatureEnabled: settings?.signature?.enabled ?? false,
    signatureText: settings?.signature?.text ?? '',
    signatureHtml: settings?.signature?.html ?? '',
    autoReplyEnabled: settings?.autoReply?.enabled ?? false,
    autoReplySubject: settings?.autoReply?.subject ?? '',
    autoReplyMessage: settings?.autoReply?.message ?? ''
  };
}

export function formInputToSettings(values: SettingsFormValues): MailboxSettings {
  return {
    fromName: values.fromName,
    forwarding: {
      enabled: values.forwardingEnabled,
      email: values.forwardingEmail.trim()
    },
    signature: {
      enabled: values.signatureEnabled,
      text: values.signatureText,
      html: values.signatureHtml
    },
    autoReply: {
      enabled: values.autoReplyEnabled,
      subject: values.autoReplySubject,
      message: values.autoReplyMessage
    }
  };
}
