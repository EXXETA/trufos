import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { BodyStore } from './body-store';
import { LatestResponseBodies } from './latest-response-bodies';

describe('LatestResponseBodies', () => {
  let retain: MockInstance<BodyStore['retain']>;
  let release: MockInstance<BodyStore['release']>;

  beforeEach(() => {
    retain = vi.spyOn(BodyStore.instance, 'retain').mockImplementation(() => {});
    release = vi.spyOn(BodyStore.instance, 'release').mockImplementation(() => {});
  });

  it('should retain the latest response body of a request', () => {
    new LatestResponseBodies().set('request', 'body-1');

    expect(retain).toHaveBeenCalledWith('body-1');
    expect(release).not.toHaveBeenCalled();
  });

  it('should release the previous response body once a newer one replaced it', () => {
    const latest = new LatestResponseBodies();
    latest.set('request', 'body-1');

    latest.set('request', 'body-2');

    expect(retain).toHaveBeenCalledWith('body-2');
    expect(release).toHaveBeenCalledWith('body-1');
  });

  it('should release the previous response body if the new response has no body', () => {
    const latest = new LatestResponseBodies();
    latest.set('request', 'body-1');

    latest.set('request', undefined);

    expect(release).toHaveBeenCalledWith('body-1');
  });

  it('should track requests independently', () => {
    const latest = new LatestResponseBodies();
    latest.set('a', 'body-a');

    latest.set('b', 'body-b');

    expect(release).not.toHaveBeenCalled();
  });
});
