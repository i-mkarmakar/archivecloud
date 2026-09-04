import Link from "next/link";
import AnimationContainer from "@/marketing/components/global/animation-container";
import { BrandLogo } from "@/components/drive/BrandLogo";

const Footer = () => {
  return (
    <footer className="flex flex-col relative items-center justify-center border-t border-border pt-16 pb-8 px-6 lg:px-8 w-full max-w-6xl mx-auto bg-[radial-gradient(35%_128px_at_50%_0%,theme(backgroundColor.white/8%),transparent)]">
      <div className="absolute top-0 left-1/2 right-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1.5 bg-foreground rounded-full"></div>

      <div className="grid gap-8 xl:grid-cols-3 xl:gap-8 w-full">
        <AnimationContainer delay={0.1}>
          <div className="flex flex-col items-start justify-start md:max-w-[200px]">
            <div className="flex items-start">
              <Link href="/#home">
                <BrandLogo className="h-10 w-10" />
                <span className="sr-only">ArchiveCloud</span>
              </Link>
            </div>
            <p className="text-muted-foreground mt-4 text-sm text-start">
              Your Google Drive storage gateway for upload, organize, share, and
              quota tracking.
            </p>
            <span className="mt-4 text-sm text-muted-foreground flex items-center">
              Built for teams using Google Drive
            </span>
          </div>
        </AnimationContainer>

        <div className="grid-cols-2 gap-8 grid mt-16 xl:col-span-2 xl:mt-0">
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <AnimationContainer delay={0.2}>
              <div className="">
                <h3 className="text-base font-medium text-foreground">
                  Product
                </h3>
                <ul className="mt-4 text-sm text-muted-foreground">
                  <li className="mt-2">
                    <Link
                      href="/#features"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Features
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/#pricing"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/#how-it-works"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      How it works
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/auth/sign-up"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Get started
                    </Link>
                  </li>
                </ul>
              </div>
            </AnimationContainer>
            <AnimationContainer delay={0.3}>
              <div className="mt-10 md:mt-0 flex flex-col">
                <h3 className="text-base font-medium text-foreground">
                  Platform
                </h3>
                <ul className="mt-4 text-sm text-muted-foreground">
                  <li className="">
                    <Link
                      href="/auth/sign-in"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Sign in
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/auth/sign-up"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Sign up
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/home"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/settings"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Settings
                    </Link>
                  </li>
                </ul>
              </div>
            </AnimationContainer>
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <AnimationContainer delay={0.4}>
              <div className="">
                <h3 className="text-base font-medium text-foreground">
                  Resources
                </h3>
                <ul className="mt-4 text-sm text-muted-foreground">
                  <li className="mt-2">
                    <Link
                      href="/#how-it-works"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      How it works
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/auth/sign-up"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>
            </AnimationContainer>
            <AnimationContainer delay={0.5}>
              <div className="mt-10 md:mt-0 flex flex-col">
                <h3 className="text-base font-medium text-foreground">
                  Company
                </h3>
                <ul className="mt-4 text-sm text-muted-foreground">
                  <li className="">
                    <Link
                      href="/#features"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      About ArchiveCloud
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/auth/sign-in"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Sign in
                    </Link>
                  </li>
                  <li className="mt-2">
                    <Link
                      href="/auth/sign-up"
                      className="hover:text-foreground transition-all duration-300"
                    >
                      Sign up
                    </Link>
                  </li>
                </ul>
              </div>
            </AnimationContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-border/40 pt-4 md:pt-8 md:flex md:items-center md:justify-between w-full">
        <AnimationContainer delay={0.6}>
          <p className="text-sm text-muted-foreground mt-8 md:mt-0">
            &copy; {new Date().getFullYear()} ArchiveCloud. All rights reserved.
          </p>
        </AnimationContainer>
      </div>
    </footer>
  );
};

export default Footer;
