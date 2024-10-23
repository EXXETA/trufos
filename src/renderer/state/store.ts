import { configureStore } from '@reduxjs/toolkit';
import { requestsSlice } from '@/state/requestsSlice';
import { responsesSlice } from '@/state/responsesSlice'; // Adjust the import path

export const store = configureStore({
  reducer: {
    [requestsSlice.name]: requestsSlice.reducer,
    [responsesSlice.name]: responsesSlice.reducer,
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
