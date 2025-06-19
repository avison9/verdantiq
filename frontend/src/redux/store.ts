import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import authSliceReducer from "./slices/authSlice";
import { baseApiSlice } from "./apislices/baseSpiSlice";

const persistConfig = {
  key: "root",
  storage,
};

// Wrap the auth reducer in persistReducer with typed configuration
const persistedAuthReducer = persistReducer(persistConfig, authSliceReducer);

// Configure the store with the typed reducers and middlewares
const store = configureStore({
  reducer: {
    [baseApiSlice.reducerPath]: baseApiSlice.reducer,
    auth: persistedAuthReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApiSlice.middleware),
  devTools: true,
});

// Export the persistor and store
export const persistor = persistStore(store);
export default store;

// Define types for state and dispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
