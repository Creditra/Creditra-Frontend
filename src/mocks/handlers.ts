import { http, HttpResponse, delay } from "msw";
import type { AuthError } from "../types/auth.types";

interface LoginRequestBody {
  emailOrUsername?: string;
  password?: string;
  rememberMe?: boolean;
}

interface RegisterRequestBody {
  email?: string;
  password?: string;
}

interface ForgotPasswordRequestBody {
  email?: string;
}

interface ResetPasswordRequestBody {
  token?: string;
  newPassword?: string;
}

interface AnalyticsRequestBody {
  event?: string;
  category?: string;
  payload?: unknown;
  timestamp?: string;
}

function authError(message: string, field?: string): AuthError {
  return field ? { field, message } : { message };
}

export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as LoginRequestBody;
    const identifier = (body.emailOrUsername ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (identifier === "network@creditra.test" || identifier === "network-error") {
      return HttpResponse.error();
    }

    if (identifier === "ratelimit@creditra.test" || identifier === "ratelimit") {
      return HttpResponse.json(
        authError("Too many login attempts. Please try again later."),
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (
      !identifier ||
      identifier === "validation@creditra.test" ||
      identifier === "validation"
    ) {
      return HttpResponse.json(
        authError("Please enter a valid email or username.", "emailOrUsername"),
        { status: 400 },
      );
    }

    if (!password) {
      return HttpResponse.json(
        authError("Password is required.", "password"),
        { status: 400 },
      );
    }

    if (
      identifier === "invalid@creditra.test" ||
      identifier === "invalid" ||
      password === "wrong-password"
    ) {
      return HttpResponse.json(
        authError("Invalid email or password."),
        { status: 401 },
      );
    }

    return HttpResponse.json(
      {
        token: "mock-jwt-token",
        user: {
          id: "usr_mock_1",
          emailOrUsername: body.emailOrUsername,
        },
      },
      { status: 200 },
    );
  }),

  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as RegisterRequestBody;
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (email === "network@creditra.test") {
      return HttpResponse.error();
    }

    if (email === "ratelimit@creditra.test") {
      return HttpResponse.json(
        authError("Too many registration attempts. Please try again later."),
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (email === "unauthorized@creditra.test") {
      return HttpResponse.json(
        authError("Registration is not authorized for this account."),
        { status: 401 },
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email === "validation@creditra.test" ||
      email === "exists@creditra.test"
    ) {
      return HttpResponse.json(
        authError(
          email === "exists@creditra.test"
            ? "An account with this email already exists."
            : "Please enter a valid email address.",
          "email",
        ),
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return HttpResponse.json(
        authError("Password must be at least 8 characters.", "password"),
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        id: "usr_mock_new",
        email: body.email,
        message: "Account created successfully.",
      },
      { status: 201 },
    );
  }),

  http.post("/api/auth/forgot-password", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as ForgotPasswordRequestBody;
    const email = (body.email ?? "").trim().toLowerCase();

    if (email === "network@creditra.test") {
      return HttpResponse.error();
    }

    if (email === "ratelimit@creditra.test") {
      return HttpResponse.json(
        authError("Too many password reset requests. Please try again later."),
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (email === "unauthorized@creditra.test") {
      return HttpResponse.json(
        authError("Password reset is not authorized for this account."),
        { status: 401 },
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email === "validation@creditra.test"
    ) {
      return HttpResponse.json(
        authError("Please enter a valid email address.", "email"),
        { status: 400 },
      );
    }

    return HttpResponse.json(
      { message: "Password reset link sent." },
      { status: 200 },
    );
  }),

  http.post("/api/auth/reset-password", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as ResetPasswordRequestBody;
    const token = (body.token ?? "").trim();
    const newPassword = body.newPassword ?? "";

    if (token === "network-error") {
      return HttpResponse.error();
    }

    if (token === "rate-limit") {
      return HttpResponse.json(
        authError("Too many password reset attempts. Please try again later."),
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (token === "invalid-token" || token === "expired-token") {
      return HttpResponse.json(
        authError("Reset token is invalid or has expired."),
        { status: 401 },
      );
    }

    if (!token || newPassword.length < 8) {
      return HttpResponse.json(
        authError(
          !token
            ? "Reset token is required."
            : "Password must be at least 8 characters.",
          !token ? "token" : "newPassword",
        ),
        { status: 400 },
      );
    }

    return HttpResponse.json(
      { message: "Password has been reset successfully." },
      { status: 200 },
    );
  }),

  http.post("/api/analytics", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as AnalyticsRequestBody;
    const event = (body.event ?? "").trim();
    const category = (body.category ?? "").trim();

    if (event === "network_error") {
      return HttpResponse.error();
    }

    if (event === "rate_limit") {
      return HttpResponse.json(
        { message: "Analytics rate limit exceeded." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (event === "unauthorized") {
      return HttpResponse.json(
        { message: "Analytics ingestion unauthorized." },
        { status: 401 },
      );
    }

    if (!event || !category || event === "validation_error") {
      return HttpResponse.json(
        { message: "Invalid analytics event payload." },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      { accepted: true, event, category },
      { status: 202 },
    );
  }),

  http.post("/api/mock-upload", async ({ request }) => {
    let fileName = "";
    let size = 0;

    try {
      const rawBody = await request.text();
      const match = rawBody.match(/filename="([^"]+)"/);
      if (match) {
        fileName = match[1];
        size = rawBody.length;
      } else {
        const trimmed = rawBody.trim();
        if (trimmed) {
          fileName = trimmed;
          size = trimmed.length;
        }
      }
    } catch {
      return HttpResponse.json(
        { message: "Invalid multipart form data." },
        { status: 400 },
      );
    }

    const lowerName = fileName.toLowerCase();

    if (lowerName.startsWith("network")) {
      return HttpResponse.error();
    }

    if (lowerName.startsWith("ratelimit")) {
      return HttpResponse.json(
        { message: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    if (lowerName.startsWith("unauthorized")) {
      return HttpResponse.json(
        { message: "Upload unauthorized." },
        { status: 401 },
      );
    }

    if (!fileName || lowerName.startsWith("invalid")) {
      return HttpResponse.json(
        { message: "Invalid file upload." },
        { status: 400 },
      );
    }

    if (lowerName.startsWith("slow")) {
      await delay(600);
    }

    return HttpResponse.json(
      {
        success: true,
        fileName,
        size,
        progress: 100,
      },
      { status: 200 },
    );
  }),
];
