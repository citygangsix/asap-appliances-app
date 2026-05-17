import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getSupabaseClient,
  getSupabaseConfig,
  isSupabaseConfigured,
} from "../../integrations/supabase/client";

const DashboardAuthContext = createContext(null);

function buildMissingConfigMessage() {
  const config = getSupabaseConfig();
  const missingKeys = [
    config.url ? null : "VITE_SUPABASE_URL",
    config.anonKey ? null : "VITE_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  return `Supabase Auth is not configured. Missing ${missingKeys.join(" and ")}.`;
}

function getConfiguredAuthClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return getSupabaseClient();
}

function buildAuthenticatedState(session) {
  return {
    status: "authenticated",
    session,
    user: session?.user || null,
    message: "",
  };
}

function buildUnauthenticatedState() {
  return {
    status: "unauthenticated",
    session: null,
    user: null,
    message: "",
  };
}

function buildConfigurationErrorState() {
  return {
    status: "configuration_error",
    session: null,
    user: null,
    message: buildMissingConfigMessage(),
  };
}

export function getDashboardAuthConfigurationStatus() {
  return {
    configured: isSupabaseConfigured(),
    message: isSupabaseConfigured() ? "" : buildMissingConfigMessage(),
  };
}

export async function getDashboardAccessToken() {
  const authClient = getConfiguredAuthClient();

  if (!authClient) {
    throw new Error(buildMissingConfigMessage());
  }

  const { data, error } = await authClient.auth.getSession();

  if (error) {
    throw new Error(error.message || "Could not read the Supabase Auth session.");
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Dashboard sign-in is required before using this API route.");
  }

  return accessToken;
}

export function DashboardAuthProvider({ children }) {
  const [authState, setAuthState] = useState(() =>
    isSupabaseConfigured()
      ? {
          status: "checking",
          session: null,
          user: null,
          message: "",
        }
      : buildConfigurationErrorState(),
  );

  useEffect(() => {
    const authClient = getConfiguredAuthClient();

    if (!authClient) {
      setAuthState(buildConfigurationErrorState());
      return undefined;
    }

    let isMounted = true;

    authClient.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({
          status: "error",
          session: null,
          user: null,
          message: error.message || "Could not read the Supabase Auth session.",
        });
        return;
      }

      setAuthState(data.session ? buildAuthenticatedState(data.session) : buildUnauthenticatedState());
    });

    const { data: subscriptionData } = authClient.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? buildAuthenticatedState(session) : buildUnauthenticatedState());
    });

    return () => {
      isMounted = false;
      subscriptionData.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    async function signIn(email, password) {
      const authClient = getConfiguredAuthClient();

      if (!authClient) {
        const message = buildMissingConfigMessage();
        setAuthState({ ...buildConfigurationErrorState(), message });
        return { ok: false, message };
      }

      const { data, error } = await authClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return {
          ok: false,
          message: error.message || "The email or password did not match this dashboard.",
        };
      }

      setAuthState(
        data.session ? buildAuthenticatedState(data.session) : buildUnauthenticatedState(),
      );

      return { ok: true, session: data.session, user: data.user };
    }

    async function signOut() {
      const authClient = getConfiguredAuthClient();

      if (authClient) {
        await authClient.auth.signOut();
      }

      setAuthState(buildUnauthenticatedState());
    }

    return {
      ...authState,
      configured: isSupabaseConfigured(),
      isChecking: authState.status === "checking",
      isAuthenticated: authState.status === "authenticated" && Boolean(authState.session?.access_token),
      signIn,
      signOut,
    };
  }, [authState]);

  return (
    <DashboardAuthContext.Provider value={value}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const context = useContext(DashboardAuthContext);

  if (!context) {
    throw new Error("useDashboardAuth must be used within DashboardAuthProvider.");
  }

  return context;
}
