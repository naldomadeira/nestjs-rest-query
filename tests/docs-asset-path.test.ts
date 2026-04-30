describe('resolveDocsAssetPath', () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      return;
    }

    process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  });

  test('prefixes local public assets with the docs base path', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/nestjs-rest-query';

    const { resolveDocsAssetPath } = await import('../apps/docs/lib/asset-path');

    expect(resolveDocsAssetPath('/patterns.png')).toBe(
      '/nestjs-rest-query/patterns.png',
    );
    expect(resolveDocsAssetPath('/docs/diagram.svg')).toBe(
      '/nestjs-rest-query/docs/diagram.svg',
    );
  });

  test('keeps external and already-prefixed URLs unchanged', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/nestjs-rest-query';

    const { resolveDocsAssetPath } = await import('../apps/docs/lib/asset-path');

    expect(resolveDocsAssetPath('https://img.logo.dev/example')).toBe(
      'https://img.logo.dev/example',
    );
    expect(resolveDocsAssetPath('/nestjs-rest-query/logomark.svg')).toBe(
      '/nestjs-rest-query/logomark.svg',
    );
  });
});
