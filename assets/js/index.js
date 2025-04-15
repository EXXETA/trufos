import {DarkModeService} from "./dark-mode-service.js";

document.addEventListener("DOMContentLoaded", () => {
  /** A global instance of the dark mode service */
  window.dms = new DarkModeService('toggle-theme-icon');
});