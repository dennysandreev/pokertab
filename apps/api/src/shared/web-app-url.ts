const WEB_APP_CACHE_BUSTER = Date.now().toString(36);

export function appendWebAppCacheBuster(
  webAppUrl: string,
  cacheBuster = WEB_APP_CACHE_BUSTER
): string {
  try {
    const url = new URL(webAppUrl);
    url.searchParams.set("ptb", cacheBuster);

    return url.toString();
  } catch {
    const separator = webAppUrl.includes("?") ? "&" : "?";

    return `${webAppUrl}${separator}ptb=${encodeURIComponent(cacheBuster)}`;
  }
}
