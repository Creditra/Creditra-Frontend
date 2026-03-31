// src/pages/LoginPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoginFormData, AuthError } from "../types/auth.types";

export function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({
    emailOrUsername: "",
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({ message: data.message || "Invalid credentials" });
        return;
      }

      // Store token if remember me is checked
      if (formData.rememberMe) {
        localStorage.setItem("auth_token", data.token);
      } else {
        sessionStorage.setItem("auth_token", data.token);
      }

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err) {
      setError({ message: "An error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center  px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-[#161b22] rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-gray-500 mt-2">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="emailOrUsername"
                className="block text-sm font-medium text-gray-500 mb-2"
              >
                Email or Username
              </label>
              <input
                id="emailOrUsername"
                type="text"
                required
                value={formData.emailOrUsername}
                onChange={(e) =>
                  setFormData({ ...formData, emailOrUsername: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your email or username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-500 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) =>
                    setFormData({ ...formData, rememberMe: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>

              <Link
                to="/forgot-password"
                className="text-sm text-[#58a6ff] hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#58a6ff] hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[#58a6ff] hover:text-blue-700 font-medium"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
