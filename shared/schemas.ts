import * as v from 'valibot';

export const emailSchema = v.pipe(v.string(), v.email());

const RecipientFieldSchema = v.union([emailSchema, v.pipe(v.array(emailSchema), v.minLength(1))]);

export const SendEmailRequestSchema = v.pipe(
  v.object({
    to: RecipientFieldSchema,
    cc: v.optional(RecipientFieldSchema),
    bcc: v.optional(RecipientFieldSchema),
    from: v.union([emailSchema, v.object({ email: emailSchema, name: v.string() })]),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          content: v.string(),
          filename: v.string(),
          type: v.string(),
          disposition: v.picklist(['attachment', 'inline']),
          contentId: v.optional(v.string())
        })
      )
    ),
    in_reply_to: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    thread_id: v.optional(v.string())
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
  name: v.pipe(v.string(), v.minLength(1)),
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
  folderId: v.string()
});

export const FolderBodySchema = v.object({
  name: v.string()
});

export const DraftBodySchema = v.object({
  to: v.optional(v.string()),
  cc: v.optional(v.string()),
  bcc: v.optional(v.string()),
  subject: v.optional(v.string()),
  body: v.string(),
  in_reply_to: v.optional(v.string()),
  thread_id: v.optional(v.string()),
  draft_id: v.optional(v.string())
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
