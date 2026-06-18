const sharp = require("sharp")
const fs = require("fs")
const path = require("path")

const trustDir = path.join(__dirname, "..", "public", "trust")
const files = fs.readdirSync(trustDir).filter((f) => f.endsWith(".png"))

async function process() {
  for (const file of files) {
    const inputPath = path.join(trustDir, file)

    const { data, info } = await sharp(inputPath)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })

    const pixels = Buffer.from(data)

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const brightness = (r + g + b) / 3
      // Make very light pixels transparent (white/gray backgrounds)
      if (brightness > 240) {
        pixels[i + 3] = 0
      }
    }

    await sharp(pixels, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(inputPath)

    console.log("Processed:", file)
  }
}

process().catch(console.error)
