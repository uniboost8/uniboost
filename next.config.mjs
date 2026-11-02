/** @type {import('next').NextConfig} */
const dev = process.env.NODE_ENV !== 'production';
const sb = 'https://*.supabase.co';
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (dev ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + sb,
  "media-src 'self' blob: https: " + sb,
  "connect-src 'self' " + sb + " wss://*.supabase.co",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const nextConfig = {
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: false },
      { source: '/instructors.html', destination: '/instructors', permanent: false },
      { source: '/courses.html', destination: '/courses', permanent: false },
      { source: '/schedule.html', destination: '/schedule', permanent: false },
      { source: '/my-classes.html', destination: '/my-classes', permanent: false },
      { source: '/recordings.html', destination: '/recordings', permanent: false },
      { source: '/dashboard.html', destination: '/dashboard', permanent: false },
      { source: '/privacy.html', destination: '/privacy', permanent: false }
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Content-Security-Policy', value: csp }
      ]
    }];
  }
};

export default nextConfig;
