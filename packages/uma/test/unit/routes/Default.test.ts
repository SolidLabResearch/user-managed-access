import { DefaultRequestHandler } from '../../../src/routes/Default';

describe('Default', (): void => {
  const handler = new DefaultRequestHandler();

  it('returns a 404.', async(): Promise<void> => {
    await expect(handler.handle({} as any)).resolves.toEqual({
      status: 404,
      body: {
        'status': 404,
        'error': 'Not Found',
      },
    })
  });
});
