import Bar from '~/components/Bar';
import { m } from '~/paraglide/messages';

interface SubjectProps {
  subject: string,
  messageCount: number,
  showThreadCount: boolean
}

export default function Subject({
  subject,
  messageCount,
  showThreadCount
}: SubjectProps) {
  return (
    <Bar
      title={subject}
      titleClassName="text-base"
      sub={showThreadCount && (
        <span className="text-xs text-muted-foreground mt-0.5 block">
          {m.viewThreadCount({ n: messageCount })}
        </span>
      )}
    />
  );
}
