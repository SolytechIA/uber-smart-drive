import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showIcon = true, size = "md" }: LogoProps) {
  const textSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const iconSize = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={cn("flex items-center gap-2 font-display font-bold", className)}>
      {showIcon && (
        <div className="rounded-lg gradient-bg p-1.5 shadow-glow">
          <Car className={cn("text-primary-foreground", iconSize)} strokeWidth={2.5} />
        </div>
      )}
      <span className={cn("gradient-text leading-none", textSize)}>Drive IA</span>
    </div>
  );
}
