import { vi, describe, it, beforeEach, expect } from 'vitest';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

const { appMock, buildFromTemplateMock, setApplicationMenuMock, openExternalMock } = vi.hoisted(
  () => ({
    appMock: { isPackaged: false, name: 'Trufos' },
    buildFromTemplateMock: vi.fn((template: MenuItemConstructorOptions[]) => ({
      template,
      popup: vi.fn(),
    })),
    setApplicationMenuMock: vi.fn(),
    openExternalMock: vi.fn(),
  })
);

vi.mock('electron', () => ({
  app: appMock,
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => buildFromTemplateMock(template),
    setApplicationMenu: (menu: unknown) => setApplicationMenuMock(menu),
  },
  shell: {
    openExternal: (url: string) => openExternalMock(url),
  },
}));

import { MenuBuilder } from './menu';

const sendMock = vi.fn();

function createMainWindow() {
  return {
    webContents: { on: vi.fn(), inspectElement: vi.fn(), send: sendMock },
  } as unknown as BrowserWindow;
}

function buildTemplate(platform: NodeJS.Platform) {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    new MenuBuilder(createMainWindow()).buildMenu();
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
  return buildFromTemplateMock.mock.calls[0][0];
}

function collectStrings(items: MenuItemConstructorOptions[]): string[] {
  return items.flatMap((item) => [
    ...(item.label ? [item.label] : []),
    ...(item.role ? [item.role] : []),
    ...(Array.isArray(item.submenu) ? collectStrings(item.submenu) : []),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  appMock.isPackaged = false;
});

describe('MenuBuilder', () => {
  it('registers the menu as the application menu', () => {
    const menu = new MenuBuilder(createMainWindow()).buildMenu();

    expect(setApplicationMenuMock).toHaveBeenCalledWith(menu);
  });

  it.each(['darwin', 'win32', 'linux'] as const)(
    'contains no boilerplate references on %s',
    (platform) => {
      const strings = collectStrings(buildTemplate(platform)).join(' ');

      expect(strings).not.toMatch(/ElectronReact|electronjs/i);
      expect(strings).not.toMatch(/\bElectron\b/);
    }
  );

  it('builds the macOS app menu with standard roles', () => {
    const template = buildTemplate('darwin');

    expect(template[0].label).toBe('Trufos');
    const appRoles = collectStrings(template[0].submenu as MenuItemConstructorOptions[]);
    expect(appRoles).toEqual(
      expect.arrayContaining(['about', 'services', 'hide', 'hideOthers', 'unhide', 'quit'])
    );
    expect(template.map((item) => item.label ?? item.role)).toEqual([
      'Trufos',
      'Edit',
      'Collection',
      'View',
      'Window',
      'help',
    ]);
  });

  it('builds the default menu with File, Edit, View and Help', () => {
    const template = buildTemplate('win32');

    expect(template.map((item) => item.label ?? item.role)).toEqual([
      '&File',
      '&Edit',
      '&Collection',
      '&View',
      'help',
    ]);
    const fileRoles = collectStrings(template[0].submenu as MenuItemConstructorOptions[]);
    expect(fileRoles).toEqual(['close', 'quit']);
  });

  it.each(['darwin', 'win32'] as const)(
    'includes Reload and DevTools on %s only in development',
    (platform) => {
      const devStrings = collectStrings(buildTemplate(platform));
      expect(devStrings).toEqual(expect.arrayContaining(['reload', 'toggleDevTools']));

      vi.clearAllMocks();
      appMock.isPackaged = true;
      const prodStrings = collectStrings(buildTemplate(platform));
      expect(prodStrings).not.toContain('reload');
      expect(prodStrings).not.toContain('toggleDevTools');
      expect(prodStrings).toContain('togglefullscreen');
    }
  );

  it.each(['darwin', 'win32'] as const)(
    'opens the collection runner and settings from the Collection menu on %s',
    (platform) => {
      const template = buildTemplate(platform);
      const collectionMenu = template.find((item) => item.label?.includes('Collection'))!;
      const items = collectionMenu.submenu as MenuItemConstructorOptions[];

      const runItem = items.find((item) => item.label === 'Run Collection')!;
      expect(runItem.accelerator).toBe('CmdOrCtrl+Shift+R');
      (runItem.click as () => void)();
      expect(sendMock).toHaveBeenCalledWith('show-collection-runner');

      const settingsItem = items.find((item) => item.label === 'Settings…')!;
      expect(settingsItem.accelerator).toBe('CmdOrCtrl+Shift+,');
      (settingsItem.click as () => void)();
      expect(sendMock).toHaveBeenCalledWith('show-collection-settings');
    }
  );

  it('opens the Trufos documentation and issue tracker from the Help menu', () => {
    const template = buildTemplate('darwin');
    const help = template.find((item) => item.role === 'help')!;
    const items = help.submenu as MenuItemConstructorOptions[];

    for (const item of items) {
      (item.click as () => void)();
    }

    expect(openExternalMock).toHaveBeenCalledWith('https://github.com/EXXETA/trufos#readme');
    expect(openExternalMock).toHaveBeenCalledWith(
      'https://github.com/EXXETA/trufos/issues/new/choose'
    );
  });

  it('registers a context-menu handler only in development', () => {
    const devWindow = createMainWindow();
    new MenuBuilder(devWindow).buildMenu();
    expect(devWindow.webContents.on).toHaveBeenCalledWith('context-menu', expect.any(Function));

    appMock.isPackaged = true;
    const prodWindow = createMainWindow();
    new MenuBuilder(prodWindow).buildMenu();
    expect(prodWindow.webContents.on).not.toHaveBeenCalled();
  });
});
