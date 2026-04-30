import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import Image from "next/image";
import { SiGitlab } from "@icons-pack/react-simple-icons";
import { resolveDocsAssetPath } from "../../lib/asset-path";

type HomeRootLayoutProps = {
  readonly children: ReactNode;
};

const GITHUB_URL =
  "https://github.com/nestjs-rest-query/nestjs-rest-query";

const HomeRootLayout = ({ children }: HomeRootLayoutProps) => (
  <HomeLayout
    nav={{
      title: (
        <div className="flex items-center gap-2">
          <Image
            src={resolveDocsAssetPath("/logomark.svg")}
            alt="NestJS Dynamic Query Builder"
            width={22}
            height={22}
            className="dark:invert shrink-0"
          />
          <span className="font-semibold text-sm leading-none">NestJS DQB</span>
        </div>
      ),
      url: "/",
    }}
    links={[
      { text: "Docs", url: "/docs" },
      {
        type: "icon" as const,
        text: "GitHub",
        label: "GitHub",
        url: GITHUB_URL,
        icon: <SiGitlab className="size-4" />,
        external: true,
      },
    ]}
  >
    {children}
  </HomeLayout>
);

export default HomeRootLayout;
