import { useEffect, useState } from "react";

export function useAsyncValue(load, dependencies) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    setState((current) => ({
      data: current.data,
      error: null,
      isLoading: true,
    }));

    Promise.resolve()
      .then(load)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setState({
          data,
          error: null,
          isLoading: false,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          data: null,
          error,
          isLoading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return state;
}
