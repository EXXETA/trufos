import { render, fireEvent } from '@testing-library/react';
import { NamingModal } from './NamingModal';
import { vi, describe, it, expect, afterEach } from 'vitest';

const addNewRequestMock = vi.fn();
const addNewFolderMock = vi.fn();

// Mock the collection actions hook (must come after mock function declarations)
vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    renameFolder: vi.fn(),
    renameRequest: vi.fn(),
    addNewRequest: addNewRequestMock,
    addNewFolder: addNewFolderMock,
  }),
}));

describe('NamingModal creation behavior', () => {
  afterEach(() => {
    addNewRequestMock.mockClear();
    addNewFolderMock.mockClear();
  });

  it("calls addNewRequest when createType='request' even if parent object is a folder", () => {
    const parentFolder = {
      id: 'folder-1',
      parentId: 'root',
      type: 'folder' as const,
      title: 'Parent Folder',
      children: [] as any[],
    };

    const { getByPlaceholderText, getByText } = render(
      <NamingModal createType="request" trufosObject={parentFolder} onClose={() => {}} />
    );

    const input = getByPlaceholderText('Enter the request name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My Request' } });
    fireEvent.click(getByText('Save'));

    expect(addNewRequestMock).toHaveBeenCalledWith('My Request', 'folder-1');
    expect(addNewFolderMock).not.toHaveBeenCalled();
  });
});
