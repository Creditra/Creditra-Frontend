import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  custom,
  email,
  matches,
  minLength,
  required,
  useForm,
  type FormErrors,
} from '../useForm';

interface SignupValues {
  email: string;
  password: string;
  confirmPassword: string;
  code: string;
}

const initialValues: SignupValues = {
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
};

function useSignupForm(
  onSubmit: (values: SignupValues) => void | Promise<void> = vi.fn(),
  validate?: (values: SignupValues) => FormErrors<SignupValues>,
) {
  return useForm<SignupValues>({
    initialValues,
    validators: {
      email: [required('All fields are required'), email()],
      password: [required('All fields are required'), minLength(8)],
      confirmPassword: matches('password', 'Passwords do not match'),
      code: custom((value) => value === 'ABC', 'Code must be ABC'),
    },
    validate,
    onSubmit,
  });
}

/** Adds a focusable element with the id the hook targets for a field. */
function addFieldElement(id: string): HTMLInputElement {
  const input = document.createElement('input');
  input.id = id;
  document.body.appendChild(input);
  return input;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('useForm', () => {
  it('runs required validators in field order, focuses the first invalid field and blocks submit', async () => {
    const onSubmit = vi.fn();
    const emailInput = addFieldElement('email');
    const { result } = renderHook(() => useSignupForm(onSubmit));

    let submitted = true;
    await act(async () => {
      submitted = await result.current.handleSubmit();
    });

    expect(submitted).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.email).toBe('All fields are required');
    expect(emailInput).toHaveFocus();
    expect(result.current.register('email').inputProps['aria-invalid']).toBe(true);
  });

  it('rejects a malformed email and accepts a valid one', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useSignupForm(onSubmit));

    await act(async () => {
      result.current.setValue('email', 'not-an-email');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.email).toBe('Please enter a valid email address');

    await act(async () => {
      result.current.setValue('email', 'user@example.com');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.email).toBeUndefined();
  });

  it('enforces minLength', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      result.current.setValue('password', 'short');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.password).toBe('Must be at least 8 characters');
  });

  it('matches another field value', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      result.current.setValue('password', 'longenough');
      result.current.setValue('confirmPassword', 'different');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.confirmPassword).toBe('Passwords do not match');
  });

  it('supports custom predicates', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      result.current.setValue('code', 'nope');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.code).toBe('Code must be ABC');
  });

  it('submits the values once every validator passes', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useSignupForm(onSubmit));

    await act(async () => {
      result.current.setValue('email', 'user@example.com');
      result.current.setValue('password', 'longenough');
      result.current.setValue('confirmPassword', 'longenough');
      result.current.setValue('code', 'ABC');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'longenough',
      confirmPassword: 'longenough',
      code: 'ABC',
    });
    expect(result.current.errors).toEqual({});
  });

  it('clears a field error as soon as the user edits it', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.email).toBe('All fields are required');

    await act(async () => {
      result.current.setValue('email', 'a');
    });

    expect(result.current.errors.email).toBeUndefined();
  });

  it('marks a field touched and validates it on blur', async () => {
    const { result } = renderHook(() =>
      useForm<{ email: string }>({
        initialValues: { email: '' },
        validators: { email: email() },
      }),
    );

    await act(async () => {
      result.current.handleBlur('email');
    });

    expect(result.current.touched.email).toBe(true);
    expect(result.current.errors.email).toBe('Please enter a valid email address');
  });

  it('merges form-level validation with field validators', async () => {
    const validate = vi.fn((values: SignupValues) =>
      values.code === 'ABC' ? { email: 'Email already registered' } : {},
    );
    const { result } = renderHook(() => useSignupForm(vi.fn(), validate));

    await act(async () => {
      result.current.setValue('email', 'user@example.com');
      result.current.setValue('password', 'longenough');
      result.current.setValue('confirmPassword', 'longenough');
      result.current.setValue('code', 'ABC');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(validate).toHaveBeenCalled();
    expect(result.current.errors.email).toBe('Email already registered');
  });

  it('resets values, errors and touched state', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      result.current.setValue('email', 'user@example.com');
      result.current.handleBlur('email');
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.password).toBe('All fields are required');

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('composes aria-describedby from help text and the error id', async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      await result.current.handleSubmit();
    });

    const field = result.current.register('email', { describedBy: 'email-help' });
    expect(field.inputProps['aria-describedby']).toBe('email-help email-error');
  });

  it('exposes a stable onChange handler that updates the value', async () => {
    const { result } = renderHook(() => useSignupForm());
    const { onChange } = result.current.register('email').inputProps;

    await act(async () => {
      onChange({ target: { value: 'typed@example.com' } } as never);
    });

    expect(result.current.values.email).toBe('typed@example.com');
  });
});
