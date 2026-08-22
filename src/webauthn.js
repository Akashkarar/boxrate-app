import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { supabase } from "./supabaseClient.js";

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    try {
      if (error.context?.json) {
        const parsed = await error.context.json();
        detail = parsed?.error || detail;
      }
    } catch {
      /* fall back to error.message */
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function registerBiometric(deviceName) {
  const options = await callFn("webauthn-register-options", {});
  const response = await startRegistration({ optionsJSON: options });
  await callFn("webauthn-register-verify", { response, deviceName });
}

export async function verifyBiometric() {
  const options = await callFn("webauthn-auth-options", {});
  const response = await startAuthentication({ optionsJSON: options });
  await callFn("webauthn-auth-verify", { response });
}

export async function hasRegisteredBiometric(userId) {
  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (error) return false;
  return (data?.length || 0) > 0;
}
