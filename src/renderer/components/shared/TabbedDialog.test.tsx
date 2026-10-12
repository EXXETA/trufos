import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabbedDialog } from './TabbedDialog';

const tabs = [
  { value: 'first', label: 'First', content: <p>first content</p> },
  { value: 'second', label: 'Second', content: <p>second content</p> },
];

describe('TabbedDialog', () => {
  it('should show the title and open the first tab', () => {
    render(<TabbedDialog title="Settings" isOpen onClose={vi.fn()} tabs={tabs} />);

    screen.getByRole('heading', { name: 'Settings' });
    screen.getByText('first content');
    expect(screen.queryByText('second content')).toBeNull();
  });

  it('should switch between tabs', async () => {
    render(<TabbedDialog title="Settings" isOpen onClose={vi.fn()} tabs={tabs} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Second' }));

    screen.getByText('second content');
  });

  it('should show the footer', () => {
    render(
      <TabbedDialog
        title="Settings"
        isOpen
        onClose={vi.fn()}
        tabs={tabs}
        footer={<button>Save</button>}
      />
    );

    screen.getByRole('button', { name: 'Save' });
  });

  it('should close when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(<TabbedDialog title="Settings" isOpen onClose={onClose} tabs={tabs} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
