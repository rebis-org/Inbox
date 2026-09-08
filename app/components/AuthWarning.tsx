import { TriangleAlertIcon } from 'lucide-react';
import { m } from '~/paraglide/messages';

export default function AuthWarning() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
      <TriangleAlertIcon size={14} className="mt-0.5 shrink-0" />
      <span>{m.emailAuthWarning()}</span>
    </div>
  );
}
