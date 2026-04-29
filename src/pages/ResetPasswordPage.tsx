// src/pages/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { PasswordStrength, AuthError } from "../types/auth.types";
import {
  calculatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthText,
} from "../utils/password-strength";
import { PendingButton } from "../components/PendingButton";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>("weak");
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("token");
    if (!tokenParam) {
      setError({ message: "Invalid or missing reset token" });
    } else {
      setToken(tokenParam);
    }
  }, [location.search]);

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, newPassword: password });
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const validateForm = (): boolean => {
    if (!formData.newPassword || !formData.confirmPassword) {
      setError({ message: "All fields are required" });
      return false;
    }
    if (formData.newPassword.length < 8) {
      setError({
        field: "newPassword",
        message: "Password must be at least 8 characters",
      });
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError({ field: "confirmPassword", message: "Passwords do not match" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError({ message: "Invalid reset token" });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: formData.newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({ message: data.message || "Failed to reset password" });
        return;
      }

      setSuccess(true);
    } catch {
      setError({ message: "An error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-500 mb-2"
              >
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={formData.newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Create a strong password"
              />
              {formData.newPassword && (
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
                  <p className="text-xs text-gray-600">
                    {getPasswordStrengthText(passwordStrength)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-500 mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Re-enter your password"
              />
            </div>

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
