import { describe, it, expect } from "vitest";

describe("MSW handlers", () => {
  describe("POST /api/auth/login", () => {
    it("returns 200 with a mock token on valid credentials", async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername: "alice@creditra.test",
          password: "Password123!",
          rememberMe: true,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBe("mock-jwt-token");
      expect(data.user.emailOrUsername).toBe("alice@creditra.test");
    });

    it("returns 400 validation error for validation trigger or missing fields", async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername: "validation@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.field).toBe("emailOrUsername");
      expect(data.message).toMatch(/valid email/i);
    });

    it("returns 401 on invalid credentials", async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername: "invalid@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toMatch(/invalid/i);
    });

    it("returns 429 on rate limit trigger", async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername: "ratelimit@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");
    });

    it("rejects with a network error on network trigger", async () => {
      await expect(
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailOrUsername: "network@creditra.test",
            password: "Password123!",
          }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/auth/register", () => {
    it("returns 201 on valid registration", async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.email).toBe("newuser@creditra.test");
    });

    it("returns 400 on existing email or validation error", async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "exists@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.field).toBe("email");
    });

    it("returns 401 on unauthorized trigger", async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unauthorized@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 429 on rate limit trigger", async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ratelimit@creditra.test",
          password: "Password123!",
        }),
      });
      expect(res.status).toBe(429);
    });

    it("rejects with a network error on network trigger", async () => {
      await expect(
        fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "network@creditra.test",
            password: "Password123!",
          }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns 200 on valid email", async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@creditra.test" }),
      });
      expect(res.status).toBe(200);
    });

    it("returns 400 on validation trigger", async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "validation@creditra.test" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 on unauthorized trigger", async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unauthorized@creditra.test" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 429 on rate limit trigger", async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ratelimit@creditra.test" }),
      });
      expect(res.status).toBe(429);
    });

    it("rejects with a network error on network trigger", async () => {
      await expect(
        fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "network@creditra.test" }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("returns 200 on valid token and password", async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "valid-token",
          newPassword: "NewPassword123!",
        }),
      });
      expect(res.status).toBe(200);
    });

    it("returns 400 on short password", async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "valid-token", newPassword: "short" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 on invalid token", async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "invalid-token",
          newPassword: "NewPassword123!",
        }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 429 on rate-limit token", async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "rate-limit",
          newPassword: "NewPassword123!",
        }),
      });
      expect(res.status).toBe(429);
    });

    it("rejects with a network error on network-error token", async () => {
      await expect(
        fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "network-error",
            newPassword: "NewPassword123!",
          }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/analytics", () => {
    it("returns 202 for a valid analytics event", async () => {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "page_view", category: "usage" }),
      });
      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.accepted).toBe(true);
    });

    it("returns 400 on validation_error", async () => {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "validation_error", category: "usage" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 on unauthorized", async () => {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "unauthorized", category: "usage" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 429 on rate_limit", async () => {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "rate_limit", category: "usage" }),
      });
      expect(res.status).toBe(429);
    });

    it("rejects with a network error on network_error", async () => {
      await expect(
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "network_error", category: "usage" }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/mock-upload", () => {
    function uploadForm(name: string) {
      const formData = new FormData();
      formData.append("file", new File(["content"], name, { type: "application/pdf" }));
      return fetch("/api/mock-upload", { method: "POST", body: formData });
    }

    it("returns 200 on normal file upload", async () => {
      const res = await uploadForm("statement.pdf");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.fileName).toBe("statement.pdf");
      expect(data.progress).toBe(100);
    });

    it("supports slow upload with progress", async () => {
      const start = Date.now();
      const res = await uploadForm("slow-statement.pdf");
      const elapsed = Date.now() - start;
      expect(res.status).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });

    it("returns 400 on invalid file name", async () => {
      const res = await uploadForm("invalid.pdf");
      expect(res.status).toBe(400);
    });

    it("returns 401 on unauthorized file name", async () => {
      const res = await uploadForm("unauthorized.pdf");
      expect(res.status).toBe(401);
    });

    it("returns 429 on ratelimit file name", async () => {
      const res = await uploadForm("ratelimit.pdf");
      expect(res.status).toBe(429);
    });

    it("rejects with a network error on network file name", async () => {
      await expect(uploadForm("network.pdf")).rejects.toThrow();
    });
  });
});
