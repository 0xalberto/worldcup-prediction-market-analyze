import Image from 'next/image';

export function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Image
        src="/worldcup4.jpg"
        alt=""
        fill
        quality={90}
        sizes="100vw"
        className="object-cover object-center opacity-[0.08]"
      />
    </div>
  );
}
