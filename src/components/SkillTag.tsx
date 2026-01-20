type SkillTagProps = {
  label: string;
  variant?: "default" | "missing";
};

export default function SkillTag({ label, variant = "default" }: SkillTagProps) {
  const base = "rounded-full px-3 py-1 text-sm";
  const style =
    variant === "missing"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-900";

  return <span className={`${base} ${style}`}>{label}</span>;
}