const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize({ width: 900 }) // 🔥 sweet spot for WhatsApp
    .jpeg({ quality: 75 })  // 🔥 compression
    .toFile(outputPath);

  return outputPath;
}