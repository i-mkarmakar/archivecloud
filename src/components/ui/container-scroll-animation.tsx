"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "motion/react";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="relative flex items-start justify-center px-0 pt-32 pb-4 sm:pt-28 md:min-h-[80rem] md:px-20 md:pt-28 md:pb-4"
      ref={containerRef}
    >
      <div
        className="relative w-full py-4"
        style={{
          perspective: isMobile ? undefined : "1000px",
        }}
      >
        <Header
          translate={translate}
          titleComponent={titleComponent}
          animated={!isMobile}
        />
        <Card
          rotate={rotate}
          translate={translate}
          scale={scale}
          animated={!isMobile}
        >
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
  animated = true,
}: {
  translate: MotionValue<number>;
  titleComponent: React.ReactNode;
  animated?: boolean;
}) => {
  return (
    <motion.div
      style={animated ? { translateY: translate } : undefined}
      className="mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
  animated = true,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
  animated?: boolean;
}) => {
  return (
    <motion.div
      style={animated ? { rotateX: rotate, scale } : undefined}
      className="mx-auto mt-6 w-full max-w-[85%] rounded-sm border border-white/30 bg-white/20 p-1 backdrop-blur-md sm:max-w-6xl sm:rounded-xl sm:p-1.5 md:mt-16 md:p-3"
    >
      <div className="w-full overflow-hidden rounded-sm bg-white sm:rounded-xl">
        {children}
      </div>
    </motion.div>
  );
};
