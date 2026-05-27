/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Needed for Pyodide (WASM)
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
}

export default nextConfig
