import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = still loading, null = signed out
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, profile, loading: session === undefined, signIn, signOut };
}
