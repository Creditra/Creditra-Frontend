import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface FormMessageProps {
  id?: string;
  title?: ReactNode;
  message?: ReactNode;
  tone?: "inline" | "alert";
  type?: "success" | "danger" | "warning" | "info" | "error";
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
  type = "danger",
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
          className={`form-message form-message--${type === 'error' ? 'danger' : type} form-message--${tone}`}
        >
          {type === 'success' && <CheckCircle className="form-message__icon" aria-hidden="true" />}
          {(type === 'danger' || type === 'error') && <AlertCircle className="form-message__icon" aria-hidden="true" />}
          {type === 'warning' && <AlertTriangle className="form-message__icon" aria-hidden="true" />}
          {type === 'info' && <Info className="form-message__icon" aria-hidden="true" />}
          <div className="form-message__content">
            {title ? <strong className="form-message__title">{title}</strong> : null}
            {message ? <p className="form-message__text">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
