/** @type {"dark"} */ const DARK = "dark";
/** @type {"light"} */ const LIGHT = "light";

/** @typedef { "light" | "dark" } Theme The theme identifier */

const STORAGE_ITEM_KEY = "theme";

function getDarkModeMedia() {
  if (window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)");
  }
  return null;
}

export class DarkModeService {
  static {
    // preload correct theme before rendering finished
    jtd.setTheme(DarkModeService.storedTheme ?? DarkModeService.systemTheme);
  }

  /**
   * @param iconElement {SVGElement | string} The icon element
   */
  constructor(iconElement) {
    if (typeof iconElement === "string") {
      iconElement = document.getElementById(iconElement);
    }
    jtd.addEvent(iconElement, "click", () => this.toggleTheme());
    this.useElement = iconElement.querySelector("use");

    // set the initial theme and add a listener for system theme changes
    this.theme = DarkModeService.storedTheme ?? DarkModeService.systemTheme;
    getDarkModeMedia()?.addEventListener("change", () => {
      this.theme = DarkModeService.systemTheme;
    });
  }

  get theme() {
    return jtd.getTheme();
  }

  static get systemTheme() {
    return getDarkModeMedia()?.matches ? DARK : LIGHT;
  }

  /** @returns {Theme | null} The stored theme */
  static get storedTheme() {
    return localStorage.getItem(STORAGE_ITEM_KEY);
  }

  /** @param {Theme} value The theme to set */
  set theme(value) {
    /** @type {string} */ let icon;

    switch (value) {
      case DARK:
        icon = "moon";
        break;
      case LIGHT:
      default:
        value = LIGHT;
        icon = "sun";
        break;
    }

    jtd.setTheme(value);
    this.useElement.setAttribute("xlink:href", `#svg-${icon}`);
    localStorage.setItem(STORAGE_ITEM_KEY, value);

    // Toggle releases dark mode stylesheet for manual theme switching
    const releasesDarkSheet = document.getElementById("releases-dark-css");
    if (releasesDarkSheet) {
      releasesDarkSheet.disabled = value !== DARK;
    }
  }

  toggleTheme() {
    this.theme = this.theme === LIGHT ? DARK : LIGHT;
  }
}
