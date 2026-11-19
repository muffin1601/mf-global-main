import Image from "next/image";

/** MF Global Services logo mark (same asset as the public website). Decorative: the link around it carries the name. */
export function BrandLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Image src="/assets/logo.webp" alt="" width={size} height={size} priority />
    </span>
  );
}
