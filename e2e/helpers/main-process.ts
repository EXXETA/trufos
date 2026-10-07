import type { ElectronApplication } from '@playwright/test';

/**
 * Invokes an item of the native application menu by its label.
 *
 * Native menus cannot be driven through the renderer, so the click is dispatched in the main
 * process instead. The menu template itself is still the real one built by `MenuBuilder`, so this
 * exercises the actual wiring between a menu entry and the renderer.
 *
 * @param app the running application
 * @param label the label of the item, e.g. `Settings…`
 * @throws if no enabled item with that label exists
 */
export async function clickMenuItem(app: ElectronApplication, label: string): Promise<void> {
  const clicked = await app.evaluate(({ Menu }, targetLabel) => {
    const findAndClick = (items: Electron.MenuItem[]): boolean => {
      for (const item of items) {
        if (item.label === targetLabel && item.enabled) {
          item.click();
          return true;
        }
        if (item.submenu != null && findAndClick(item.submenu.items)) return true;
      }
      return false;
    };

    const menu = Menu.getApplicationMenu();
    return menu != null && findAndClick(menu.items);
  }, label);

  if (!clicked) {
    throw new Error(`No enabled menu item labelled "${label}" in the application menu`);
  }
}

/** Opens the app settings dialog through the native menu entry that ships with the app. */
export async function openAppSettings(app: ElectronApplication): Promise<void> {
  await clickMenuItem(app, 'Settings…');
}

/**
 * Makes the next directory pickers resolve to `dirPath` instead of opening a native dialog.
 *
 * Trufos opens a real `dialog.showOpenDialog` for directory selection (see `file-drop-zone.tsx`),
 * which no automation can click. Replacing the method on the `dialog` module keeps everything
 * below it — the IPC handler, the renderer callback, the import itself — untouched.
 *
 * @param app the running application
 * @param dirPath the directory the picker should return
 */
export async function stubDirectoryPicker(
  app: ElectronApplication,
  dirPath: string
): Promise<void> {
  await app.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, dirPath);
}
