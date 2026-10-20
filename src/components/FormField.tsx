import React, { useId } from 'react';
import './FormField.css';

interface FormFieldProps {
  id: string;
  name: string;
  label: string;
  type?: 'text' | 'password' | 'email' | 'tel' | 'number';
  value: string;
  onChange: (value: string) => void;
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
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  name,
  label,
  type = 'text',
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
}) => {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const formatId = `${id}-format`;

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
        {required && <span className="form-field__required" aria-hidden="true">*</span>}
      </label>

      <div className="form-field__input-wrapper">
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className="form-field__input"
          aria-describedby={getAriaDescribedBy()}
          aria-invalid={!!error}
          aria-required={required}
        />
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
