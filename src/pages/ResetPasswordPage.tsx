// src/pages/ResetPasswordPage.tsx
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { PasswordStrength, AuthError } from "../types/auth.types";
import {
  calculatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthText,
} from "../utils/password-strength";
import { PendingButton } from "../components/PendingButton";
import { FormField } from "../components/FormField";
import { matches, minLength, required, useForm } from "../hooks/useForm";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  isAbortError,
} from "../utils/fetchWithTimeout";

interface ResetFormValues {
  newPassword: string;
  confirmPassword: string;
}

export function ResetPasswordPage() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>("weak");
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("token");
    if (!tokenParam) {
      setError({ message: "Invalid or missing reset token" });
    } else {
      setToken(tokenParam);
    }
  }, [location.search]);

  const submitReset = async (values: ResetFormValues) => {
    setError(null);

    if (!token) {
      setError({ message: "Invalid reset token" });
      return;
    }

    setLoading(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetchWithTimeout(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword: values.newPassword }),
        },
        { signal: controller.signal },
      );

      const data = await response.json();

      if (!response.ok) {
        setError({ message: data.message || "Failed to reset password" });
        return;
      }

      setSuccess(true);
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) {
        return;
      }
      if (err instanceof FetchTimeoutError) {
        setError({ message: "Request timed out. Please try again." });
        return;
      }
      setError({ message: "An error occurred. Please try again." });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const form = useForm<ResetFormValues>({
    initialValues: { newPassword: "", confirmPassword: "" },
    validators: {
      newPassword: [
        required("All fields are required"),
        minLength(8, "Password must be at least 8 characters"),
      ],
      confirmPassword: [
        required("All fields are required"),
        matches("newPassword", "Passwords do not match"),
      ],
    },
    onSubmit: submitReset,
  });

  const handlePasswordChange = (password: string) => {
    form.setValue("newPassword", password);
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!token) {
      event.preventDefault();
      setError({ message: "Invalid reset token" });
      return;
    }
    void form.handleSubmit(event);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Password Reset Successful
            </h1>
            <p className="text-gray-600 mb-6">
              Your password has been successfully reset. You can now log in with
              your new password.
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Continue to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center  px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-[#161b22] rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-gray-500 mt-2">Enter your new password</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <FormField
              id="newPassword"
              name="newPassword"
              label="New Password"
              type="password"
              required
              helpText="Must be at least 8 characters with letters and numbers"
              error={error?.field === 'newPassword' ? error.message : form.errors.newPassword}
              value={form.values.newPassword}
              onChange={handlePasswordChange}
              onBlur={() => form.handleBlur("newPassword")}
              placeholder="Create a strong password"
              autoComplete="new-password"
            />
            {form.values.newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  <div
                    className={`h-1 flex-1 rounded ${passwordStrength === "weak" || passwordStrength === "medium" || passwordStrength === "strong" ? getPasswordStrengthColor(passwordStrength) : "bg-gray-200"}`}
                  />
                  <div
                    className={`h-1 flex-1 rounded ${passwordStrength === "medium" || passwordStrength === "strong" ? getPasswordStrengthColor(passwordStrength) : "bg-gray-200"}`}
                  />
                  <div
                    className={`h-1 flex-1 rounded ${passwordStrength === "strong" ? getPasswordStrengthColor(passwordStrength) : "bg-gray-200"}`}
                  />
                </div>
                <p className="text-xs text-gray-600" aria-live="polite">
                  {getPasswordStrengthText(passwordStrength)}
                </p>
              </div>
            )}

            <FormField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              required
              error={
                error?.field === 'confirmPassword'
                  ? error.message
                  : form.errors.confirmPassword
              }
              value={form.values.confirmPassword}
              onChange={(value) => form.setValue("confirmPassword", value)}
              onBlur={() => form.handleBlur("confirmPassword")}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />

            <PendingButton
              type="submit"
              pending={loading}
              pendingLabel="Resetting..."
              disabled={!token}
              className="w-full bg-[#58a6ff] hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Reset Password
            </PendingButton>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-[#58a6ff] hover:text-blue-700"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
