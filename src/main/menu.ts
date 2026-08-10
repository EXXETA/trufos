import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { onLocaleChange, t } from 'main/i18n';

const REPOSITORY_URL = 'https://github.com/EXXETA/trufos';
const DOCUMENTATION_URL = `${REPOSITORY_URL}#readme`;
const REPORT_ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`;

export class MenuBuilder {
  constructor(private readonly mainWindow: BrowserWindow) {
    // Wired once per window, not per build: buildMenu() runs again on every locale change, and
    // re-registering here would stack another "Inspect Element" entry on every switch.
    if (!app.isPackaged) {
      this.setupDevelopmentEnvironment();
    }

    // The menu relabels itself, and lets go of the listener together with its window.
    const stopRelabelling = onLocaleChange(() => this.buildMenu());
    mainWindow.on('closed', stopRelabelling);
  }

  buildMenu(): Menu {
    const template =
      process.platform === 'darwin' ? this.buildDarwinTemplate() : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
  }

  private setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_event, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: t('menu.inspectElement'),
          click: () => this.mainWindow.webContents.inspectElement(x, y),
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  private buildEditSubmenu(): MenuItemConstructorOptions[] {
    return [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ];
  }

  private buildViewSubmenu(): MenuItemConstructorOptions[] {
    const submenu: MenuItemConstructorOptions[] = [{ role: 'togglefullscreen' }];
    if (!app.isPackaged) {
      submenu.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' });
    }
    return submenu;
  }

  private buildCollectionSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        label: t('menu.runCollection'),
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => this.mainWindow.webContents.send('show-collection-runner'),
      },
      { type: 'separator' },
      {
        // CmdOrCtrl+, stays reserved for the general app settings.
        label: t('menu.collectionSettings'),
        accelerator: 'CmdOrCtrl+Shift+,',
        click: () => this.mainWindow.webContents.send('show-collection-settings'),
      },
    ];
  }

  private buildHelpSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        label: t('menu.documentation'),
        click: () => shell.openExternal(DOCUMENTATION_URL),
      },
      {
        label: t('menu.reportIssue'),
        click: () => shell.openExternal(REPORT_ISSUE_URL),
      },
    ];
  }

  private buildDarwinTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { label: t('menu.edit'), submenu: this.buildEditSubmenu() },
      { label: t('menu.collection'), submenu: this.buildCollectionSubmenu() },
      { label: t('menu.view'), submenu: this.buildViewSubmenu() },
      {
        label: t('menu.window'),
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { role: 'close' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
      { role: 'help', submenu: this.buildHelpSubmenu() },
    ];
  }

  private buildDefaultTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: `&${t('menu.file')}`,
        submenu: [{ role: 'close' }, { role: 'quit' }],
      },
      { label: `&${t('menu.edit')}`, submenu: this.buildEditSubmenu() },
      { label: `&${t('menu.collection')}`, submenu: this.buildCollectionSubmenu() },
      { label: `&${t('menu.view')}`, submenu: this.buildViewSubmenu() },
      { role: 'help', submenu: this.buildHelpSubmenu() },
    ];
  }
}
