import { option } from '@moeru/results';
import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { splitByCase } from 'scule';
import { FolderBodySchema } from '../../shared/schemas';
import { apiError, json, noContent, withBody } from '../http';
import { deleteEmailFiles } from './context';
import type { RouteContext } from './context';

const NON_LETTER_OR_NUMBER = /[^\p{L}\p{N}]+/u;

function slugify(text: string) {
  return splitByCase(text)
    .flatMap((part) => part
      .trim()
      .toLowerCase()
      .split(NON_LETTER_OR_NUMBER)
      .filter(Boolean))
    .join('-');
}

export function registerFolderRoutes(app: App, { env, withMailbox }: RouteContext) {
  const folders = routing.get(
    withMailbox(async (_request, _params, mailbox) => json(await mailbox.listFolders()))
  );
  folders.post([
    withMailbox(async (request, _params, mailbox) => withBody(request, FolderBodySchema, async ({ name }) => {
      const id = slugify(name);
      if (!id) {
        return apiError(400, 'Folder name must contain alphanumeric characters');
      }
      return option.match(
        await mailbox.createFolder(id, name),
        (folder) => json(folder, 201),
        () => apiError(409, 'Folder with this name already exists')
      );
    }))
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/folders', folders);

  const folder = routing.put(
    withMailbox(async (request, params: { mailboxId: string, id: string }, mailbox) => withBody(request, FolderBodySchema, async ({ name }) => option.match(
      await mailbox.renameFolder(params.id, name),
      (value) => json(value),
      () => apiError(404, 'Folder not found')
    )))
  );
  folder.delete([
    withMailbox(async (_request, params, mailbox) => {
      const attachments = await mailbox.deleteFolder(params.id);
      if (attachments === false) {
        return apiError(400, 'Folder not found or cannot be deleted');
      }
      await deleteEmailFiles(env.BUCKET, attachments, '');
      return noContent();
    })
  ]);
  app.route('/api/v1/mailboxes/:mailboxId/folders/:id', folder);
}
