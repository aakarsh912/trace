type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="text-[var(--fg-tertiary)] mb-4 [&>svg]:w-10 [&>svg]:h-10">
          {icon}
        </div>
      )}
      <p className="font-medium text-[var(--fg)]">{title}</p>
      {description && (
        <p className="text-sm text-[var(--fg-secondary)] mt-1">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-[var(--fg)] text-white text-sm rounded hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
