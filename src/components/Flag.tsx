/* Circle SVG flags from https://github.com/HatScripts/circle-flags (MIT) */
export function Flag({ code, size = 24, className = '' }: { code: string; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://hatscripts.github.io/circle-flags/flags/${code}.svg`}
      alt=""
      width={size}
      height={size}
      className={`rounded-full ring-1 ring-white/10 ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
