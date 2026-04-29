// src/pages/RegisterPage.tsx
import { useState } from "react";
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

export function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>("weak");
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password });
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError({ message: "All fields are required" });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError({
        field: "email",
        message: "Please enter a valid email address",
      });
      return false;
    }

    if (formData.password.length < 8) {
      setError({
        field: "password",
        message: "Password must be at least 8 characters",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError({ field: "confirmPassword", message: "Passwords do not match" });
      return false;
    }

    if (!formData.acceptTerms) {
      setError({ message: "You must accept the terms and conditions" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({ message: data.message || "Registration failed" });
        return;
      }

      navigate("/login?registered=true");
    } catch {
      setError({ message: "An error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              id="email"
              label="Email Address"
              type="email"
              required
              helpText="We'll never share your email with anyone"
              error={error?.field === 'email' ? error.message : undefined}
              inputProps={{
                value: formData.email,
                onChange: (e) => setFormData({ ...formData, email: e.target.value }),
                placeholder: "you@example.com",
                autoComplete: "email"
              }}
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              required
              helpText="Must be at least 8 characters with letters and numbers"
              error={error?.field === 'password' ? error.message : undefined}
              inputProps={{
                value: formData.password,
                onChange: (e) => handlePasswordChange(e.target.value),
                placeholder: "Create a strong password",
                autoComplete: "new-password"
              }}
            />
            {formData.password && (
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
              label="Confirm Password"
              type="password"
              required
              error={error?.field === 'confirmPassword' ? error.message : undefined}
              inputProps={{
                value: formData.confirmPassword,
                onChange: (e) => setFormData({ ...formData, confirmPassword: e.target.value }),
                placeholder: "Re-enter your password",
                autoComplete: "new-password"
              }}
            />

            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) =>
                    setFormData({ ...formData, acceptTerms: e.target.checked })
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
