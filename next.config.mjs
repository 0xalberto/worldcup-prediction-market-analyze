import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow high-quality photo rendering in the hero gallery.
    qualities: [75, 90, 95],
  },
};

export default withNextIntl(nextConfig);
