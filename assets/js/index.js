import { DarkModeService } from "./dark-mode-service.js";
import { initReleases } from "./releases.js";

document.addEventListener("DOMContentLoaded", () => {
  /** A global instance of the dark mode service */
  window.dms = new DarkModeService("toggle-theme-icon");
  initReleases();
});
