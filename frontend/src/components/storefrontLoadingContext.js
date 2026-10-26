import { createContext, useContext, useLayoutEffect, useRef } from 'react';

export const StorefrontLoadingContext = createContext(null);

export function useStorefrontPending(pending) {
  const register = useContext(StorefrontLoadingContext);
  const token = useRef({});
  useLayoutEffect(
    () => (pending ? register?.(token.current) : undefined),
    [pending, register]
  );
}
