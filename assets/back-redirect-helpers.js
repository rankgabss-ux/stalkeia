const DEFAULT_PROFILE_PHOTO = "/images/avatars/perfil-sem-foto.jpeg";
const DEFAULT_USERNAME = "perfil_privado";
const LOCAL_IMAGE_PROXY = "/api/proxy/image-proxy.php?url=";

export const BACK_REDIRECT_STORAGE_KEYS = {
  selfie: "stalkea_back_redirect_selfie_v1",
  selfieTakenAt: "stalkea_back_redirect_selfie_taken_at_v1",
  profilePhoto: "stalkea_monitored_profile_photo_v1",
  profileUsername: "stalkea_monitored_profile_username_v1",
  profileName: "stalkea_monitored_profile_name_v1",
};

function safeJsonParse(value) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "");
}

function normalizeDisplayName(explicitName, profile, username) {
  return (
    String(explicitName || "").trim() ||
    String(profile.full_name || profile.name || "").trim() ||
    String(username || "").trim() ||
    "Perfil monitorado"
  );
}

function isInstagramCdnUrl(url) {
  return (
    typeof url === "string" &&
    (url.includes("fbcdn.net") || url.includes("cdninstagram.com"))
  );
}

export function proxifyMonitoredProfilePhoto(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  if (isResolvedImageUrl(url)) {
    return url;
  }

  if (isInstagramCdnUrl(url)) {
    return `${LOCAL_IMAGE_PROXY}${encodeURIComponent(url)}`;
  }

  return url;
}

function isResolvedImageUrl(url) {
  return (
    url.startsWith("/") ||
    url.startsWith("data:") ||
    url.includes(".workers.dev") ||
    url.includes("image-proxy.php")
  );
}

function normalizePhoto(explicitPhoto, profile) {
  return proxifyMonitoredProfilePhoto(
    String(explicitPhoto || "").trim() ||
    String(profile.profile_pic_url || "").trim() ||
    String(profile.profile_pic_url_hd || "").trim() ||
    DEFAULT_PROFILE_PHOTO,
  );
}

export function readMonitoredProfile(storage) {
  const profile = safeJsonParse(storage.getItem("instagram_profile"));
  const rawUsername =
    normalizeUsername(profile.username) ||
    normalizeUsername(storage.getItem(BACK_REDIRECT_STORAGE_KEYS.profileUsername)) ||
    normalizeUsername(storage.getItem("espionado_username")) ||
    normalizeUsername(storage.getItem("username"));
  const username = rawUsername || DEFAULT_USERNAME;
  const hasUsername = Boolean(rawUsername);
  const explicitName =
    String(profile.full_name || profile.name || "").trim() ||
    storage.getItem(BACK_REDIRECT_STORAGE_KEYS.profileName);
  const explicitPhoto =
    String(profile.profile_pic_url || profile.profile_pic_url_hd || "").trim() ||
    storage.getItem(BACK_REDIRECT_STORAGE_KEYS.profilePhoto);

  return {
    username,
    handle: `@${username}`,
    hasUsername,
    displayName: normalizeDisplayName(explicitName, profile, username),
    photoUrl: normalizePhoto(explicitPhoto, profile),
  };
}

export function buildCtaUrl(search = "") {
  if (!search) {
    return "/cta";
  }

  const params = new URLSearchParams(search);
  const serialized = params.toString();

  return serialized ? `/cta?${serialized}` : "/cta";
}

export function buildBackRedirectUrl(search = "") {
  if (!search) {
    return "/back-redirect/";
  }

  const params = new URLSearchParams(search);
  const serialized = params.toString();

  return serialized
    ? `/back-redirect/?${serialized}`
    : "/back-redirect/";
}

function readStUserIdCookie(cookieDocument) {
  const doc =
    cookieDocument ?? (typeof document !== "undefined" ? document : null);
  if (!doc) {
    return null;
  }

  const match = doc.cookie.match(/(?:^|;\s*)st_user_id=([^;]*)/);
  const value = match ? decodeURIComponent(match[1].trim()) : "";
  return value || null;
}

export function buildCheckoutUrl(baseUrl, search = "", cookieDocument) {
  const url = new URL(baseUrl);
  const params = new URLSearchParams(search);

  for (const [key, value] of params.entries()) {
    if (key !== "sck") {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("sck", readStUserIdCookie(cookieDocument) ?? "null");

  return url.toString();
}

export function getInitialBackRedirectStage(selfieDataUrl = "") {
  return String(selfieDataUrl || "").trim() ? "identified" : "camera";
}

export function isCameraPermissionDenied(errorName = "") {
  return (
    errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
  );
}

export function getCameraFrameVariant(cameraStatus = "", cameraDenied = false) {
  if (cameraStatus === "requesting") {
    return "requesting";
  }

  if (cameraStatus === "streaming") {
    return "streaming";
  }

  if (cameraDenied) {
    return "generic";
  }

  return "placeholder";
}

export function getDefaultProfilePhoto() {
  return DEFAULT_PROFILE_PHOTO;
}
