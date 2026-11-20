const SUPPORTED_OTP_TYPES = new Set([
  "signup",
  "email",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
  "sms",
  "phone_change",
  "reauthentication",
]);

export function getSafeAuthNext(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\\\")) {
    return "/";
  }
  return value;
}

export function isSupportedOtpType(value) {
  return SUPPORTED_OTP_TYPES.has(value);
}
