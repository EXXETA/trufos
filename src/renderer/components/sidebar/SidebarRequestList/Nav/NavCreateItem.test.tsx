import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NavCreateItem } from './NavCreateItem';

const addNewFolderMock = vi.fn();
const addNewRequestMock = vi.fn();
const setCreatingItemMock = vi.fn();

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    addNewFolder: addNewFolderMock,
    addNewRequest: addNewRequestMock,
    setCreatingItem: setCreatingItemMock,
  }),
}));

describe('NavCreateItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a folder creation input', () => {
    render(<NavCreateItem type="folder" parentId="col-1" depth={1} />);
    expect(screen.getByRole('textbox')).toBeDefined();
    // folder shouldn't render 'GET' method badge
    expect(screen.queryByText('GET')).toBeNull();
  });

  it('renders a request creation input with GET badge', () => {
    render(<NavCreateItem type="request" parentId="col-1" depth={1} />);
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.getByText('GET')).toBeDefined();
  });

  it('calls addNewFolder and setCreatingItem on save when type is folder', async () => {
    const user = userEvent.setup();
    render(<NavCreateItem type="folder" parentId="col-1" depth={1} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'New Folder');
    await user.type(input, '{Enter}');
    
    await waitFor(() => {
      expect(addNewFolderMock).toHaveBeenCalledWith('New Folder', 'col-1');
      expect(setCreatingItemMock).toHaveBeenCalledWith(null);
    });
  });

  it('calls addNewRequest and setCreatingItem on save when type is request', async () => {
    const user = userEvent.setup();
    render(<NavCreateItem type="request" parentId="col-2" depth={2} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'New Request');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(addNewRequestMock).toHaveBeenCalledWith('New Request', 'col-2');
      expect(setCreatingItemMock).toHaveBeenCalledWith(null);
    });
  });

  it('calls setCreatingItem(null) on cancel', async () => {
    const user = userEvent.setup();
    render(<NavCreateItem type="folder" parentId="col-1" depth={1} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(setCreatingItemMock).toHaveBeenCalledWith(null);
    expect(addNewFolderMock).not.toHaveBeenCalled();
    expect(addNewRequestMock).not.toHaveBeenCalled();
  });

  it('ignores save if input is empty or whitespace', async () => {
    const user = userEvent.setup();
    render(<NavCreateItem type="request" parentId="col-1" depth={1} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, '   {Enter}'); // only spaces
    
    expect(addNewRequestMock).not.toHaveBeenCalled();
    expect(setCreatingItemMock).not.toHaveBeenCalled();
  });
});
