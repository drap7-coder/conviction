const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");

// Keep the original voxel bull's horns, eyes, and muzzle at browser-tab scale.
// The silhouette mask excludes the body and chart behind the head.
async function main() {
  const root = path.resolve(__dirname, "../..");
  const mask = Buffer.from(`<svg width="440" height="400"><path fill="white" d="M0 0H440V205L395 210L388 238L352 260L337 300L325 340L320 380L185 380L130 330L110 235L35 205L0 170Z"/></svg>`);
  const head = await sharp(path.join(root, "public/iqbulls-bull.png"))
    .extract({ left: 345, top: 15, width: 440, height: 400 })
    .composite([{ input: mask, blend: "dest-in" }])
    .png().toBuffer();
  async function icon(size) {
    const inset = Math.max(1, Math.round(size * 0.035));
    const resized = await sharp(head).resize(size - inset * 2, size - inset * 2, { fit: "contain", background: "#00000000" }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: "#00000000" } })
      .composite([{ input: resized, gravity: "centre" }]).png().toBuffer();
  }
  for (const [size, files] of [
    [48, ["public/favicon.png", "public/favicon-48.png"]],
    [96, ["public/favicon-96.png"]],
    [192, ["public/favicon-192.png"]],
    [512, ["public/icon.png", "src/app/icon.png"]],
    [180, ["public/apple-icon.png", "public/iqbulls-apple-icon.png", "src/app/apple-icon.png"]],
  ]) {
    const bytes = await icon(size);
    await Promise.all(files.map(file => fs.writeFile(path.join(root, file), bytes)));
  }
  const sizes = [16, 32, 48];
  const frames = await Promise.all(sizes.map(icon));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = sizes[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await fs.writeFile(path.join(root, "public/favicon.ico"), Buffer.concat([header, ...frames]));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
