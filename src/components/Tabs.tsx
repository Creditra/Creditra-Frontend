import React, { KeyboardEvent, ReactNode, useId, useRef } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  ariaLabel: string;
  className?: string;
  tabListClassName?: string;
  tabClassName?: string;
  panelClassName?: string;
}

/**
 * Accessible controlled tabs following the WAI-ARIA tabs pattern.
 * Selection follows focus when navigating with Arrow, Home, or End keys.
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
  className,
  tabListClassName,
  tabClassName,
  panelClassName,
}) => {
  const instanceId = useId().replace(/:/g, '');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledIndexes = tabs
    .map((tab, index) => (tab.disabled ? -1 : index))
    .filter((index) => index !== -1);
  const selectedIndex = tabs.findIndex((tab) => tab.id === activeTab && !tab.disabled);

  const selectTab = (index: number) => {
    const tab = tabs[index];
    if (!tab || tab.disabled) return;

    onTabChange(tab.id);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();

    const enabledPosition = enabledIndexes.indexOf(index);
    if (enabledPosition === -1 || enabledIndexes.length === 0) return;

    if (event.key === 'Home') {
      selectTab(enabledIndexes[0]);
    } else if (event.key === 'End') {
      selectTab(enabledIndexes[enabledIndexes.length - 1]);
    } else {
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextPosition =
        (enabledPosition + direction + enabledIndexes.length) % enabledIndexes.length;
      selectTab(enabledIndexes[nextPosition]);
    }
  };

  const activePanel = selectedIndex === -1 ? null : tabs[selectedIndex].panel;
  const activeId = selectedIndex === -1 ? undefined : tabs[selectedIndex].id;

  return (
    <div className={className}>
      <div className={tabListClassName} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          const tabId = `${instanceId}-tab-${tab.id}`;
          const panelId = `${instanceId}-panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected || (selectedIndex === -1 && index === enabledIndexes[0]) ? 0 : -1}
              disabled={tab.disabled}
              className={[tabClassName, selected ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeId && (
        <div
          id={`${instanceId}-panel-${activeId}`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-tab-${activeId}`}
          className={panelClassName}
        >
          {activePanel}
        </div>
      )}
    </div>
  );
};

export default Tabs;
