const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createOGImage() {
  const logoPath = path.join(__dirname, '../logo.png');
  const outputPath = path.join(__dirname, '../public/og-image.png');
  
  // OG image dimensions
  const width = 1200;
  const height = 630;
  
  try {
    // Get logo dimensions
    const logoMetadata = await sharp(logoPath).metadata();
    const logoWidth = logoMetadata.width;
    const logoHeight = logoMetadata.height;
    
    // Calculate scale to fit logo in OG image (with some padding)
    const maxLogoWidth = width * 0.8; // 80% of OG width
    const maxLogoHeight = height * 0.8; // 80% of OG height
    const scale = Math.min(maxLogoWidth / logoWidth, maxLogoHeight / logoHeight);
    const scaledLogoWidth = Math.round(logoWidth * scale);
    const scaledLogoHeight = Math.round(logoHeight * scale);
    
    // Calculate position to center the logo
    const x = Math.round((width - scaledLogoWidth) / 2);
    const y = Math.round((height - scaledLogoHeight) / 2);
    
    // Create black background and composite logo on top
    await sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black background
      }
    })
    .composite([
      {
        input: await sharp(logoPath)
          .resize(scaledLogoWidth, scaledLogoHeight, { fit: 'contain' })
          .toBuffer(),
        left: x,
        top: y
      }
    ])
    .png()
    .toFile(outputPath);
    
    console.log(`✅ Created og-image.png (${width}x${height}) with black background`);
    console.log(`   Logo size: ${scaledLogoWidth}x${scaledLogoHeight}, centered at (${x}, ${y})`);
  } catch (error) {
    console.error('❌ Error creating OG image:', error);
    process.exit(1);
  }
}

createOGImage();
