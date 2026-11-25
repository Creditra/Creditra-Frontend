import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import {
  LimitIncreaseModal,
  type LimitIncreaseSubmission,
} from './LimitIncreaseModal';

const line = MOCK_CREDIT_LINES[0];

vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

function ModalHarness({
  onSubmit = vi.fn(),
}: {
  onSubmit?: (value: LimitIncreaseSubmission) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Open request
      </button>
      {open && (
        <LimitIncreaseModal
          line={line}
          maxRequestable={10000}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}

describe('LimitIncreaseModal', () => {
  it('shows projected limit and utilization and submits a valid request', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ModalHarness onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Open request' }));

    const amount = screen.getByLabelText('Requested amount');
    await user.type(amount, '1000');
    await user.selectOptions(screen.getByLabelText('Reason'), 'Working capital');

    expect(screen.getByText('Increase requested').parentElement).toHaveTextContent('$1,000');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 1000,
      reason: 'Working capital',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Request submitted');
  });

  it.each(['0', '-1', '10001', 'not-a-number'])(
    'rejects invalid amount %s',
    async (value) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<ModalHarness onSubmit={onSubmit} />);
      await user.click(screen.getByRole('button', { name: 'Open request' }));
      await user.type(screen.getByLabelText('Requested amount'), value);
      await user.selectOptions(screen.getByLabelText('Reason'), 'Other');
      await user.click(screen.getByRole('button', { name: 'Submit request' }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/amount/i);
    },
  );

  it('requires a reason and returns keyboard focus to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open request' });
    await user.click(trigger);
    await user.type(screen.getByLabelText('Requested amount'), '500');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/select a reason/i);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('surfaces storage errors without showing a success state', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => {
      throw new Error('Storage unavailable');
    });
    render(<ModalHarness onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Open request' }));
    await user.type(screen.getByLabelText('Requested amount'), '500');
    await user.selectOptions(screen.getByLabelText('Reason'), 'Other');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(screen.queryByText('Request submitted')).not.toBeInTheDocument();
  });
});
