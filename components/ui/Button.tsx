import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant,
  compact,
  className = "",
  type = "button",
  ...props
}: { variant: "primary" | "secondary" | "quiet"; compact?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`ci-btn ci-btn-${variant}${compact ? " ci-btn-compact" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
