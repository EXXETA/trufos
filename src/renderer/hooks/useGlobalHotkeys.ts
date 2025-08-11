import { useEffect, useCallback } from 'react';
import { useCollectionActions, useCollectionStore, selectRequest } from '@/state/collectionStore';

interface UseGlobalHotkeysProps {
  onSendRequest?: () => void;
  onSaveRequest?: () => void;
  onSwitchRequestTab?: (tabIndex: number) => void;
  onSwitchResponseTab?: (tabIndex: number) => void;
  onCreateNewRequest?: () => void;
}

export function useGlobalHotkeys({
  onSendRequest,
  onSaveRequest,
  onSwitchRequestTab,
  onSwitchResponseTab,
  onCreateNewRequest,
}: UseGlobalHotkeysProps = {}) {
  const { setSelectedRequest, setFolderOpen } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);
  const collection = useCollectionStore((state) => state.collection);
  const currentRequest = useCollectionStore(selectRequest);
  const folders = useCollectionStore((state) => state.folders);

  const navigateToAdjacentRequest = useCallback(
    (direction: 'up' | 'down') => {
      if (!selectedRequestId || !collection?.children) return;

      const getAllRequestsInOrder = (children: any[]): string[] => {
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
        const store = useCollectionStore.getState();
        const targetRequest = store.requests.get(nextRequestId);

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
    [
      selectedRequestId,
      collection?.children,
      collection?.id,
      setSelectedRequest,
      setFolderOpen,
      folders,
    ]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (!isCtrlOrCmd) return;

      const preventDefault = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      // Check if we're in an input field to avoid conflicts
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
          if (onSaveRequest && currentRequest?.draft && !isInInput) {
            preventDefault();
            onSaveRequest();
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
      navigateToAdjacentRequest,
      currentRequest?.draft,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}
