const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

function loadEnvFile() {
  const env = {}
  const envPath = path.resolve(__dirname, '.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/)
      if (match) {
        let value = match[2].trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        env[match[1]] = value
      }
    }
  }
  return env
}

const fileEnv = loadEnvFile()
const umamiUrl = process.env.UMAMI_URL || fileEnv.UMAMI_URL || ''
const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID || fileEnv.UMAMI_WEBSITE_ID || ''

const isWatch = process.argv.includes('--watch')
const isProduction = process.argv.includes('--production')

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: !isProduction,
    minify: isProduction,
    define: {
      'process.env.UMAMI_URL': JSON.stringify(umamiUrl),
      'process.env.UMAMI_WEBSITE_ID': JSON.stringify(umamiWebsiteId),
    },
  })

  if (isWatch) {
    await ctx.watch()
    console.log('[esbuild] Watching for changes...')
  } else {
    await ctx.rebuild()
    await ctx.dispose()
    console.log('[esbuild] Build complete.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
