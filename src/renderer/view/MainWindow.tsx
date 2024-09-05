// import { Header } from '@/components/Header';
import {useState} from "react";
import {RendererEventService} from "@/services/event/renderer-event-service";
import {RufusResponse} from "shim/objects/response";
import {MainTopBar} from "@/components/mainWindow/MainTopBar";
import {MainBody} from "@/components/mainWindow/MainBody";
import {HttpHeaders} from "shim/headers";

const eventService = RendererEventService.instance;
const textDecoder = new TextDecoder();

export function MainWindow() {

  const [body, setBody] = useState<string>();
  const [headers, setHeaders] = useState<HttpHeaders>();

  async function handleResponse(response: RufusResponse) {
    setHeaders(response.headers);
    if (response.bodyFilePath) {
      const buffer = await eventService.readFile(response.bodyFilePath);
      console.debug("Received response body of", buffer.byteLength, "bytes")
      setBody(textDecoder.decode(buffer)); // TODO: decode with encoding from response headers
    }
  }

  return (
    <div className={'flex flex-col flex-auto p-6'}>
       {/*<Header />*/}
      <MainTopBar onResponse={handleResponse}/>
      <MainBody body={body} headers={headers}/>
    </div>
  );
}
