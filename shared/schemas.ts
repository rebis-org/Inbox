import * as v from 'valibot';

const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_LENGTH = 5_000_000;
const MAX_ADDRESS_LIST_LENGTH = 2000;
const MAX_RECIPIENTS = 50;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_CONTENT_LENGTH = 20_000_000;
const MAX_FILENAME_LENGTH = 255;
const MAX_HEADER_ID_LENGTH = 998;

export const emailSchema = v.pipe(v.string(), v.email());

const RecipientFieldSchema = v.union([
  emailSchema,
  v.pipe(v.array(emailSchema), v.minLength(1), v.maxLength(MAX_RECIPIENTS))
]);

export const SendEmailRequestSchema = v.pipe(
  v.object({
    to: RecipientFieldSchema,
    cc: v.optional(RecipientFieldSchema),
    bcc: v.optional(RecipientFieldSchema),
    from: v.union([emailSchema, v.object({ email: emailSchema, name: v.string() })]),
    subject: v.pipe(v.string(), v.maxLength(MAX_SUBJECT_LENGTH)),
    html: v.optional(v.pipe(v.string(), v.maxLength(MAX_BODY_LENGTH))),
    text: v.optional(v.pipe(v.string(), v.maxLength(MAX_BODY_LENGTH))),
    attachments: v.optional(
      v.pipe(
        v.array(
          v.object({
            content: v.pipe(v.string(), v.maxLength(MAX_ATTACHMENT_CONTENT_LENGTH)),
            filename: v.pipe(v.string(), v.maxLength(MAX_FILENAME_LENGTH)),
            type: v.pipe(v.string(), v.maxLength(MAX_FILENAME_LENGTH)),
            disposition: v.picklist(['attachment', 'inline']),
            contentId: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH)))
          })
        ),
        v.maxLength(MAX_ATTACHMENTS)
      )
    ),
    in_reply_to: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH))),
    references: v.optional(
      v.pipe(
        v.array(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH))),
        v.maxLength(MAX_RECIPIENTS)
      )
    ),
    thread_id: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH)))
  }),
  v.check((data) => Boolean(data.html || data.text), 'Either \'html\' or \'text\' must be provided')
);

export const SendEmailResponseSchema = v.object({
  id: v.string(),
  status: v.string()
});

export const ErrorResponseSchema = v.object({
  error: v.string()
});

export const CreateMailboxBodySchema = v.object({
  email: emailSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_FILENAME_LENGTH)),
  settings: v.optional(v.record(v.string(), v.unknown()))
});

export const UpdateMailboxBodySchema = v.object({
  settings: v.record(v.string(), v.unknown())
});

export const UpdateEmailBodySchema = v.object({
  read: v.optional(v.boolean()),
  starred: v.optional(v.boolean())
});

export const MoveEmailBodySchema = v.object({
  folderId: v.pipe(v.string(), v.maxLength(MAX_FILENAME_LENGTH))
});

export const FolderBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_FILENAME_LENGTH))
});

export const DraftBodySchema = v.object({
  to: v.optional(v.pipe(v.string(), v.maxLength(MAX_ADDRESS_LIST_LENGTH))),
  cc: v.optional(v.pipe(v.string(), v.maxLength(MAX_ADDRESS_LIST_LENGTH))),
  bcc: v.optional(v.pipe(v.string(), v.maxLength(MAX_ADDRESS_LIST_LENGTH))),
  subject: v.optional(v.pipe(v.string(), v.maxLength(MAX_SUBJECT_LENGTH))),
  body: v.pipe(v.string(), v.maxLength(MAX_BODY_LENGTH)),
  in_reply_to: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH))),
  thread_id: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH))),
  draft_id: v.optional(v.pipe(v.string(), v.maxLength(MAX_HEADER_ID_LENGTH)))
});

export const ResendWebhookPayloadSchema = v.object({
  type: v.string(),
  data: v.optional(v.object({ email_id: v.optional(v.string()) }))
});

export type SendEmailRequest = v.InferOutput<typeof SendEmailRequestSchema>;
export type SendEmailResponse = v.InferOutput<typeof SendEmailResponseSchema>;
export type CreateMailboxBody = v.InferOutput<typeof CreateMailboxBodySchema>;
export type DraftBody = v.InferOutput<typeof DraftBodySchema>;
export type ResendWebhookPayload = v.InferOutput<typeof ResendWebhookPayloadSchema>;
