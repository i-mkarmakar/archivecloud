interface Props {
  title: string;
}

const MagicBadge = ({ title }: Props) => {
  return (
    <div className="relative inline-flex h-8 overflow-hidden rounded-full p-[1.5px] focus:outline-none select-none">
      <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--primary)_0%,var(--accent)_50%,var(--primary)_100%)]" />
      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full border border-border bg-white px-4 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm">
        {title}
      </span>
    </div>
  );
};

export default MagicBadge;
