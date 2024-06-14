import { configureStore } from '@reduxjs/toolkit';
import { viewSlice } from '@/state/view';

export const store = configureStore({
  reducer: { [viewSlice.name]: viewSlice.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware()
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;