/**
 * Support Service
 *
 * Dispatches customer support tickets to the backend API endpoint.
 * Attaches non-sensitive contextual metadata (route pathname, app version,
 * wallet type) without exposing sensitive financial info, secret keys, or balances.
 */

export interface SupportContext {
  route?: string;
  appVersion?: string;
  walletType?: string;
  timestamp?: number;
}

export interface SupportRequestPayload {
  subject: string;
  message: string;
  context?: SupportContext;
}

export interface SupportResponse {
  success: boolean;
  ticketId?: string;
  message?: string;
}

/**
 * Submit a support request ticket to the backend.
 *
 * @param data - The validated subject and message
 * @param context - Optional non-sensitive environment metadata
 * @returns Promise resolving to the server response
 * @throws Error on network failure or non-2xx HTTP response
 */
export async function submitSupportRequest(
  data: { subject: string; message: string },
  context?: SupportContext
): Promise<SupportResponse> {
  const payload: SupportRequestPayload = {
    subject: data.subject.trim(),
    message: data.message.trim(),
    context: {
      route: context?.route ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
      appVersion: context?.appVersion ?? "0.1.0",
      walletType: context?.walletType ?? "none",
      timestamp: context?.timestamp ?? Date.now(),
    },
  };

  const response = await fetch("/api/support", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to submit support request (${response.status})`
    );
  }

  return response.json();
}
