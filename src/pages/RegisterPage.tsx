// src/pages/RegisterPage.tsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RegisterFormData,
  AuthError,
  PasswordStrength,
} from "../types/auth.types";
import {
  calculatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthText,
} from "../utils/password-strength";
import { PendingButton } from "../components/PendingButton";
import { FormField } from "../components/FormField";
import { custom, email, matches, minLength, required, useForm } from "../hooks/useForm";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  isAbortError,
} from "../utils/fetchWithTimeout";

export function RegisterPage() {
  const navigate = useNavigate();
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>("weak");
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const submitRegister = async (values: RegisterFormData) => {
    setError(null);
    setLoading(true);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetchWithTimeout(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
          }),
        },
        { signal: controller.signal },
      );

      const data = await response.json();

      if (!response.ok) {
        setError({ message: data.message || "Registration failed" });
        return;
      }

      navigate("/login?registered=true");
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

  const form = useForm<RegisterFormData>({
    initialValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
    validators: {
      email: [required("All fields are required"), email("Please enter a valid email address")],
      password: [
        required("All fields are required"),
        minLength(8, "Password must be at least 8 characters"),
      ],
      confirmPassword: [
        required("All fields are required"),
        matches("password", "Passwords do not match"),
      ],
      acceptTerms: custom(
        (value) => value === true,
        "You must accept the terms and conditions",
      ),
    },
    onSubmit: submitRegister,
  });

  const handlePasswordChange = (password: string) => {
    form.setValue("password", password);
    setPasswordStrength(calculatePasswordStrength(password));
  };

  return (
    <div className="min-h-screen flex items-center justify-center  px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="bg-[#161b22] rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-gray-500 mt-2">Sign up to get started</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error.message}</p>
            </div>
          )}

          <form onSubmit={form.handleSubmit} className="space-y-6" noValidate>
            <FormField
              id="email"
              name="email"
              label="Email Address"
              type="email"
              required
              helpText="We'll never share your email with anyone"
              error={error?.field === 'email' ? error.message : form.errors.email}
              value={form.values.email}
              onChange={(value) => form.setValue("email", value)}
              onBlur={() => form.handleBlur("email")}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <FormField
              id="password"
              name="password"
              label="Password"
              type="password"
              required
              helpText="Must be at least 8 characters with letters and numbers"
              error={error?.field === 'password' ? error.message : form.errors.password}
              value={form.values.password}
              onChange={handlePasswordChange}
              onBlur={() => form.handleBlur("password")}
              placeholder="Create a strong password"
              autoComplete="new-password"
            />
            {form.values.password && (
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

            <div>
              <label className="flex items-start">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  checked={form.values.acceptTerms}
                  onChange={(e) => form.setValue("acceptTerms", e.target.checked)}
                  aria-invalid={Boolean(form.errors.acceptTerms)}
                  aria-describedby={
                    form.errors.acceptTerms ? "acceptTerms-error" : undefined
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <span className="ml-2 text-sm text-gray-700">
                  I accept the{" "}
                  <Link
                    to="/terms"
                    className="text-[#58a6ff] hover:text-blue-700"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    className="text-[#58a6ff] hover:text-blue-700"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {form.errors.acceptTerms && (
                <p id="acceptTerms-error" className="mt-1 text-sm text-red-700" role="alert">
                  {form.errors.acceptTerms}
                </p>
              )}
            </div>

            <PendingButton
              type="submit"
              pending={loading}
              pendingLabel="Creating Account..."
              className="w-full bg-[#58a6ff] hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Create Account
            </PendingButton>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#58a6ff] hover:text-blue-700 font-medium"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
