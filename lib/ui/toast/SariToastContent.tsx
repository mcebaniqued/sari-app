type SariToastContentProps = {
  title: string;
  description?: string;
};

export default function SariToastContent({ title, description }: SariToastContentProps) {
  return (
    <div className="w-full leading-tight space-y-0.5">
      <div className="font-semibold text-sm">{title}</div>
      {description && <div className="text-sm text-[rgb(var(--muted-foreground))] truncate overflow-hidden whitespace-nowrap">{description}</div>}
    </div>
  )
};
