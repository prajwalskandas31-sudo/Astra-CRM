import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient" | "outline" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer text-sm";

    const variants = {
      default:
        "bg-white text-black hover:bg-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.2)] active:scale-[0.98]",
      secondary:
        "bg-neutral-800 text-neutral-100 hover:bg-neutral-700/80 border border-neutral-700/60 active:scale-[0.98]",
      ghost:
        "hover:bg-white/10 text-neutral-300 hover:text-white",
      gradient:
        "bg-gradient-to-b from-white via-white/95 to-white/70 text-black hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_20px_rgba(255,255,255,0.25)]",
      outline:
        "border border-white/15 bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white active:scale-[0.98]",
      danger:
        "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 active:scale-[0.98]"
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 px-3 text-xs font-medium",
      lg: "h-11 px-6 text-base font-semibold",
      icon: "h-9 w-9 p-0"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export default Button;
