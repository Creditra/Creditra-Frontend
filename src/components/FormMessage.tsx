import type { CSSProperties, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FormMessageProps {
  id?: string;
  title?: ReactNode;
  message?: ReactNode;
  tone?: "inline" | "alert";
  reserveSpace?: boolean;
  minHeight?: number;
  style?: CSSProperties;
  className?: string;
}

export function FormMessage({
  id,
  title,
  message,
  tone = "inline",
  reserveSpace = false,
  minHeight,
  style,
  className = "",
}: FormMessageProps) {
  const hasContent = Boolean(title) || Boolean(message);

  if (!hasContent && !reserveSpace) {
    return null;
  }

  const slotClassName = [
    "form-message-slot",
    tone === "alert" ? "form-message-slot--alert" : "form-message-slot--inline",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={slotClassName}
      style={{
        minHeight: reserveSpace
          ? minHeight ?? (tone === "alert" ? 88 : 52)
          : undefined,
        ...style,
      }}
    >
      {hasContent ? (
        <div
          id={id}
          role="alert"
          aria-live="assertive"
          className={`form-message form-message--error form-message--${tone}`}
        >
          <AlertCircle className="form-message__icon" aria-hidden="true" />
          <div className="form-message__content">
            {title ? <strong className="form-message__title">{title}</strong> : null}
            {message ? <p className="form-message__text">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
