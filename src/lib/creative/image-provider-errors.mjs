const DEFAULT_FAILURE = "Aahana could not generate that image. Please try again.";

export function classifyCloudflareImageFailure(status, errors = []) {
  const firstError = Array.isArray(errors) ? errors[0] : null;
  const code = String(firstError?.code ?? "");
  const providerMessage = typeof firstError?.message === "string" ? firstError.message : "";
  const normalizedMessage = providerMessage.toLowerCase();

  if (status === 429) {
    return { status: 429, message: "The image-generation service has reached its current usage limit. Please try again after it resets.", code };
  }
  if (status === 401) {
    return { status: 502, message: "Aahana's image provider could not authenticate this request. Please contact support.", code };
  }
  if (status === 403) {
    return { status: 502, message: "Aahana's image provider is not currently permitted to process this request. Please contact support.", code };
  }
  if (status === 400 && (code === "3030" || normalizedMessage.includes("input prompt contains nsfw content"))) {
    return {
      status: 422,
      message: "The image provider's automated safety filter blocked this request. It can sometimes misclassify harmless anime or fictional-character prompts. Try a different description, or contact Aahana support if it keeps happening.",
      code,
    };
  }
  if (status === 400 || status === 422) {
    return {
      status: 422,
      message: "The image provider could not process this request. This does not necessarily mean your prompt is too long or unclear.",
      code,
    };
  }
  if (status >= 500) {
    return { status: 503, message: "The image provider is temporarily unavailable. Please try again shortly.", code };
  }
  return { status: 502, message: DEFAULT_FAILURE, code };
}
