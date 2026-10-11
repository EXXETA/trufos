import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { MainProcessEvent } from 'shim/event-service';
import { sendToRenderer } from 'main/event/send-to-renderer';
import { MainEventService } from 'main/event/main-event-service';

const REPOSITORY_URL = 'https://github.com/EXXETA/trufos';
const DOCUMENTATION_URL = `${REPOSITORY_URL}#readme`;
const REPORT_ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`;

export class MenuBuilder {
  constructor(private readonly mainWindow: BrowserWindow) {}

  buildMenu(): Menu {
    if (!app.isPackaged) {
      this.setupDevelopmentEnvironment();
    }

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
          label: 'Inspect Element',
          click: () => this.mainWindow.webContents.inspectElement(x, y),
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  private buildAppSettingsMenuItem(): MenuItemConstructorOptions {
    return {
      label: 'Settings…',
      accelerator: 'CmdOrCtrl+,',
      click: () => sendToRenderer(this.mainWindow.webContents, MainProcessEvent.ShowAppSettings),
    };
  }

  /** macOS only routes Cmd+A/C/V/X/Z to focused inputs through these Edit menu roles. */
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
        label: 'Run Collection',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () =>
          sendToRenderer(this.mainWindow.webContents, MainProcessEvent.ShowCollectionRunner),
      },
      { type: 'separator' },
      {
        // CmdOrCtrl+, stays reserved for the general app settings.
        label: 'Settings…',
        accelerator: 'CmdOrCtrl+Shift+,',
        click: () =>
          sendToRenderer(this.mainWindow.webContents, MainProcessEvent.ShowCollectionSettings),
      },
    ];
  }

  private buildHelpSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        label: 'Documentation',
        click: () => shell.openExternal(DOCUMENTATION_URL),
      },
      {
        label: 'Report an Issue',
        click: () => shell.openExternal(REPORT_ISSUE_URL),
      },
      { type: 'separator' },
      {
        label: 'Open Logs Folder',
        click: () =>
          MainEventService.instance
            .openLogDirectory()
            .catch((error) => logger.error('Failed to open log directory', error)),
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
          this.buildAppSettingsMenuItem(),
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
      { label: 'Edit', submenu: this.buildEditSubmenu() },
      { label: 'Collection', submenu: this.buildCollectionSubmenu() },
      { label: 'View', submenu: this.buildViewSubmenu() },
      {
        label: 'Window',
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
        label: '&File',
        submenu: [
          { role: 'close' },
          { type: 'separator' },
          this.buildAppSettingsMenuItem(),
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { label: '&Collection', submenu: this.buildCollectionSubmenu() },
      { label: '&View', submenu: this.buildViewSubmenu() },
      { role: 'help', submenu: this.buildHelpSubmenu() },
    ];
  }
}
