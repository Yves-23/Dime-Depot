import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

// Create a simple blue square with "D" as the icon
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#2563eb"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="bold" 
    fill="white" text-anchor="middle">D</text>
</svg>`

const svgBuffer = Buffer.from(svgIcon)

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}x${size}.png`)
  console.log(`Generated icon-${size}x${size}.png`)
}

console.log('All icons generated!')