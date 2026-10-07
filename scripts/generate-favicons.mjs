import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Vector SVG for AI Closer brand
// Center is (256, 256), viewBox 0 0 512 512
// Bold, balanced, modern 'AI' monogram
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff7e42"/>
      <stop offset="50%" stop-color="#ff6b2f"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <filter id="aiShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.25)"/>
    </filter>
  </defs>
  <!-- Background squircle -->
  <rect x="24" y="24" width="464" height="464" rx="116" fill="url(#aiGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="116" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6"/>

  <!-- AI Monogram: Bold, Geometric, High Contrast -->
  <g filter="url(#aiShadow)">
    <!-- Letter 'A': Apex at top (205, 132), base at bottom (108..302, 376) -->
    <path d="M 194 132 L 216 132 L 302 376 L 254 376 L 235 322 L 175 322 L 156 376 L 108 376 Z M 187 280 L 223 280 L 205 224 Z" fill="#ffffff"/>

    <!-- Letter 'I': Crisp slab pillar with top & bottom caps for 100% clarity -->
    <path d="M 322 132 L 414 132 L 414 172 L 388 172 L 388 336 L 414 336 L 414 376 L 322 376 L 322 336 L 348 336 L 348 172 L 322 172 Z" fill="#ffffff"/>
  </g>
</svg>`;

async function run() {
  const svgBuf = Buffer.from(svgContent);

  // Generate PNG buffers at 512, 192, 180, 48, 32, 16
  const png512 = await sharp(svgBuf).resize(512, 512).png().toBuffer();
  const png192 = await sharp(svgBuf).resize(192, 192).png().toBuffer();
  const png180 = await sharp(svgBuf).resize(180, 180).png().toBuffer();
  const png48 = await sharp(svgBuf).resize(48, 48).png().toBuffer();
  const png32 = await sharp(svgBuf).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svgBuf).resize(16, 16).png().toBuffer();

  // Multi-frame ICO pack (16, 32, 48) with PNG encoding
  function buildIco(images) {
    const count = images.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: 1 = ICO
    header.writeUInt16LE(count, 4); // number of images

    let offset = 6 + count * 16;
    const dirEntries = [];
    for (const img of images) {
      const dir = Buffer.alloc(16);
      dir.writeUInt8(img.width, 0);
      dir.writeUInt8(img.height, 1);
      dir.writeUInt8(0, 2); // color palette
      dir.writeUInt8(0, 3); // reserved
      dir.writeUInt16LE(1, 4); // color planes
      dir.writeUInt16LE(32, 6); // bpp
      dir.writeUInt32LE(img.buffer.length, 8); // size
      dir.writeUInt32LE(offset, 12); // offset
      offset += img.buffer.length;
      dirEntries.push(dir);
    }

    return Buffer.concat([header, ...dirEntries, ...images.map((img) => img.buffer)]);
  }

  const icoBuf = buildIco([
    { width: 16, height: 16, buffer: png16 },
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 },
  ]);

  // Write SVGs
  fs.writeFileSync("src/app/icon.svg", svgContent, "utf8");
  fs.writeFileSync("public/favicon.svg", svgContent, "utf8");

  // Write ICOs
  fs.writeFileSync("src/app/favicon.ico", icoBuf);
  fs.writeFileSync("public/favicon.ico", icoBuf);

  // Write PNG icons
  fs.writeFileSync("src/app/icon.png", png512);
  fs.writeFileSync("public/icon.png", png512);
  fs.writeFileSync("public/icon-512.png", png512);
  fs.writeFileSync("public/icon-192.png", png192);
  fs.writeFileSync("src/app/apple-icon.png", png180);
  fs.writeFileSync("public/apple-icon.png", png180);
  fs.writeFileSync("public/apple-touch-icon.png", png180);

  console.log("Successfully generated all AI Closer favicons & app icons!");
}

run().catch(console.error);
