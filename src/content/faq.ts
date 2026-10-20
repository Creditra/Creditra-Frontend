export interface FaqEntry {
  id: string;
  sectionId: string;
  question: string;
  answer: string;
  tags: string[];
  videoId?: string;
  transcriptUrl?: string;
}

export const FAQ: FaqEntry[] = [
  {
    id: "what-is-creditra",
    sectionId: "getting-started",
    question: "What is Creditra?",
    answer: "Creditra is a Stellar-based credit experience that helps you request, manage, and repay flexible credit lines from one dashboard.",
    tags: ["creditra", "getting started", "overview", "basics"],
  },
  {
    id: "connect-wallet",
    sectionId: "wallet",
    question: "How do I connect a wallet?",
    answer: "Open the wallet modal, choose a detected wallet, and approve the request in your extension. If a wallet is missing, the Help Center wallet section walks through supported options and troubleshooting.",
    tags: ["wallet", "connect", "extension", "freighter", "troubleshooting"],
    videoId: "dQw4w9WgXcQ",
    transcriptUrl: "https://support.creditra.app/transcripts/connect-wallet",
  },
  {
    id: "repayments",
    sectionId: "credit-lines",
    question: "How do repayments work?",
    answer: "Repayments reduce your current debt and are recorded in transaction history with their status, amount, and on-chain hash when available.",
    tags: ["repayments", "credit lines", "debt", "history"],
    videoId: "9bZkp7q19f0",
  },
  {
    id: "credit-lines-help",
    sectionId: "credit-lines",
    question: "Where can I review my credit lines?",
    answer: "Open the Credit Lines page from the main navigation to review available credit, balances, and repayment details.",
    tags: ["credit lines", "balances", "repayment"],
  },
  {
    id: "transaction-filters",
    sectionId: "transactions",
    question: "Can I filter my transaction history by date?",
    answer: "Yes. Use the preset chips for Today, 7d, 30d, or 90d, or switch to Custom to choose a specific date range.",
    tags: ["transactions", "filter", "date", "history"],
  },
  {
    id: "transactions-help",
    sectionId: "transactions",
    question: "Can I search or filter transactions?",
    answer: "Yes. Visit Transactions to sort history, inspect status, and narrow results with the available filters.",
    tags: ["transactions", "filter", "history", "search"],
  },
  {
    id: "notifications-settings",
    sectionId: "notifications",
    question: "Where can I manage alerts and notifications?",
    answer: "Open the notification center to review unread items, then use preferences to choose which categories should interrupt you.",
    tags: ["notifications", "alerts", "preferences", "settings"],
  },
  {
    id: "keyboard-shortcuts",
    sectionId: "shortcuts",
    question: "Which keyboard shortcuts are supported?",
    answer: "Press ? outside text fields to open the shortcut overlay. Esc closes dialogs, and other shortcuts are grouped by surface inside the overlay.",
    tags: ["keyboard", "shortcuts", "overlay", "accessibility"],
    transcriptUrl: "https://support.creditra.app/transcripts/keyboard-shortcuts",
  },
  {
    id: "shortcut-help",
    sectionId: "shortcuts",
    question: "Are there keyboard shortcuts?",
    answer: "Press ? outside text fields to open shortcut help. You can also tab to the support widget button and use Enter or Space to open it.",
    tags: ["keyboard", "accessibility", "shortcuts"],
  },
  {
    id: "email-help",
    sectionId: "getting-started",
    question: "How do I contact support by email?",
    answer: "Use the Email support action in the support widget to open a secure mailto handoff to support@creditra.com.",
    tags: ["email", "support", "contact"],
  },
];
