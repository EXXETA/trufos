/** @type {"dark"} */ const DARK = "dark";
/** @type {"light"} */ const LIGHT = "light";

/** @typedef { "light" | "dark" } Theme The theme identifier */

const STORAGE_ITEM_KEY = "theme";

/**
 * Stylesheet per theme: `jtd.setTheme(name)` loads assets/css/just-the-docs-<name>.css.
 * "default" is built with `color_scheme: trufos-light` from _config.yml.
 */
const STYLESHEETS = { [LIGHT]: "default", [DARK]: "trufos-dark" };

/** ID of the dark stylesheet written by the inline script in _includes/head_custom.html */
const BOOT_STYLESHEET_ID = "trufos-theme-boot";

function getDarkModeMedia() {
  if (window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)");
  }
  return null;
}

/**
 * Switches the theme's stylesheet. If the boot stylesheet from head_custom.html is present, it
 * is removed only after the new stylesheet has loaded, so the page is never left unstyled.
 * @param {Theme} theme
 */
function applyScheme(theme) {
  const stylesheet = document.querySelector('[rel="stylesheet"]'); // the one jtd.setTheme changes
  const bootStylesheet = document.getElementById(BOOT_STYLESHEET_ID);
  const fileName = `just-the-docs-${STYLESHEETS[theme]}.css`;

  if (stylesheet.getAttribute("href").endsWith(fileName)) {
    bootStylesheet?.remove();
    return;
  }

  if (bootStylesheet) {
    const removeBoot = () => bootStylesheet.remove();
    stylesheet.addEventListener("load", removeBoot, { once: true });
    stylesheet.addEventListener("error", removeBoot, { once: true });
  }
  jtd.setTheme(STYLESHEETS[theme]);
}

export class DarkModeService {
  static {
    // apply the theme as early as possible; head_custom.html covers the first paint
    applyScheme(DarkModeService.preferredTheme);
  }

  /**
   * @param iconElement {SVGElement | string} The icon element
   */
  constructor(iconElement) {
    if (typeof iconElement === "string") {
      iconElement = document.getElementById(iconElement);
    }
    jtd.addEvent(iconElement, "click", () => this.toggleTheme());
    jtd.addEvent(iconElement, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggleTheme();
      }
    });
    this.useElement = iconElement.querySelector("use");
    this.showTheme(DarkModeService.preferredTheme);

    // follow the system theme until the visitor picks one with the toggle
    getDarkModeMedia()?.addEventListener("change", () => {
      if (DarkModeService.storedTheme === null) {
        this.showTheme(DarkModeService.systemTheme);
      }
    });
  }

  /** @returns {Theme} The theme currently shown */
  get theme() {
    return jtd.getTheme() === DARK ? DARK : LIGHT;
  }

  /** @returns {Theme} The visitor's explicit choice, or else the system theme */
  static get preferredTheme() {
    return DarkModeService.storedTheme ?? DarkModeService.systemTheme;
  }

  static get systemTheme() {
    return getDarkModeMedia()?.matches ? DARK : LIGHT;
  }

  /** @returns {Theme | null} The theme the visitor picked with the toggle, if any */
  static get storedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_ITEM_KEY);
      return value === DARK || value === LIGHT ? value : null;
    } catch {
      return null;
    }
  }

  /** @param {Theme} theme Shows a theme without remembering it */
  showTheme(theme) {
    applyScheme(theme);
    this.useElement.setAttribute("xlink:href", `#svg-${theme === DARK ? "moon" : "sun"}`);
  }

  /** Switches to the other theme and remembers the choice */
  toggleTheme() {
    const theme = this.theme === LIGHT ? DARK : LIGHT;
    this.showTheme(theme);
    try {
      localStorage.setItem(STORAGE_ITEM_KEY, theme);
    } catch {
      // storage unavailable (private mode, blocked site data): the theme still applies
    }
  }
}
