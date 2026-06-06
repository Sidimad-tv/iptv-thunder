import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Android icon sizes
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Source icon path - relative to script location
const rootDir = path.join(__dirname, '..');
const sourceIcon = path.join(rootDir, 'src-tauri', 'icons', 'icon.png');
const outputDir = path.join(rootDir, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  console.log('Generating Android app icons...');

  // Read source image
  const image = sharp(sourceIcon);
  const metadata = await image.metadata();

  for (const [folder, size] of Object.entries(sizes)) {
    const outputPath = path.join(outputDir, folder, 'ic_launcher.png');
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    
    // Generate icon with padding for adaptive icons
    await image
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } }) // #0f172a slate-900
      .toFile(outputPath);
    
    console.log(`✓ Created ${folder}/ic_launcher.png (${size}x${size})`);
  }

  // Also create round icons (adaptive icons fallback)
  for (const [folder, size] of Object.entries(sizes)) {
    const outputPath = path.join(outputDir, folder, 'ic_launcher_round.png');
    
    await image
      .resize(Math.round(size * 0.75), Math.round(size * 0.75), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(size * 0.125),
        bottom: Math.round(size * 0.125),
        left: Math.round(size * 0.125),
        right: Math.round(size * 0.125),
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      })
      .toFile(outputPath);
    
    console.log(`✓ Created ${folder}/ic_launcher_round.png (${size}x${size})`);
  }

  // Create foreground icons for adaptive icons
  for (const [folder, size] of Object.entries(sizes)) {
    const outputPath = path.join(outputDir, folder, 'ic_launcher_foreground.png');
    
    await image
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(outputPath);
    
    console.log(`✓ Created ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Generate Android TV banner (320x180)
  const bannerPath = path.join(outputDir, 'drawable', 'ic_banner.png');
  fs.mkdirSync(path.dirname(bannerPath), { recursive: true });
  
  await image
    .resize(320, 180, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .toFile(bannerPath);
  
  console.log(`✓ Created drawable/ic_banner.png (320x180)`);

  // Generate TV launcher icon (for Android TV)
  const tvIconPath = path.join(outputDir, 'drawable-tv', 'ic_launcher.png');
  fs.mkdirSync(path.dirname(tvIconPath), { recursive: true });
  
  await image
    .resize(192, 192, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .toFile(tvIconPath);
  
  console.log(`✓ Created drawable-tv/ic_launcher.png (192x192)`);

  console.log('\nAndroid icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
