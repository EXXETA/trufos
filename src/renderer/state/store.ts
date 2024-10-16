import { configureStore } from '@reduxjs/toolkit';
import { viewSlice } from '@/state/viewSlice';
import { requestsSlice } from "@/state/requestsSlice";
import { headersReducer } from "@/state/headersSlice"; // Adjust the import path

export const store = configureStore({
  reducer: {
    [viewSlice.name]: viewSlice.reducer,
    [requestsSlice.name]: requestsSlice.reducer,
    headers: headersReducer,
  },
  middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['view/setRequestEditor'],
          ignoredPaths: ['view.requestEditor'],
        },
      }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

