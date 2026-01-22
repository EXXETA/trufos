import { Collection } from 'shim/objects/collection';
import path from 'path';
import { BlobWriter, ZipWriter, TextReader } from '@zip.js/zip.js';
import fs from 'node:fs/promises';
import { SECRETS_FILE_NAME } from 'main/persistence/constants';
import { VariableMap } from 'shim/objects/variables';

export type ExportOptions = {
  includeSecrets: boolean;
  password?: string;
};

function clearSecretValues(variables: VariableMap): VariableMap {
  const cleared: VariableMap = {};
  for (const [key, variable] of Object.entries(variables)) {
    if (variable.secret) {
      cleared[key] = { ...variable, value: '' };
    } else {
      cleared[key] = variable;
    }
  }
  return cleared;
}

export class ExportService {
  public static readonly instance = new ExportService();

  async exportCollection(
    collection: Collection,
    outputPath: string,
    options: ExportOptions = { includeSecrets: false }
  ): Promise<string> {
    const collectionDirPath = collection.dirPath;
    const collectionName = collection.title;
    const zipFileName = `${collectionName}.trufos.zip`;
    const fullOutputPath = path.join(outputPath, zipFileName);

    logger.info(`Exporting collection "${collectionName}" to "${fullOutputPath}"`);

    const blobWriter = new BlobWriter('application/zip');
    const zipWriter = new ZipWriter(blobWriter, {
      password: options.password,
      encryptionStrength: 3,
    });

    await this.addDirectoryToZip(zipWriter, collectionDirPath, '', options.includeSecrets);

    await zipWriter.close();
    const blob = await blobWriter.getData();
    const buffer = await blob.arrayBuffer();

    await fs.writeFile(fullOutputPath, Buffer.from(buffer));
    logger.info(`Successfully exported collection to "${fullOutputPath}"`);

    return fullOutputPath;
  }

  private async addDirectoryToZip(
    zipWriter: ZipWriter<unknown>,
    dirPath: string,
    basePath: string,
    includeSecrets: boolean
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const zipPath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        await this.addDirectoryToZip(zipWriter, entryPath, zipPath, includeSecrets);
      } else {
        if (entry.name === SECRETS_FILE_NAME) {
          if (!includeSecrets) {
            logger.debug(`Skipping secrets file: ${zipPath}`);
            continue;
          }
        }

        let fileContent = await fs.readFile(entryPath, 'utf-8');

        if (!includeSecrets && entry.name.endsWith('.json')) {
          try {
            const json = JSON.parse(fileContent);

            if (json.variables) {
              json.variables = clearSecretValues(json.variables);
            }

            if (json.environments) {
              for (const [envKey, envValue] of Object.entries(json.environments)) {
                if (envValue && typeof envValue === 'object' && 'variables' in envValue) {
                  json.environments[envKey].variables = clearSecretValues(
                    (envValue as { variables: VariableMap }).variables
                  );
                }
              }
            }

            fileContent = JSON.stringify(json, null, 2);
          } catch {
            logger.debug(`Could not parse JSON file ${zipPath}, adding as-is`);
          }
        }

        await zipWriter.add(zipPath, new TextReader(fileContent));
      }
    }
  }
}
