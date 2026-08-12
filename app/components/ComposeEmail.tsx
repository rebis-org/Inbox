import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { useComposeForm } from '~/hooks/useComposeForm';
import { useUIStore } from '~/hooks/useUIStore';
import ComposeForm from './ComposeForm';

export default function ComposeEmail() {
  const { isComposeModalOpen, closeComposeModal } = useUIStore();
  const compose = useComposeForm();

  return (
    <Dialog
      open={isComposeModalOpen}
      onOpenChange={(open) => !open && !compose.isSending && closeComposeModal()}
    >
      <DialogContent className="p-6 max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-lg font-semibold mb-5">{compose.formTitle}</DialogTitle>
        <ComposeForm
          form={compose}
          onClose={closeComposeModal}
          onDiscard={closeComposeModal}
          layout="modal"
        />
      </DialogContent>
    </Dialog>
  );
}
