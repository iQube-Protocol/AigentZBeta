/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@metame/aa-client", "@metame/browser-contracts", "@metame/iframe-bridge", "@metame/qubetalk-client"],
};

module.exports = nextConfig;
