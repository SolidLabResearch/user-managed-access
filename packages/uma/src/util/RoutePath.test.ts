import {RoutePath} from './RoutePath';

describe('A RoutePath', () => {
  it('should resolve to a URL', () => {
    const path = new RoutePath('http://example.com', '/idp/');
    expect(path.getUri()).toEqual('http://example.com/idp/');
  });
});
