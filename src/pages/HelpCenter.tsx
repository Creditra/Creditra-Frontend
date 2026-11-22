import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { CopyToClipboard } from "../components/CopyToClipboard";
import SupportForm from "../components/SupportForm";
import { Tooltip } from "../components/Tooltip";
import { VideoThumbnail } from "../components/VideoThumbnail";
import { useActiveSection } from "../hooks/useActiveSection";
import { useReducedMotion } from "../context/ReducedMotionContext";
import { useDebounceValue } from "../hooks/useDebounceValue";
import { FAQ, HELP_ANCHORS } from "../content/faq";
import { searchFaq } from "../lib/faq-search";
import "./HelpCenter.css";

export { HELP_ANCHORS };

const NAV_ITEMS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "wallet", label: "Wallet" },
  { id: "kyc", label: "KYC Verification" },
  { id: "credit-lines", label: "Credit Lines" },
  { id: "transactions", label: "Transactions" },
  { id: "notifications", label: "Notifications" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "faq", label: "FAQ" },
] as const;

const categories = [
  { id: "getting-started", title: "Getting Started", desc: "Learn the basics of your account and credit setup." },
  { id: "wallet", title: "Wallet", desc: "Connect, verify, and troubleshoot supported Stellar wallets." },
  { id: "kyc", title: "KYC Verification", desc: "Complete identity verification steps and track your approval status." },
  { id: "credit-lines", title: "Credit Lines", desc: "Understand draws, repayments, and account status changes." },
  { id: "transactions", title: "Transactions", desc: "Filter history, inspect hashes, and export records." },
  { id: "notifications", title: "Notifications", desc: "Manage alerts, preferences, and follow-up actions." },
  { id: "shortcuts", title: "Shortcuts", desc: "Learn the keyboard shortcuts available across the app." },
] as const;

const SECTION_IDS = [...NAV_ITEMS.map((item) => item.id)];

export default function HelpCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const rawHash = location.hash || (typeof window !== "undefined" ? window.location.hash : "");
  const hashId = rawHash.replace(/^#/, "");
  const isUnknownHash = Boolean(hashId) && !HELP_ANCHORS.has(hashId);
  const [openFaqId, setOpenFaqId] = useState<string | null>(() => {
    return hashId && FAQ.some((f) => f.id === hashId) ? hashId : null;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounceValue(searchQuery, 300);
  const activeSection = useActiveSection(SECTION_IDS);
  const navRef = useRef<HTMLElement>(null);
  const { isReducedMotionActive } = useReducedMotion();

  const filteredFaqs = useMemo(() => {
    return searchFaq(FAQ, searchQuery);
  }, [searchQuery]);

  const visibleCategories = useMemo(() => {
    const isSearching = searchQuery.trim().length > 0;
    if (!isSearching) return categories;
    return categories.filter((cat) =>
      filteredFaqs.some((faq) => faq.sectionId === cat.id),
    );
  }, [searchQuery, filteredFaqs]);

  const announcement = useMemo(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) return "";
    const count = filteredFaqs.length;
    return count === 0 ? "No results" : `${count} result${count === 1 ? "" : "s"}`;
  }, [debouncedQuery, filteredFaqs.length]);

  const activeFaqId = openFaqId;

  useEffect(() => {
    const currentRawHash = location.hash || (typeof window !== "undefined" ? window.location.hash : "");
    if (!currentRawHash) return;

    const targetId = currentRawHash.replace(/^#/, "");
    if (!HELP_ANCHORS.has(targetId)) return;

    const targetFaq = FAQ.find((item) => item.id === targetId);
    if (targetFaq) {
      setOpenFaqId(targetFaq.id);
    }

    const target = document.getElementById(targetId);
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: isReducedMotionActive ? "instant" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [location.hash, isReducedMotionActive]);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      e.preventDefault();
      if (!HELP_ANCHORS.has(sectionId)) return;

      navigate({ hash: sectionId }, { replace: false });

      const target = document.getElementById(sectionId);
      if (!target) return;

      target.scrollIntoView({
        behavior: isReducedMotionActive ? "instant" : "smooth",
        block: "start",
      });
    },
    [isReducedMotionActive, navigate],
  );

  const handleFaqAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, faqId: string) => {
      e.preventDefault();
      if (!HELP_ANCHORS.has(faqId)) return;

      setOpenFaqId(faqId);
      navigate({ hash: faqId }, { replace: false });

      const target = document.getElementById(faqId);
      if (target) {
        target.scrollIntoView({
          behavior: isReducedMotionActive ? "instant" : "smooth",
          block: "start",
        });
      }
    },
    [isReducedMotionActive, navigate],
  );

  const handleFaqToggle = useCallback(
    (faqId: string) => {
      const isClosing = openFaqId === faqId;
      setOpenFaqId(isClosing ? null : faqId);
      if (isClosing && hashId === faqId) {
        navigate({ hash: "" }, { replace: true });
      }
    },
    [openFaqId, hashId, navigate],
  );

  return (
    <div className="help-center">
      <div className="help-center__layout">
        <nav
          id="help-topics"
          ref={navRef}
          className="help-center__nav"
          aria-label="Help topics"
          tabIndex={-1}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="help-center__nav-link"
              aria-current={activeSection === item.id ? "true" : undefined}
              onClick={(e) => handleNavClick(e, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="help-center__content">
          <h1 className="help-center__title">Help Center</h1>
          <p className="help-center__subtitle">
            Browse help topics, wallet walkthroughs, and keyboard tips without
            loading third-party media until you ask for it.
          </p>

          {isUnknownHash && (
            <div className="help-center__notice" role="status">
              <span>That help topic was not found. </span>
              <a
                href="#getting-started"
                className="help-center__notice-link"
                onClick={(e) => handleNavClick(e, "getting-started")}
              >
                Browse the topic list
              </a>
            </div>
          )}

          <form
            role="search"
            className="help-center__search"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor="help-center-search" className="visually-hidden">
              Search help
            </label>
            <Search className="help-center__search-icon" aria-hidden="true" />
            <input
              id="help-center-search"
              type="search"
              className="help-center__search-input"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchQuery("");
                }
              }}
            />
          </form>

          <div
            className="visually-hidden"
            aria-live="polite"
            role="status"
            aria-atomic="true"
          >
            {announcement}
          </div>

          <div className="help-center__grid">
            {visibleCategories.map((cat) => (
              <div
                key={cat.id}
                id={cat.id}
                tabIndex={-1}
                className="help-center__card"
              >
                <h3 className="help-center__card-title">{cat.title}</h3>
                <p className="help-center__card-desc">{cat.desc}</p>
              </div>
            ))}
          </div>

          <div className="help-center__support">
            <h2 className="help-center__support-title">Contact Support</h2>
            <p className="help-center__support-subtitle">
              Send us details about your issue. Attach a file if it helps (logs, screenshots, PDFs).
            </p>

            <SupportForm
              onSubmit={async () => {
                // This screen only demonstrates the form; the caller can wire to a real API.
              }}
              maxAttachmentBytes={5 * 1024 * 1024}
              acceptedAttachmentTypes={[".png", ".jpg", ".jpeg", ".pdf"]}
            />
          </div>

          <div id="faq" tabIndex={-1} className="help-center__faq">
            <h2 className="help-center__faq-title">FAQ</h2>

            {filteredFaqs.map((item) => {
              const isOpen = openFaqId === item.id;
              const isCurrent = activeFaqId === item.id;

              return (
                <div
                  key={item.id}
                  id={item.id}
                  tabIndex={-1}
                  className="help-center__faq-item"
                >
                  <div className="help-center__faq-header">
                    <Tooltip label="Copy link"><a
                      href={`#${item.id}`}
                      className="help-center__faq-anchor"
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Direct link to FAQ: ${item.question}`}
                      onClick={(e) => handleFaqAnchorClick(e, item.id)}
                    >
                      #
                      </a>
                    </Tooltip>
                    <button
                      onClick={() => handleFaqToggle(item.id)}
                      className="help-center__faq-btn"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${item.id}`}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <span>
                        <span className="help-center__faq-q">{item.question}</span>
                        <span className="help-center__faq-category">
                          {categories.find((category) => category.id === item.sectionId)?.title}
                        </span>
                      </span>
                      <ChevronDown
                        className={`help-center__faq-chevron${isOpen ? " help-center__faq-chevron--open" : ""}`}
                      />
                    </button>
                  </div>
                  {isOpen && (
                    <div id={`faq-answer-${item.id}`} className="help-center__faq-answer">
                      <p>{item.answer}</p>
                      <CopyToClipboard
                        value={item.answer}
                        ariaLabel={`Copy answer for ${item.question}`}
                        copyLabel="Copy answer"
                        copiedLabel="Answer copied"
                        errorLabel="Copy failed"
                        className="help-center__faq-copy"
                      />
                      {item.videoId && (
                        <VideoThumbnail
                          title={item.question}
                          videoId={item.videoId}
                          transcriptUrl={item.transcriptUrl}
                        />
                      )}
                      {!item.videoId && item.transcriptUrl && (
                        <a
                          href={item.transcriptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="help-center__faq-transcript"
                        >
                          Read transcript
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <p className="help-center__empty">
                No help articles match that search yet. Try "wallet", "shortcut",
                or "transactions".
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
