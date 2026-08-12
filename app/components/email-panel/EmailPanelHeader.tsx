interface EmailPanelHeaderProps {
  subject: string,
  messageCount: number,
  showThreadCount: boolean
}

export default function EmailPanelHeader({
  subject,
  messageCount,
  showThreadCount
}: EmailPanelHeaderProps) {
  return (
    <div className="flex items-center px-4 min-h-14 border-b border-border shrink-0 md:px-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{subject}</h2>
        {showThreadCount && (
          <span className="text-xs text-muted-foreground mt-0.5 block">
            {messageCount} messages in this thread
          </span>
        )}
      </div>
    </div>
  );
}
