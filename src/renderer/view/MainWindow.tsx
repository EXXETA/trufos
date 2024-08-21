// import { Header } from '@/components/Header';
import {RequestBody} from '@/components/mainWindow/RequestBody';
import {Request} from '@/components/mainWindow/Request';
import {useState} from "react";
import {RendererEventService} from "@/services/event/renderer-event-service";
import {HttpHeaders} from "../../shim/headers";
import {RufusResponse} from "../../shim/response";

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
      {/* <Header /> */}

      <Request onResponse={handleResponse}/>
      <RequestBody body={body} headers={headers}/>
    </div>
  );
}
