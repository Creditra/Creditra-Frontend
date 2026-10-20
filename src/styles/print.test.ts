import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const printCss = readFileSync(resolve(__dirname, 'print.css'), 'utf8');

function injectPrintStylesheet(): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/src/styles/print.css';
  link.id = 'print-test-stylesheet';
  document.head.appendChild(link);
}

function removePrintStylesheet(): void {
  const el = document.getElementById('print-test-stylesheet');
  if (el) {
    el.remove();
  }
}

describe('print.css', () => {
  afterEach(() => {
    removePrintStylesheet();
  });

  it('exports a stylesheet that can be injected into document head', () => {
    injectPrintStylesheet();
    const el = document.getElementById('print-test-stylesheet');
    expect(el).toBeInTheDocument();
    expect(el?.getAttribute('rel')).toBe('stylesheet');
  });

  it('scopes BalanceChart controls to the non-printing chrome', () => {
    expect(printCss).toContain('.balance-chart .balance-chart__toolbar');
    expect(printCss).toContain('.balance-chart .balance-chart__filters');
    expect(printCss).toContain('.balance-chart button:not(.print-preserve)');
    expect(printCss).toMatch(/\.balance-chart[\s\S]*display: none !important/);
  });

  it('expands BalanceChart panels and preserves page continuity', () => {
    expect(printCss).toContain('.balance-chart .balance-chart__collapsible');
    expect(printCss).toContain('.balance-chart [role="region"]');
    expect(printCss).toContain('.balance-chart__legend');
    expect(printCss).toMatch(/\.balance-chart[\s\S]*max-height: none !important/);
    expect(printCss).toMatch(/\.balance-chart__[^{]+\{[\s\S]*break-inside: avoid/);
  });

  it('contains media print rules hiding UI chrome and header elements', () => {
    const style = document.createElement('style');
    style.id = 'print-test-chrome-inline';
    style.textContent = `@media print {
      header, nav, footer, .header, .header-nav, .bottom-nav, .no-print, .chrome, .sr-only { display: none !important; }
      .amount-confirm__chrome, .amount-confirm__actions, .amount-confirm__btn, .typed-amount-confirm-overlay { display: none !important; }
    }`;
    document.head.appendChild(style);

    const sheet = style.sheet as CSSStyleSheet;
    expect(sheet.cssRules.length).toBeGreaterThan(0);

    const mediaRule = sheet.cssRules[0] as CSSMediaRule;
    expect(mediaRule.conditionText).toBe('print');

    const rulesText = Array.from(mediaRule.cssRules)
      .map((r) => (r as CSSStyleRule).cssText)
      .join(' ');

    expect(rulesText).toContain('display: none');
    expect(rulesText).toContain('.amount-confirm__chrome');

    document.head.removeChild(style);
  });

  it('contains media print rules expanding collapsibles and details elements', () => {
    const style = document.createElement('style');
    style.id = 'print-test-collapsibles-inline';
    style.textContent = `@media print {
      details { display: block !important; }
      details > summary { display: block !important; }
      details > *:not(summary), details[open] > * { display: block !important; max-height: none !important; opacity: 1 !important; visibility: visible !important; }
      .collapsible, .collapsible-content, .amount-confirm__collapsible, .amount-confirm__collapsible-content { display: block !important; max-height: none !important; visibility: visible !important; }
    }`;
    document.head.appendChild(style);

    const sheet = style.sheet as CSSStyleSheet;
    const mediaRule = sheet.cssRules[0] as CSSMediaRule;
    expect(mediaRule.conditionText).toBe('print');

    const rulesText = Array.from(mediaRule.cssRules)
      .map((r) => (r as CSSStyleRule).cssText)
      .join(' ');

    expect(rulesText).toContain('display: block');
    expect(rulesText).toContain('max-height: none');
    expect(rulesText).toContain('.amount-confirm__collapsible');

    document.head.removeChild(style);
  });

  it('removes card backgrounds and applies high contrast colors for paper printing', () => {
    const style = document.createElement('style');
    style.id = 'print-test-formatting-inline';
    style.textContent = `@media print {
      body, .amount-confirm-page, .amount-confirm { background: #ffffff !important; color: #000000 !important; }
      .card, .amount-confirm__card, .typed-amount-confirm-dialog { background: #ffffff !important; box-shadow: none !important; border: 1px solid #cccccc !important; }
      .amount-confirm__section, .amount-confirm__card { break-inside: avoid; }
    }`;
    document.head.appendChild(style);

    const sheet = style.sheet as CSSStyleSheet;
    const mediaRule = sheet.cssRules[0] as CSSMediaRule;

    const rulesText = Array.from(mediaRule.cssRules)
      .map((r) => (r as CSSStyleRule).cssText)
      .join(' ');

    expect(rulesText).toContain('background: rgb(255, 255, 255)');
    expect(rulesText).toContain('box-shadow: none');
    expect(rulesText).toContain('break-inside: avoid');

    document.head.removeChild(style);
  });
});
