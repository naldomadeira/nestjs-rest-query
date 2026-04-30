import Image from "next/image";
import { resolveDocsAssetPath } from "../lib/asset-path";

type ThemedImageProps = {
  srcLight: string;
  srcDark: string;
  alt: string;
  width?: number;
  height?: number;
};

const ThemedImage = ({
  srcLight,
  srcDark,
  alt,
  width = 1200,
  height = 630,
}: ThemedImageProps) => {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-md my-6">
      <Image
        src={resolveDocsAssetPath(srcLight)}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-auto dark:hidden"
      />
      <Image
        src={resolveDocsAssetPath(srcDark)}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-auto hidden dark:block"
      />
    </div>
  );
};

export default ThemedImage;
