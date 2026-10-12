import { useActions } from '@/state/helper/util';
import { TrufosResponse } from 'shim/objects/response';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** A map of requestId => response */
type ResponseInfoMap = Record<string, TrufosResponse>;

interface ResponseState {
  responseInfoMap: ResponseInfoMap;
  addResponse: (requestId: string, response: TrufosResponse) => void;
  removeResponse: (requestId: string) => void;
}

export const useResponseStore = create<ResponseState>()(
  immer((set) => ({
    responseInfoMap: {},
    addResponse: (requestId, response) =>
      set((state) => {
        state.responseInfoMap[requestId] = response;
      }),
    removeResponse: (requestId) =>
      set((state) => {
        delete state.responseInfoMap[requestId];
      }),
  }))
);

export const selectResponse = (state: ResponseState, requestId: string | undefined) =>
  requestId != null ? state.responseInfoMap[requestId] : undefined;
export const useResponseActions = () => useResponseStore(useActions());
