import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import Tabs, { TabItem } from '../Tabs';

const items: TabItem[] = [
  { id: 'overview', label: 'Overview', panel: <p>Overview content</p> },
  { id: 'disabled', label: 'Disabled', panel: <p>Disabled content</p>, disabled: true },
  { id: 'activity', label: 'Activity', panel: <p>Activity content</p> },
];

function TabsHarness() {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <Tabs
      tabs={items}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      ariaLabel="Profile sections"
    />
  );
}

describe('Tabs', () => {
  it('exposes tab semantics and links the selected tab to its panel', () => {
    render(<TabsHarness />);

    const tablist = screen.getByRole('tablist', { name: 'Profile sections' });
    const tabs = within(tablist).getAllByRole('tab');
    const panel = screen.getByRole('tabpanel');

    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id);
    expect(panel).toHaveTextContent('Overview content');
  });

  it('selects a clicked tab and updates the panel', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    await user.click(screen.getByRole('tab', { name: 'Activity' }));

    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Activity content');
  });

  it('wraps arrow navigation and skips disabled tabs', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const activity = screen.getByRole('tab', { name: 'Activity' });
    overview.focus();

    await user.keyboard('{ArrowRight}');
    expect(activity).toHaveFocus();
    expect(activity).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
  });

  it('supports Home and End navigation', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const activity = screen.getByRole('tab', { name: 'Activity' });
    overview.focus();

    await user.keyboard('{End}');
    expect(activity).toHaveFocus();
    await user.keyboard('{Home}');
    expect(overview).toHaveFocus();
  });
});
