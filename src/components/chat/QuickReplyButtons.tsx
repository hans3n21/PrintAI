import { Button } from "@/components/ui/button";

interface QuickReplyButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export function QuickReplyButtons({
  options,
  onSelect,
  disabled,
}: QuickReplyButtonsProps) {
  if (!options.length) return null;

  return (
    <div className="flex flex-wrap gap-2 pl-2">
      {options.map((option) => (
        <Button
          key={option}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="rounded-full border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
