const ABSOLUTE_URL_PATTERN = /^[a-z]+:\/\//i;

const normalizeBasePath = (basePath: string) =>
  basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

export const resolveDocsAssetPath = (src: string) => {
  if (!src || ABSOLUTE_URL_PATTERN.test(src)) {
    return src;
  }

  const basePath = normalizeBasePath(
    process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  );

  if (!basePath || !src.startsWith("/")) {
    return src;
  }

  if (src === basePath || src.startsWith(`${basePath}/`)) {
    return src;
  }

  return `${basePath}${src}`;
};
