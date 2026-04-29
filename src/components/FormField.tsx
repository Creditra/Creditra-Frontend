import { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

interface BaseFormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  className?: string;
}

interface InputFormFieldProps extends BaseFormFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'aria-describedby' | 'aria-invalid' | 'required'>;
  as?: 'input';
}

interface TextareaFormFieldProps extends BaseFormFieldProps {
  as: 'textarea';
  inputProps?: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'aria-describedby' | 'aria-invalid' | 'required'>;
}

interface CustomFormFieldProps extends BaseFormFieldProps {
  as: 'custom';
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid': boolean;
    'aria-required': boolean;
  }) => ReactNode;
}

type FormFieldProps = InputFormFieldProps | TextareaFormFieldProps | CustomFormFieldProps;

/**
 * FormField — standardized form field component with accessibility built-in.
 *
 * Features:
 * - Programmatic label association via htmlFor/id
 * - Required indicator with screen reader announcement
 * - Help text linked via aria-describedby
 * - Error messaging with aria-invalid and aria-describedby
 * - Consistent spacing and color tokens
 * - Focus management with visible focus rings
 *
 * Usage:
 * <FormField
 *   id="email"
 *   label="Email Address"
 *   type="email"
 *   required
 *   helpText="We'll never share your email"
 *   error={errors.email}
 *   inputProps={{ value, onChange, placeholder: "you@example.com" }}
 * />
 */
export function FormField(props: FormFieldProps) {
  const { id, label, required = false, helpText, error, className = '' } = props;

  const helpTextId = `${id}-help`;
  const errorId = `${id}-error`;
  
  const describedByParts: string[] = [];
  if (helpText) describedByParts.push(helpTextId);
  if (error) describedByParts.push(errorId);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : '';

  const sharedInputProps = {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': !!error,
    'aria-required': required,
  };

  return (
    <div className={`form-field ${className}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && (
          <span className="form-field__required" aria-label="required">
            *
          </span>
        )}
      </label>

      {helpText && (
        <p id={helpTextId} className="form-field__help">
          {helpText}
        </p>
      )}

      {props.as === 'textarea' ? (
        <textarea
          {...sharedInputProps}
          {...props.inputProps}
          className={`form-field__input form-field__textarea ${error ? 'form-field__input--error' : ''}`}
        />
      ) : props.as === 'custom' ? (
        props.children(sharedInputProps)
      ) : (
        <input
          type={props.type || 'text'}
          {...sharedInputProps}
          {...props.inputProps}
          className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
        />
      )}

      {error && (
        <div id={errorId} className="form-field__error" role="alert" aria-live="polite">
          <AlertCircle className="form-field__error-icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
