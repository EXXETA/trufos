const API_BASE = "https://api.github.com";
const REPOSITORY = "EXXETA/trufos";

const platformConfig = [
  {
    key: "mac-arm64",
    label: "macOS (Apple Silicon)",
    hint: "Trufos-0.4.0-arm64.dmg",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}-arm64.dmg`) {
        return true;
      }
      return /arm64.*\.dmg$/i.test(name);
    },
  },
  {
    key: "mac-intel",
    label: "macOS (Intel)",
    hint: "Trufos-0.4.0-x64.dmg",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}-x64.dmg`) {
        return true;
      }
      return /(x64|intel).*\.dmg$/i.test(name);
    },
  },
  {
    key: "linux-zip",
    label: "Linux (ZIP)",
    hint: "Trufos-linux-x64-0.4.0.zip",
    matcher: (name, version) => {
      if (version && name === `Trufos-linux-x64-${version}.zip`) {
        return true;
      }
      return /linux.*\.zip$/i.test(name);
    },
  },
  {
    key: "windows-setup",
    label: "Windows (Setup EXE)",
    hint: "Trufos-0.4.0.Setup.exe",
    matcher: (name, version) => {
      if (version && name === `Trufos-${version}.Setup.exe`) {
        return true;
      }
      return /setup.*\.exe$/i.test(name);
    },
  },
];

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

const renderCard = (config, asset) => {
  if (!asset) {
    return `
      <div class="release-item release-item--disabled">
        <p class="release-item__label">${config.label}</p>
        <p class="release-item__hint">${config.hint}</p>
        <span class="release-item__state">Not available</span>
      </div>
    `;
  }

  return `
    <a class="release-item" href="${asset.browser_download_url}" rel="noopener">
      <p class="release-item__label">${config.label}</p>
      <p class="release-item__hint">${asset.name}</p>
      <span class="release-item__state">Download</span>
    </a>
  `;
};

const renderLatestRelease = (container, release) => {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const version = extractVersion(release);
  const dateLabel = formatDate(release.published_at || release.created_at);

  const cards = platformConfig
    .map((config) => {
      const asset = findAsset(assets, config.matcher, version);
      return renderCard(config, asset);
    })
    .join("");

  container.innerHTML = `
    <div class="release-latest">
      <div class="release-latest__header">
        <h3 class="release-latest__title">Latest release ${release.name || release.tag_name || ""}</h3>
        ${dateLabel ? `<span class="release-latest__date">${dateLabel}</span>` : ""}
      </div>
      <div class="release-grid">${cards}</div>
    </div>
  `;
};

const loadReleases = async (container) => {
  setStatus(container, "Loading latest release...");

  try {
    const response = await fetch(`${API_BASE}/repos/${REPOSITORY}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const latest = await response.json();
    renderLatestRelease(container, latest);
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
