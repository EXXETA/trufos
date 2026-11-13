const API_BASE = "https://api.github.com";
const REPOSITORY = "EXXETA/trufos";

const platformConfig = [
  {
    key: "mac-arm64",
    os: "mac",
    arch: "arm",
    label: "macOS (Apple Silicon)",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}-arm64.dmg`) {
        return true;
      }
      return /arm64.*\.dmg$/i.test(name);
    },
  },
  {
    key: "mac-intel",
    os: "mac",
    arch: "x86",
    label: "macOS (Intel)",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}-x64.dmg`) {
        return true;
      }
      return /(x64|intel).*\.dmg$/i.test(name);
    },
  },
  {
    key: "linux-deb",
    os: "linux",
    label: "Linux (DEB)",
    matcher: (name, version) => {
      if (version && name === `trufos_${version}_amd64.deb`) {
        return true;
      }
      return /amd64.*\.deb$/i.test(name);
    },
  },
  {
    key: "linux-zip",
    os: "linux",
    label: "Linux (ZIP)",
    matcher: (name, version) => {
      if (version && name === `Trufos-linux-x64-${version}.zip`) {
        return true;
      }
      return /linux.*\.zip$/i.test(name);
    },
  },
  {
    key: "windows-setup",
    os: "windows",
    label: "Windows (Setup EXE)",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}.Setup.exe`) {
        return true;
      }
      return /setup.*\.exe$/i.test(name);
    },
  },
];

/**
 * Detects the visitor's desktop OS and, where the browser exposes it, the CPU architecture.
 * Phones and tablets get `os: null`, as there is no installer for them.
 * @returns {Promise<{ os: "mac" | "windows" | "linux" | null, arch: "arm" | "x86" | null }>}
 */
const detectPlatform = async () => {
  const ua = navigator.userAgent || "";
  const uaData = navigator.userAgentData;
  const platform = (uaData?.platform || navigator.platform || "").toLowerCase();

  let os = null;
  if (uaData?.mobile || /android|iphone|ipad|ipod/i.test(ua)) {
    os = null;
  } else if (platform.startsWith("mac") || /macintosh|mac os x/i.test(ua)) {
    // iPadOS Safari reports itself as a Mac, but has a touch screen
    os = navigator.maxTouchPoints > 1 ? null : "mac";
  } else if (platform.startsWith("win") || /windows/i.test(ua)) {
    os = "windows";
  } else if (platform.includes("linux") || /linux|x11/i.test(ua)) {
    os = "linux";
  }

  // Only Chromium exposes the architecture; Safari and Firefox always claim "Intel" on macOS.
  let arch = null;
  if (os === "mac" && uaData?.getHighEntropyValues) {
    try {
      const { architecture } = await uaData.getHighEntropyValues(["architecture"]);
      if (architecture === "arm" || architecture === "x86") {
        arch = architecture;
      }
    } catch {
      // ignore: falls back to the default below
    }
  }

  return { os, arch };
};

/**
 * Picks the installers to highlight for a platform: Apple Silicon is the default on macOS
 * when the architecture is unknown, and DEB is the default on Linux.
 * @returns {Set<string>} keys from platformConfig
 */
const recommendedKeys = ({ os, arch }) => {
  switch (os) {
    case "windows":
      return new Set(["windows-setup"]);
    case "mac":
      return new Set([arch === "x86" ? "mac-intel" : "mac-arm64"]);
    case "linux":
      return new Set(["linux-deb"]);
    default:
      return new Set();
  }
};

// Only what the "Recommended for you" badge cannot say on its own.
const detectionHint = ({ os, arch }) => {
  switch (os) {
    case "mac":
      return arch
        ? ""
        : "On an Intel Mac, pick the Intel build instead (Apple menu > About This Mac shows your chip).";
    case "linux":
      return "On distributions without DEB packages, use the ZIP archive.";
    default:
      return "";
  }
};

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

const setStatus = (container, message) => {
  // set content of child element with ID "status"
  const statusElement = container.querySelector(".status");
  if (statusElement) {
    statusElement.textContent = message;
  }
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const extractVersion = (release) => {
  const candidate = release.tag_name || release.name || "";
  const match = candidate.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : "";
};

const findAsset = (assets, matcher, version) => {
  if (!Array.isArray(assets)) {
    return null;
  }

  return assets.find((asset) => matcher(asset.name || "", version)) || null;
};

const renderCard = (config, asset, recommended) => {
  if (!asset) {
    return `
      <div class="release-item release-item--disabled">
        <p class="release-item__label">${config.label}</p>
        <span class="release-item__state">Not available</span>
      </div>
    `;
  }

  return `
    <a class="release-item${recommended ? " release-item--recommended" : ""}" href="${escapeHtml(asset.browser_download_url)}" rel="noopener">
      ${recommended ? '<span class="release-item__badge">Recommended for you</span>' : ""}
      <p class="release-item__label">${config.label}</p>
      <p class="release-item__hint">${escapeHtml(asset.name)}</p>
      <span class="release-item__state">Download</span>
    </a>
  `;
};

const renderLatestRelease = (container, release, platform) => {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const version = extractVersion(release);
  const dateLabel = formatDate(release.published_at || release.created_at);
  const recommended = recommendedKeys(platform);

  const entries = platformConfig.map((config) => ({
    config,
    asset: findAsset(assets, config.matcher, version),
  }));
  const isRecommended = ({ config, asset }) => Boolean(asset) && recommended.has(config.key);

  // recommended installers first, then the rest of the visitor's OS, then everything else
  const rank = (entry) => (isRecommended(entry) ? 0 : entry.config.os === platform.os ? 1 : 2);
  const cards = entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => rank(a) - rank(b) || a.index - b.index)
    .map((entry) => renderCard(entry.config, entry.asset, isRecommended(entry)))
    .join("");

  const hint = entries.some(isRecommended) ? detectionHint(platform) : "";

  container.innerHTML = `
    <div class="release-latest">
      <div class="release-latest__header">
        <h3 class="release-latest__title">Latest release ${escapeHtml(release.name || release.tag_name || "")}</h3>
        ${dateLabel ? `<span class="release-latest__date">${dateLabel}</span>` : ""}
      </div>
      ${hint ? `<p class="release-latest__detected">${escapeHtml(hint)}</p>` : ""}
      <div class="release-grid">${cards}</div>
    </div>
  `;
};

const loadReleases = async (container) => {
  setStatus(container, "Loading latest release...");

  try {
    const [response, platform] = await Promise.all([
      fetch(`${API_BASE}/repos/${REPOSITORY}/releases/latest`, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      }),
      detectPlatform(),
    ]);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const latest = await response.json();
    renderLatestRelease(container, latest, platform);
  } catch (error) {
    setStatus(container, "Could not load releases. Please try again later.");
  }
};

export const initReleases = () => {
  const container = document.getElementById("releases-container");
  if (!container) {
    return;
  }

  loadReleases(container);
};
