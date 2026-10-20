// src/pages/LoginPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { LoginFormData, AuthError } from "../types/auth.types";
import { PendingButton } from "../components/PendingButton";
import { FormField } from "../components/FormField";
import { TrustBadges } from "../components/TrustBadges";
import "../styles/patterns.css";

/**
 * LoginPage — GrantFox FWC26 Stellar Wave campaign
 *
 * Color-blind accessibility (WCAG 2.1 SC 1.4.1 — Use of Color):
 *   Status surfaces pair color tints with shape-coded patterns so statuses
 *   are identifiable without relying on color alone.  Pattern classes come
 *   from src/styles/patterns.css and match the Dashboard v7 taxonomy:
 *
 *     error banner  → .lp-banner--error  (cross-hatch, two directions)
 *     success banner→ .lp-banner--success (micro-dot grid)
 *     info banner   → .lp-banner--info   (horizontal rules)
 *     pending btn   → .lp-btn--pending   (45° diagonal stripes)
 *
 *   Each banner additionally carries a Lucide icon (aria-hidden) as a
 *   second non-color cue, and a data-lp-status attribute for tests and
 *   E2E selectors.
 */
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
          {/*
            GrantFox FWC26 campaign (Stellar Wave) responsive hero image.
            Uses `srcSet` and `sizes` attributes so mobile devices download lower-resolution
            variants (480w / 768w) rather than desktop-sized assets (1200w), satisfying issue #704.
            Includes WCAG 2.1 AA compliant alt text and explicit layout dimensions.
          */}
          <div className="mb-6 overflow-hidden rounded-lg">
            <img
              src="/assets/images/stellar-wave-md.jpg"
              srcSet="/assets/images/stellar-wave-sm.jpg 480w, /assets/images/stellar-wave-md.jpg 768w, /assets/images/stellar-wave-lg.jpg 1200w"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 400px, 400px"
              alt="GrantFox FWC26 Stellar Wave campaign banner"
              width={400}
              height={160}
              className="w-full h-36 object-cover rounded-lg border border-gray-800"
              loading="eager"
              decoding="async"
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-gray-500 mt-2">Sign in to your account</p>
          </div>

          {/*
            Error status banner — color + cross-hatch pattern + AlertCircle icon
            so the error is distinguishable to color-blind users (WCAG 1.4.1).
            role="alert" triggers an assertive screen-reader announcement.
            data-lp-status="error" is the stable selector for unit/E2E tests.
          */}
          {error && (
            <div
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg lp-banner--error"
              role="alert"
              data-lp-status="error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-800"
                  aria-hidden="true"
                />
                <p className="text-sm text-red-800">{error.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              id="emailOrUsername"
              name="emailOrUsername"
              label="Email or Username"
              type="text"
              required
              value={formData.emailOrUsername}
              onChange={(value) =>
                setFormData({ ...formData, emailOrUsername: value })
              }
              placeholder="Enter your email or username"
              autoComplete="username"
              error={
                error?.field === "emailOrUsername" ? error.message : undefined
              }
            />

            {/*
              helpText provides a persistent <p id="password-help"> element so that
              aria-describedby="password-help" is always present on the input — not
              only when a field-level error fires. This satisfies WCAG 2.1 SC 1.3.1
              (Info and Relationships) and SC 4.1.3 (Status Messages) by giving
              screen readers programmatic context for the password field at all times.
            */}
            <FormField
              id="password"
              name="password"
              label="Password"
              type="password"
              required
              helpText="Enter the password for your account"
              value={formData.password}
              onChange={(value) =>
                setFormData({ ...formData, password: value })
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              error={error?.field === "password" ? error.message : undefined}
            />

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

            {/*
              Pending submit button — when loading, lp-btn--pending adds a
              diagonal-stripe pattern on top of the disabled tint so the
              "in progress" state is identifiable beyond the button's color.
            */}
            <PendingButton
              type="submit"
              pending={loading}
              pendingLabel="Signing in..."
              className={`w-full bg-[#58a6ff] hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors ${loading ? "lp-btn--pending" : ""}`}
            >
              Login
            </PendingButton>
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

        <TrustBadges />
      </div>
    </div>
  );
}
