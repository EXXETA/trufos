import { z } from 'zod';
import { McpServerSettings } from './mcp';

export enum TrufosTheme {
  Light = 'light',
  Dark = 'dark',
}

export const ThemePreference = z.union([z.enum(TrufosTheme), z.literal('system')]);
export type ThemePreference = z.infer<typeof ThemePreference>;

export const AppSettings = z.object({
  theme: ThemePreference.default('system'),
  /**
   * Whether the TLS certificates of the servers requests are sent to are verified. Settings stored
   * before this existed verify them.
   */
  verifyTlsCertificates: z.boolean().default(true),
  /** The MCP server agents use to work with the app. Settings stored before this existed have it off. */
  mcpServer: McpServerSettings.prefault({}),
});
export type AppSettings = z.infer<typeof AppSettings>;

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze(AppSettings.parse({}));

/** The label of {@link AppSettings.verifyTlsCertificates} in the app settings, e.g. to refer to it. */
export const VERIFY_TLS_CERTIFICATES_LABEL = 'Verify TLS certificates';
