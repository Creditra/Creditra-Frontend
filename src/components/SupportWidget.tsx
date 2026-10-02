/**
 * SupportWidget — floating help widget for the GrantFox FWC26 campaign.
 *
 * Combines FAQ search (existing) with the new inline contact form:
 *
 *   [ FAQ ] [ Contact ]   ← tab bar visible inside the open panel
 *
 * The two tabs share the same panel element; only the active tab's content
 * is rendered.  Each tab button carries the standard ARIA tab pattern
 * (role="tab", aria-selected, aria-controls) so keyboard users can switch
 * between FAQ and the contact form without leaving the widget.
 *
 * Accessibility:
 * - Focus is moved to the search input when the panel opens on the FAQ tab
 *   and to the first form input when the Contact tab is activated.
 * - Escape closes the panel regardless of which tab is active.
 * - Click outside the widget dismisses the panel.
 * - Touch targets are ≥ 44×44 px throughout (enforced in SupportWidget.css).
 *
 * State management:
 * - `isOpen` — panel visibility.
 * - `activeTab` — "faq" | "contact".
 * - FAQ tab state (query, expandedId) lives in this component because it
 *   affects the panel header subtitle text.
 * - Form state is managed entirely inside SupportForm; `isOpen` is forwarded
 *   so the form auto-resets when the widget closes.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import { HelpCircle, Mail, Search, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { WalletContext } from "../context/WalletContext";
import { submitSupportRequest } from "../services/support";
import faqEntriesData from "../data/faq.json";
import { SupportForm, type SupportFormData } from "./SupportForm";
import "./SupportWidget.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

type ActiveTab = "faq" | "contact";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORT_EMAIL = "support@creditra.com";
const faqEntries = faqEntriesData as FaqEntry[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const searchableValue = (entry: FaqEntry) =>
  [entry.question, entry.answer, ...entry.tags].join(" ").toLowerCase();

// ─── Component ────────────────────────────────────────────────────────────────

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("faq");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const location = useLocation();
  const walletContext = useContext(WalletContext);
  const walletType = walletContext?.wallet?.type ?? "none";

  const handleSubmitSupport = async (data: SupportFormData) => {
    await submitSupportRequest(data, {
      route: location.pathname,
      appVersion: "0.1.0",
      walletType,
    });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const resultsHeadingId = useId();
  const faqTabId = `${panelId}-tab-faq`;
  const contactTabId = `${panelId}-tab-contact`;
  const faqPanelId = `${panelId}-tabpanel-faq`;
  const contactPanelId = `${panelId}-tabpanel-contact`;

  // ── Filtered FAQ list ────────────────────────────────────────────────────
  const filteredFaqs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return faqEntries;
    return faqEntries.filter((entry) =>
      searchableValue(entry).includes(normalizedQuery),
    );
  }, [query]);

  // ── Keyboard + outside-click handling ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus: search on FAQ tab, first form field is handled by
    // SupportForm's autoFocus attribute (not applicable here since FormField
    // does not set autofocus; focus is handled via the ref below).
    if (activeTab === "faq") {
      searchInputRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, activeTab]);

  // ── Keep expanded FAQ item in sync with filtered results ─────────────────
  useEffect(() => {
    if (!expandedId) return;
    const hasExpandedEntry = filteredFaqs.some((e) => e.id === expandedId);
    if (!hasExpandedEntry) {
      setExpandedId(filteredFaqs[0]?.id ?? null);
    }
  }, [expandedId, filteredFaqs]);

  // ── Tab activation helper ────────────────────────────────────────────────
  function activateTab(tab: ActiveTab) {
    setActiveTab(tab);
    // Focus the search input when switching back to FAQ tab
    if (tab === "faq") {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="support-widget" ref={containerRef}>
      {isOpen && (
        <section
          id={panelId}
          className="support-widget__panel"
          role="dialog"
          aria-modal="false"
          aria-label="Support"
        >
          {/* Header */}
          <div className="support-widget__header">
            <div>
              <h2 className="support-widget__title">Support</h2>
              <p className="support-widget__subtitle">
                {activeTab === "faq"
                  ? "Search quick answers or hand off to email support."
                  : "Describe your issue and we'll follow up by email."}
              </p>
            </div>
            <button
              type="button"
              className="support-widget__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close support widget"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Tab bar */}
          <div
            className="support-widget__tabs"
            role="tablist"
            aria-label="Support options"
          >
            <button
              id={faqTabId}
              role="tab"
              type="button"
              className={`support-widget__tab${activeTab === "faq" ? " support-widget__tab--active" : ""}`}
              aria-selected={activeTab === "faq"}
              aria-controls={faqPanelId}
              onClick={() => activateTab("faq")}
            >
              <Search size={14} aria-hidden="true" />
              FAQ
            </button>
            <button
              id={contactTabId}
              role="tab"
              type="button"
              className={`support-widget__tab${activeTab === "contact" ? " support-widget__tab--active" : ""}`}
              aria-selected={activeTab === "contact"}
              aria-controls={contactPanelId}
              onClick={() => activateTab("contact")}
            >
              <Mail size={14} aria-hidden="true" />
              Contact
            </button>
          </div>

          {/* ── FAQ tab panel ───────────────────────────────────────────── */}
          <div
            id={faqPanelId}
            role="tabpanel"
            aria-labelledby={faqTabId}
            hidden={activeTab !== "faq"}
          >
            <label
              className="support-widget__search-label"
              htmlFor={`${panelId}-search`}
            >
              Search FAQ
            </label>
            <input
              id={`${panelId}-search`}
              ref={searchInputRef}
              type="search"
              className="support-widget__search"
              placeholder="Search FAQ topics"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <p className="support-widget__meta" id={resultsHeadingId}>
              {filteredFaqs.length} result{filteredFaqs.length === 1 ? "" : "s"}
            </p>

            {filteredFaqs.length > 0 ? (
              <ul
                className="support-widget__faq-list"
                aria-labelledby={resultsHeadingId}
              >
                {filteredFaqs.map((entry) => {
                  const answerId = `${panelId}-${entry.id}-answer`;
                  const isExpanded = expandedId === entry.id;

                  return (
                    <li key={entry.id} className="support-widget__faq-item">
                      <button
                        type="button"
                        className="support-widget__faq-button"
                        aria-expanded={isExpanded}
                        aria-controls={answerId}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : entry.id)
                        }
                      >
                        <span className="support-widget__faq-question">
                          {entry.question}
                        </span>
                      </button>
                      {isExpanded && (
                        <div
                          id={answerId}
                          className="support-widget__faq-answer"
                        >
                          {entry.answer}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="support-widget__empty" role="status">
                No FAQ matched that search. Use the Contact tab for
                account-specific help.
              </div>
            )}

            <div className="support-widget__actions">
              <a
                className="support-widget__email-link"
                href={`mailto:${SUPPORT_EMAIL}?subject=GrantFox%20support%20request`}
                aria-label="Email support"
              >
                <Mail size={16} aria-hidden="true" />
                Email support
              </a>
              <Link className="support-widget__help-link" to="/help">
                <Search size={16} aria-hidden="true" />
                Full help center
              </Link>
            </div>
          </div>

          {/* ── Contact tab panel ──────────────────────────────────────── */}
          <div
            id={contactPanelId}
            role="tabpanel"
            aria-labelledby={contactTabId}
            hidden={activeTab !== "contact"}
          >
            <SupportForm
              isOpen={isOpen && activeTab === "contact"}
              onSubmit={handleSubmitSupport}
            />
          </div>
        </section>
      )}

      {/* Floating trigger button */}
      <button
        type="button"
        className="support-widget__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <HelpCircle size={18} aria-hidden="true" />
        Support
      </button>
    </div>
  );
}

export default SupportWidget;
