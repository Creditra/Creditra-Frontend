import React, { useId } from 'react';
import './FormField.css';

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: 'text' | 'password' | 'email' | 'tel' | 'number';
  as?: 'input' | 'textarea';
  rows?: number;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  helpText?: string;
  formatText?: string;
  describedBy?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  maxLength?: number;
  className?: string;
  inputProps?: Record<string, any>;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  name,
  label,
  type = 'text',
  as = 'input',
  rows,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helpText,
  formatText,
  describedBy = '',
  required = false,
  disabled = false,
  autoComplete,
  maxLength,
  className = '',
  inputProps,
}) => {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const formatId = `${id}-format`;

  const effectiveValue = value ?? inputProps?.value ?? '';
  const effectivePlaceholder = placeholder ?? inputProps?.placeholder;
  const effectiveAutoComplete = autoComplete ?? inputProps?.autoComplete;
  const effectiveMaxLength = maxLength ?? inputProps?.maxLength;
  const effectiveDisabled = disabled || Boolean(inputProps?.disabled);
  const effectiveRequired = required || Boolean(inputProps?.required);
  const effectiveRows = rows ?? inputProps?.rows ?? 3;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
    if (inputProps?.onChange) {
      inputProps.onChange(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onBlur) {
      onBlur();
    }
    if (inputProps?.onBlur) {
      inputProps.onBlur(e);
    }
  };

  // Combine aria-describedby from props and computed IDs
  const getAriaDescribedBy = (): string => {
    const ids: string[] = [];

    // Add help text ID if helpText exists
    if (helpText) ids.push(helpId);
    // Add format text ID if formatText exists
    if (formatText) ids.push(formatId);
    // Add error ID if error exists
    if (error) ids.push(errorId);

    // Add any additional IDs from props
    if (describedBy) {
      const propIds = describedBy.split(' ');
      propIds.forEach((id) => {
        if (id && !ids.includes(id)) {
          ids.push(id);
        }
      });
    }

    return ids.length > 0 ? ids.join(' ') : undefined;
  };

  return (
    <div className={`form-field ${className} ${error ? 'form-field--error' : ''}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
        {effectiveRequired && <span className="form-field__required" aria-hidden="true">*</span>}
      </label>

      <div className="form-field__input-wrapper">
        {as === 'textarea' ? (
          <textarea
            id={id}
            name={name ?? id}
            value={effectiveValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={effectivePlaceholder}
            disabled={effectiveDisabled}
            required={effectiveRequired}
            autoComplete={effectiveAutoComplete}
            maxLength={effectiveMaxLength}
            rows={effectiveRows}
            className="form-field__input"
            aria-describedby={getAriaDescribedBy()}
            aria-invalid={!!error}
            aria-required={effectiveRequired}
          />
        ) : (
          <input
            id={id}
            name={name ?? id}
            type={type}
            value={effectiveValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={effectivePlaceholder}
            disabled={effectiveDisabled}
            required={effectiveRequired}
            autoComplete={effectiveAutoComplete}
            maxLength={effectiveMaxLength}
            className="form-field__input"
            aria-describedby={getAriaDescribedBy()}
            aria-invalid={!!error}
            aria-required={effectiveRequired}
          />
        )}
      </div>

      {/* Help text - always present but hidden from screen readers unless referenced */}
      {helpText && (
        <div id={helpId} className="form-field__help">
          {helpText}
        </div>
      )}

      {/* Format text - visible format hint */}
      {formatText && (
        <div id={formatId} className="form-field__format">
          {formatText}
        </div>
      )}

      {/* Error message - shown when error exists */}
      {error && (
        <div id={errorId} className="form-field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
