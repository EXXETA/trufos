import { IpcPushStream } from '@/lib/ipc-stream';
import { getBodyModel, getScriptModel, getVariablesModel } from '@/lib/monaco/models';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';

export async function setRequestTextBody(requestId: string, request?: TrufosRequest) {
  const model = getBodyModel(requestId);
  const variablesModel = getVariablesModel(requestId);
  if (request?.body?.type === RequestBodyType.TEXT) {
    const stream = await IpcPushStream.open(request, 'utf-8');
    model.setValue(await stream.readAll());
    variablesModel.setValue('');
  } else if (request?.body?.type === RequestBodyType.GRAPHQL) {
    model.setValue(request.body.query ?? '');
    variablesModel.setValue(request.body.variables ?? '{}');
  } else {
    model.setValue('');
    variablesModel.setValue('');
  }
}

export async function setScriptContent(
  requestId: string,
  request?: TrufosRequest,
  scriptType?: ScriptType
) {
  if (scriptType == null) return;
  const model = getScriptModel(requestId, scriptType);
  if (request != null) {
    const stream = await IpcPushStream.open(
      { type: 'script', source: scriptType, request },
      'utf-8'
    );
    model.setValue(await stream.readAll());
  } else {
    model.setValue('');
  }
}

export function isRequestInAParentFolder(requestId: string, folder: Folder): boolean {
  return folder.children.some((child) => {
    if (child.type === 'folder') {
      return isRequestInAParentFolder(requestId, child);
    }
    return child.id === requestId;
  });
}
