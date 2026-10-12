import { BodyStore } from 'main/network/service/body-store';

const bodyStore = BodyStore.instance;

/**
 * Keeps the body of the latest response of each request alive, as the response panel and the
 * collection runner still show it. The previous response body of a request is released once a
 * newer response replaced it.
 */
export class LatestResponseBodies {
  public static readonly instance = new LatestResponseBodies();

  /** requestId => ID of the body of its latest response */
  private readonly bodies = new Map<string, string>();

  /**
   * Records the latest response of a request.
   * @param requestId the ID of the request
   * @param bodyId the ID of the response body, or `undefined` if the response has no body
   */
  set(requestId: string, bodyId?: string): void {
    const previous = this.bodies.get(requestId);
    if (bodyId != null) {
      bodyStore.retain(bodyId);
      this.bodies.set(requestId, bodyId);
    } else {
      this.bodies.delete(requestId);
    }
    if (previous != null) bodyStore.release(previous);
  }
}
