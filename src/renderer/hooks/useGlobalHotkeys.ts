import { useEffect, useCallback } from 'react';
import { useCollectionActions, useCollectionStore, selectRequest } from '@/state/collectionStore';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';

interface UseGlobalHotkeysProps {
  onSendRequest?: () => void;
  onSaveRequest?: () => void;
  onSwitchRequestTab?: (tabIndex: number) => void;
  onSwitchResponseTab?: (tabIndex: number) => void;
  onCreateNewRequest?: () => void;
  onShowHelp?: () => void;
}

export function useGlobalHotkeys({
  onSendRequest,
  onSaveRequest,
  onSwitchRequestTab,
  onSwitchResponseTab,
  onCreateNewRequest,
  onShowHelp,
}: UseGlobalHotkeysProps = {}) {
  const { setSelectedRequest, setFolderOpen } = useCollectionActions();

  const navigateToAdjacentRequest = useCallback(
    (direction: 'up' | 'down') => {
      const state = useCollectionStore.getState();
      const selectedRequestId = state.selectedRequestId;
      const collection = state.collection;
      const folders = state.folders;

      if (!selectedRequestId || !collection?.children) return;

      const getAllRequestsInOrder = (children: (Folder | TrufosRequest)[]): string[] => {
        const result: string[] = [];
        for (const child of children) {
          if (child.type === 'request') {
            result.push(child.id);
          } else if (child.type === 'folder') {
            result.push(...getAllRequestsInOrder(child.children || []));
          }
        }
        return result;
      };

      const orderedRequestIds = getAllRequestsInOrder(collection.children);
      const currentIndex = orderedRequestIds.indexOf(selectedRequestId);

      if (currentIndex === -1 || orderedRequestIds.length === 0) return;

      let nextIndex;
      if (direction === 'up') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : orderedRequestIds.length - 1;
      } else {
        nextIndex = currentIndex < orderedRequestIds.length - 1 ? currentIndex + 1 : 0;
      }

      const nextRequestId = orderedRequestIds[nextIndex];
      if (nextRequestId) {
        const targetRequest = state.requests.get(nextRequestId);

        if (targetRequest) {
          let currentParentId = targetRequest.parentId;
          while (currentParentId && currentParentId !== collection.id) {
            const parentFolder = folders.get(currentParentId);
            if (parentFolder) {
              setFolderOpen(currentParentId);
              currentParentId = parentFolder.parentId;
            } else {
              break;
            }
          }
        }

        setSelectedRequest(nextRequestId);
      }
    },
    [setSelectedRequest, setFolderOpen]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (!isCtrlOrCmd) return;

      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]');

      switch (event.key.toLowerCase()) {
        case 'enter':
          if (onSendRequest && !isInInput) {
            preventDefault();
            onSendRequest();
          }
          break;

        case 'pageup':
          if (!isInInput) {
            preventDefault();
            navigateToAdjacentRequest('up');
          }
          break;

        case 'pagedown':
          if (!isInInput) {
            preventDefault();
            navigateToAdjacentRequest('down');
          }
          break;

        case 'n':
          if (!isInInput && onCreateNewRequest) {
            preventDefault();
            onCreateNewRequest();
          }
          break;

        case 's':
          if (!isInInput) {
            const state = useCollectionStore.getState();
            const currentRequest = selectRequest(state);
            if (onSaveRequest && currentRequest?.draft) {
              preventDefault();
              onSaveRequest();
            }
          }
          break;

        case '1':
          if (!isInInput) {
            preventDefault();
            onSwitchRequestTab?.(0);
          }
          break;

        case '2':
          if (!isInInput) {
            preventDefault();
            onSwitchRequestTab?.(1);
          }
          break;

        case '3':
          if (!isInInput) {
            preventDefault();
            onSwitchRequestTab?.(2);
          }
          break;

        case '4':
          if (!isInInput) {
            preventDefault();
            onSwitchRequestTab?.(3);
          }
          break;

        case '5':
          if (!isInInput) {
            preventDefault();
            onSwitchResponseTab?.(0);
          }
          break;

        case '6':
          if (!isInInput) {
            preventDefault();
            onSwitchResponseTab?.(1);
          }
          break;
      }
    },
    [
      onSendRequest,
      onSaveRequest,
      onSwitchRequestTab,
      onSwitchResponseTab,
      onCreateNewRequest,
      onShowHelp,
      navigateToAdjacentRequest,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}
