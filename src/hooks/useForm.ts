import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

/**
 * Small, dependency-free form primitive.
 *
 * The hook owns values, errors and touched state for a flat form, runs
 * declarative validators, focuses the first invalid field and clears a
 * field's error as soon as the user edits it. It deliberately does not
 * render anything: callers wire the returned props into `FormField` (via
 * `register`) or native inputs (via `register(...).inputProps`).
 */

export type FormValues = Record<string, unknown>;

export type FormErrors<TValues extends FormValues> = Partial<
  Record<keyof TValues, string>
>;

/** A validator returns an error message, or a falsy value when valid. */
export type Validator<TValue = unknown, TValues extends FormValues = FormValues> = (
  value: TValue,
  values: TValues,
) => string | undefined | null | false;

export interface RegisterOptions {
  /** DOM id for the control. Defaults to the field name. */
  id?: string;
  /** Extra `aria-describedby` ids to merge with the error id. */
  describedBy?: string;
  /** Treat the value as a list of values (e.g. checkbox groups). */
  type?: 'text' | 'checkbox' | 'radio';
}

export interface RegisteredField<TValue> {
  id: string;
  name: string;
  value: TValue;
  error: string | undefined;
  onChange: (value: TValue) => void;
  onBlur: () => void;
  /** Props for a native `<input>`, `<select>` or `<textarea>`. */
  inputProps: {
    id: string;
    name: string;
    value: TValue;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
}

export interface UseFormOptions<TValues extends FormValues> {
  initialValues: TValues;
  /** Per-field validators, run in declaration order. */
  validators?: Partial<Record<keyof TValues, Validator<never, TValues> | Array<Validator<never, TValues>>>>;
  /**
   * Form-level validation for rules that span fields. Runs after per-field
   * validators and may add or override messages.
   */
  validate?: (values: TValues) => FormErrors<TValues>;
  /** Called only when validation passes. */
  onSubmit?: (values: TValues) => void | Promise<void>;
  /** Overrides the DOM id used when focusing the first invalid field. */
  fieldIds?: Partial<Record<keyof TValues, string>>;
}

export interface UseFormResult<TValues extends FormValues> {
  values: TValues;
  errors: FormErrors<TValues>;
  touched: Partial<Record<keyof TValues, boolean>>;
  setValue: <K extends keyof TValues>(name: K, value: TValues[K]) => void;
  setError: (name: keyof TValues, message: string | undefined) => void;
  setErrors: (errors: FormErrors<TValues>) => void;
  register: <K extends keyof TValues>(name: K, options?: RegisterOptions) => RegisteredField<TValues[K]>;
  handleBlur: (name: keyof TValues) => void;
  handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<boolean>;
  reset: (nextValues?: TValues) => void;
  validateAll: (values?: TValues) => FormErrors<TValues>;
}

const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Requires a non-blank value. */
export const required =
  (message = 'This field is required'): Validator =>
  (value) =>
    isBlank(value) ? message : undefined;

/** Requires a value shaped like an email address. */
export const email =
  (message = 'Please enter a valid email address'): Validator =>
  (value) =>
    typeof value === 'string' && EMAIL_PATTERN.test(value.trim())
      ? undefined
      : message;

/** Requires a string (or array) of at least `length` characters/items. */
export const minLength =
  (length: number, message?: string): Validator =>
  (value) => {
    const size =
      typeof value === 'string'
        ? value.length
        : Array.isArray(value)
          ? value.length
          : 0;
    return size >= length ? undefined : (message ?? `Must be at least ${length} characters`);
  };

/**
 * Matches another field's value (`matches('confirmPassword')`) or a regular
 * expression (`matches(/^\d+$/)`).
 */
export const matches = (
  pattern: string | RegExp,
  message = 'Values do not match',
): Validator => {
  if (pattern instanceof RegExp) {
    return (value) =>
      typeof value === 'string' && pattern.test(value) ? undefined : message;
  }
  return (value, values) => (value === values[pattern] ? undefined : message);
};

/** Wraps a predicate so it can be composed with the built-in validators. */
export const custom = (
  predicate: (value: unknown, values: FormValues) => boolean,
  message = 'Invalid value',
): Validator => (value, values) => (predicate(value, values) ? undefined : message);

function firstError<TValues extends FormValues>(
  errors: FormErrors<TValues>,
  order: Array<keyof TValues>,
): keyof TValues | undefined {
  return order.find((key) => Boolean(errors[key]));
}

export function useForm<TValues extends FormValues>({
  initialValues,
  validators,
  validate,
  onSubmit,
  fieldIds,
}: UseFormOptions<TValues>): UseFormResult<TValues> {
  const [values, setValues] = useState<TValues>(initialValues);
  const [errors, setErrorsState] = useState<FormErrors<TValues>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof TValues, boolean>>>({});

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const initialValuesRef = useRef(initialValues);
  const optionsRef = useRef({ validators, validate, onSubmit, fieldIds });
  optionsRef.current = { validators, validate, onSubmit, fieldIds };

  const fieldOrder = useMemo(
    () => Object.keys(initialValues) as Array<keyof TValues>,
    // The schema shape is fixed for the lifetime of the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const validateAll = useCallback(
    (candidate?: TValues): FormErrors<TValues> => {
      const current = candidate ?? valuesRef.current;
      const next: FormErrors<TValues> = {};
      const { validators: fieldValidators, validate: formValidator } = optionsRef.current;

      for (const name of fieldOrder) {
        const configured = fieldValidators?.[name];
        if (!configured) continue;
        const list = Array.isArray(configured) ? configured : [configured];
        for (const validator of list) {
          const message = validator(current[name] as never, current);
          if (message) {
            next[name] = message;
            break;
          }
        }
      }

      if (formValidator) {
        const formErrors = formValidator(current);
        for (const key of Object.keys(formErrors) as Array<keyof TValues>) {
          if (formErrors[key]) next[key] = formErrors[key] as string;
        }
      }

      return next;
    },
    [fieldOrder],
  );

  const focusFirstError = useCallback(
    (nextErrors: FormErrors<TValues>) => {
      const name = firstError(nextErrors, fieldOrder);
      if (name === undefined) return;
      const id = optionsRef.current.fieldIds?.[name] ?? String(name);
      if (typeof document === 'undefined') return;
      const element = document.getElementById(id);
      if (element && typeof element.focus === 'function') element.focus();
    },
    [fieldOrder],
  );

  const setValue = useCallback(<K extends keyof TValues>(name: K, value: TValues[K]) => {
    setValues((previous) => {
      const next = { ...previous, [name]: value };
      valuesRef.current = next;
      return next;
    });
    setErrorsState((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }, []);

  const setError = useCallback((name: keyof TValues, message: string | undefined) => {
    setErrorsState((previous) => {
      const next = { ...previous };
      if (message) {
        next[name] = message;
      } else {
        delete next[name];
      }
      return next;
    });
  }, []);

  const setErrors = useCallback((next: FormErrors<TValues>) => {
    setErrorsState(next);
  }, []);

  const handleBlur = useCallback(
    (name: keyof TValues) => {
      setTouched((previous) => ({ ...previous, [name]: true }));
      const configured = optionsRef.current.validators?.[name];
      if (!configured) return;
      const list = Array.isArray(configured) ? configured : [configured];
      const current = valuesRef.current;
      for (const validator of list) {
        const message = validator(current[name] as never, current);
        if (message) {
          setError(name, message);
          return;
        }
      }
      setError(name, undefined);
    },
    [setError],
  );

  const register = useCallback(
    <K extends keyof TValues>(name: K, options: RegisterOptions = {}): RegisteredField<TValues[K]> => {
      const id = options.id ?? String(name);
      const error = errors[name];
      const describedBy = [options.describedBy, error ? `${id}-error` : undefined]
        .filter(Boolean)
        .join(' ');

      return {
        id,
        name: String(name),
        value: values[name],
        error,
        onChange: (value: TValues[K]) => setValue(name, value),
        onBlur: () => handleBlur(name),
        inputProps: {
          id,
          name: String(name),
          value: values[name],
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            const target = event.target;
            if (options.type === 'checkbox' && target instanceof HTMLInputElement) {
              setValue(name, target.checked as TValues[K]);
            } else {
              setValue(name, target.value as TValues[K]);
            }
          },
          onBlur: () => handleBlur(name),
          'aria-invalid': Boolean(error),
          'aria-describedby': describedBy || undefined,
        },
      };
    },
    [errors, handleBlur, setValue, values],
  );

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>): Promise<boolean> => {
      event?.preventDefault();
      const current = valuesRef.current;
      const nextErrors = validateAll(current);

      setTouched((previous) => {
        const next = { ...previous };
        for (const name of fieldOrder) next[name] = true;
        return next;
      });

      if (Object.keys(nextErrors).length > 0) {
        setErrorsState(nextErrors);
        focusFirstError(nextErrors);
        return false;
      }

      setErrorsState({});
      await optionsRef.current.onSubmit?.(current);
      return true;
    },
    [fieldOrder, focusFirstError, validateAll],
  );

  const reset = useCallback((nextValues?: TValues) => {
    const resolved = nextValues ?? initialValuesRef.current;
    valuesRef.current = resolved;
    setValues(resolved);
    setErrorsState({});
    setTouched({});
  }, []);

  return {
    values,
    errors,
    touched,
    setValue,
    setError,
    setErrors,
    register,
    handleBlur,
    handleSubmit,
    reset,
    validateAll,
  };
}
