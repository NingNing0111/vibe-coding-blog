/** @type {import('next').NextConfig} */
const isWindows = process.platform === 'win32'
// Windows 上如果没有启用“开发者模式/管理员权限”，symlink 可能导致 standalone 构建失败（EPERM）。
// 如需强制启用 standalone：设置环境变量 NEXT_OUTPUT_STANDALONE=1
const enableStandalone = process.env.NEXT_OUTPUT_STANDALONE === '1' || !isWindows

const nextConfig = {
  reactStrictMode: true,
  ...(enableStandalone ? { output: 'standalone' } : {}),
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
}

module.exports = nextConfig
