import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadConfig() {
  const path = existsSync(join(root, "config.json"))
    ? join(root, "config.json")
    : join(root, "config.example.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const config = loadConfig();
  const url = config.siteUrl || "https://robywas.github.io/ogloszeniaCharisma/";
  const assetsDir = join(root, "docs", "assets");
  const logoPath = join(root, "docs", config.logoPath || "assets/logo.png");
  const outPath = join(assetsDir, "qr.png");

  mkdirSync(assetsDir, { recursive: true });

  const size = 512;
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: "#1e1e1e", light: "#f6f3ef" },
  });

  let output = sharp(qrBuffer);

  if (existsSync(logoPath)) {
    const logoSize = Math.floor(size * 0.22);
    const pad = Math.floor(logoSize * 0.15);
    const box = logoSize + pad * 2;

    const logoPng = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const logoPlate = await sharp({
      create: {
        width: box,
        height: box,
        channels: 4,
        background: { r: 246, g: 243, b: 239, alpha: 1 },
      },
    })
      .composite([{ input: logoPng, top: pad, left: pad }])
      .png()
      .toBuffer();

    output = sharp(qrBuffer).composite([
      {
        input: logoPlate,
        top: Math.floor((size - box) / 2),
        left: Math.floor((size - box) / 2),
      },
    ]);
  } else {
    console.warn("Brak logo — QR bez logo w środku. Dodaj docs/assets/logo.png");
  }

  await output.png().toFile(outPath);
  console.log(`Zapisano ${outPath} → ${url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
