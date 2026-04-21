const gradientCanvas = document.getElementById("gradient-canvas");
const gradientCtx = gradientCanvas.getContext("2d");
const gradientBackgroundInput = document.getElementById("gradient-background-input");
const gradientOverlayInput = document.getElementById("gradient-overlay-input");
const gradientScaleInput = document.getElementById("gradient-scale");
const gradientScaleValue = document.getElementById("gradient-scale-value");
const gradientPosXInput = document.getElementById("gradient-pos-x");
const gradientPosYInput = document.getElementById("gradient-pos-y");
const gradientPosXValue = document.getElementById("gradient-pos-x-value");
const gradientPosYValue = document.getElementById("gradient-pos-y-value");
const gradientBlendButton = document.getElementById("gradient-blend-button");
const gradientLoadHandButton = document.getElementById("gradient-load-hand-button");
const gradientLoadEarButton = document.getElementById("gradient-load-ear-button");
const gradientLoadEyeButton = document.getElementById("gradient-load-eye-button");

const gradientState = {
  backgroundImage: null,
  overlayImage: null,
  scalePercent: 100,
  x: 0,
  y: 0,
  baseImageData: null,
};

if (gradientCanvas && gradientCtx) {
  gradientBackgroundInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    gradientState.backgroundImage = await loadImageFromFile(file);
    gradientState.baseImageData = null;
    drawGradientScene();
  });

  gradientOverlayInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    gradientState.overlayImage = await loadImageFromFile(file);
    resetOverlayPosition();
    drawGradientScene();
  });

  gradientScaleInput.addEventListener("input", () => {
    gradientState.scalePercent = Number(gradientScaleInput.value);
    gradientScaleValue.textContent = String(gradientState.scalePercent);
    drawGradientScene();
  });

  gradientPosXInput.addEventListener("input", () => {
    gradientState.x = Number(gradientPosXInput.value);
    gradientPosXValue.textContent = String(gradientState.x);
    drawGradientScene();
  });

  gradientPosYInput.addEventListener("input", () => {
    gradientState.y = Number(gradientPosYInput.value);
    gradientPosYValue.textContent = String(gradientState.y);
    drawGradientScene();
  });

  gradientBlendButton.addEventListener("click", () => {
    performPoissonBlend();
  });

  gradientLoadHandButton.addEventListener("click", async () => {
    const candidates = getGradientPresetUrlCandidates("superimposition", "HandPhoto.jpg");
    try {
      gradientState.backgroundImage = await loadGradientImageFromCandidatePaths(candidates);
      gradientState.baseImageData = null;
      drawGradientScene();
    } catch (error) {
      console.error(error);
      alert(`Could not load HandPhoto preset.\n\nTried:\n${candidates.join("\n")}`);
    }
  });

  gradientLoadEarButton.addEventListener("click", async () => {
    const candidates = getGradientPresetUrlCandidates("superimposition", "ear.png");
    try {
      gradientState.overlayImage = await loadGradientImageFromCandidatePaths(candidates);
      resetOverlayPosition();
      drawGradientScene();
    } catch (error) {
      console.error(error);
      alert(`Could not load ear preset.\n\nTried:\n${candidates.join("\n")}`);
    }
  });

  gradientLoadEyeButton.addEventListener("click", async () => {
    const candidates = getGradientPresetUrlCandidates("superimposition", "EyePhoto.jpg");
    try {
      gradientState.overlayImage = await loadGradientImageFromCandidatePaths(candidates);
      resetOverlayPosition();
      drawGradientScene();
    } catch (error) {
      console.error(error);
      alert(`Could not load eye preset.\n\nTried:\n${candidates.join("\n")}`);
    }
  });

  drawGradientScene();
}

function drawGradientScene() {
  const canvasWidth = gradientCanvas.width;
  const canvasHeight = gradientCanvas.height;

  gradientCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (gradientState.baseImageData) {
    gradientCtx.putImageData(gradientState.baseImageData, 0, 0);
  } else if (gradientState.backgroundImage) {
    const fit = fitImageInsideCanvas(
      gradientState.backgroundImage.width,
      gradientState.backgroundImage.height,
      canvasWidth,
      canvasHeight,
    );
    gradientCtx.drawImage(gradientState.backgroundImage, fit.drawX, fit.drawY, fit.drawWidth, fit.drawHeight);
  }

  if (!gradientState.overlayImage) return;

  const scaledWidth = Math.max(1, Math.round((gradientState.overlayImage.width * gradientState.scalePercent) / 100));
  const scaledHeight = Math.max(1, Math.round((gradientState.overlayImage.height * gradientState.scalePercent) / 100));

  gradientCtx.drawImage(gradientState.overlayImage, gradientState.x, gradientState.y, scaledWidth, scaledHeight);
}

function performPoissonBlend() {
  if (!gradientState.backgroundImage || !gradientState.overlayImage) return;

  const canvasWidth = gradientCanvas.width;
  const canvasHeight = gradientCanvas.height;
  const overlayWidth = Math.max(1, Math.round((gradientState.overlayImage.width * gradientState.scalePercent) / 100));
  const overlayHeight = Math.max(1, Math.round((gradientState.overlayImage.height * gradientState.scalePercent) / 100));
  const destX = Math.round(gradientState.x);
  const destY = Math.round(gradientState.y);

  const baseImageData = getBaseImageData(canvasWidth, canvasHeight);
  const overlayImageData = getScaledOverlayImageData(overlayWidth, overlayHeight);
  const blendedData = poissonBlendRect(baseImageData, overlayImageData, destX, destY, 500);

  gradientState.baseImageData = blendedData;
  gradientCtx.putImageData(blendedData, 0, 0);
}

function fitImageInsideCanvas(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  const imageRatio = imageWidth / imageHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;

  if (imageRatio > canvasRatio) {
    drawHeight = Math.round(canvasWidth / imageRatio);
  } else {
    drawWidth = Math.round(canvasHeight * imageRatio);
  }

  return {
    drawWidth,
    drawHeight,
    drawX: Math.round((canvasWidth - drawWidth) / 2),
    drawY: Math.round((canvasHeight - drawHeight) / 2),
  };
}

function resetOverlayPosition() {
  gradientState.x = 0;
  gradientState.y = 0;
  gradientPosXInput.value = "0";
  gradientPosYInput.value = "0";
  gradientPosXValue.textContent = "0";
  gradientPosYValue.textContent = "0";
}

function getBaseImageData(canvasWidth, canvasHeight) {
  if (gradientState.baseImageData) {
    return new ImageData(new Uint8ClampedArray(gradientState.baseImageData.data), canvasWidth, canvasHeight);
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;
  const offscreenCtx = offscreen.getContext("2d");

  const fit = fitImageInsideCanvas(
    gradientState.backgroundImage.width,
    gradientState.backgroundImage.height,
    canvasWidth,
    canvasHeight,
  );
  offscreenCtx.drawImage(gradientState.backgroundImage, fit.drawX, fit.drawY, fit.drawWidth, fit.drawHeight);

  return offscreenCtx.getImageData(0, 0, canvasWidth, canvasHeight);
}

function getScaledOverlayImageData(width, height) {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenCtx = offscreen.getContext("2d");
  offscreenCtx.drawImage(gradientState.overlayImage, 0, 0, width, height);
  return offscreenCtx.getImageData(0, 0, width, height);
}

function poissonBlendRect(targetImageData, sourceImageData, left, top, iterations) {
  const tw = targetImageData.width;
  const th = targetImageData.height;
  const sw = sourceImageData.width;
  const sh = sourceImageData.height;

  // Copy of output pixels
  const out = new Uint8ClampedArray(targetImageData.data);
  const source = sourceImageData.data;

  const startX = Math.max(0, left);
  const startY = Math.max(0, top);
  const endX = Math.min(tw, left + sw);
  const endY = Math.min(th, top + sh);

  // No overlap, exit
  if (startX >= endX || startY >= endY) {
    return new ImageData(out, tw, th);
  }

  // Blending region pos / dim
  const rw = endX - startX;
  const rh = endY - startY;
  const size = rw * rh;

  // Array | 1 = inside source, 0 = outside source
  const mask = new Uint8Array(size);

  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const sx = startX + x - left;
      const sy = startY + y - top;
      const sIdx = (sy * sw + sx) * 4;
      mask[y * rw + x] = source[sIdx + 3] > 0 ? 1 : 0;
    }
  }

  // Iterate for every RGB channel/colour (3)
  for (let c = 0; c < 3; c += 1) {
    let current = new Float32Array(size);
    let next = new Float32Array(size);

    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        const tx = startX + x;
        const ty = startY + y;
        const tIdx = (ty * tw + tx) * 4;
        current[y * rw + x] = out[tIdx + c];
      }
    }

    // Poission iterations
    for (let iter = 0; iter < iterations; iter += 1) {
      // Every pixel in the region
      for (let y = 0; y < rh; y += 1) {
        for (let x = 0; x < rw; x += 1) {
          const idx = y * rw + x;
          if (!mask[idx]) {
            next[idx] = current[idx];
            continue;
          }

          const tx = startX + x;
          const ty = startY + y;
          const sx = tx - left;
          const sy = ty - top;
          const center = source[(sy * sw + sx) * 4 + c];

          // Poission params
          let boundarySum = 0;
          let innerSum = 0;
          let gradSum = 0;

          // Uses 4-neighbor blending
          const neighbors = [
            [x + 1, y, sx + 1, sy],
            [x - 1, y, sx - 1, sy],
            [x, y + 1, sx, sy + 1],
            [x, y - 1, sx, sy - 1],
          ];

          for (let k = 0; k < neighbors.length; k += 1) {
            const [nx, ny, nsx, nsy] = neighbors[k];

            if (nsx >= 0 && nsx < sw && nsy >= 0 && nsy < sh) {
              const neighborSource = source[(nsy * sw + nsx) * 4 + c];
              gradSum += center - neighborSource;
            }

            if (nx >= 0 && nx < rw && ny >= 0 && ny < rh && mask[ny * rw + nx]) {
              innerSum += current[ny * rw + nx];
            } else {
              const ntx = startX + nx;
              const nty = startY + ny;
              if (ntx >= 0 && ntx < tw && nty >= 0 && nty < th) {
                boundarySum += out[(nty * tw + ntx) * 4 + c];
              } else {
                boundarySum += out[(ty * tw + tx) * 4 + c];
              }
            }
          }

          next[idx] = (innerSum + boundarySum + gradSum) / 4;
        }
      }

      const swap = current;
      current = next;
      next = swap;
    }

    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        const idx = y * rw + x;
        if (!mask[idx]) continue;
        const tx = startX + x;
        const ty = startY + y;
        const tIdx = (ty * tw + tx) * 4;
        out[tIdx + c] = clamp(current[idx]);
      }
    }
  }

  return new ImageData(out, tw, th);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image."));
    };

    image.src = objectUrl;
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    image.src = url;
  });
}

async function loadGradientImageFromCandidatePaths(candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    try {
      const image = await loadGradientImageFromResolvedUrl(candidates[i]);
      return image;
    } catch (_error) {
      // Try next path variant.
    }
  }

  throw new Error(`Failed to load preset from candidates: ${candidates.join(", ")}`);
}

function getGradientPresetUrlCandidates(folder, fileName) {
  const currentDir = window.location.pathname.replace(/\/[^/]*$/, "/");
  const fromCurrent = `${currentDir}public/${folder}/${fileName}`;
  const fromParent = `${currentDir}../public/${folder}/${fileName}`;
  return [
    `public/${folder}/${fileName}`,
    `./public/${folder}/${fileName}`,
    `../public/${folder}/${fileName}`,
    `${folder}/${fileName}`,
    `./${folder}/${fileName}`,
    `/public/${folder}/${fileName}`,
    `/${folder}/${fileName}`,
    fromCurrent,
    fromParent,
  ];
}

async function loadGradientImageFromResolvedUrl(candidate) {
  const resolved = new URL(candidate, window.location.href).href;

  try {
    const response = await fetch(resolved, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
      return await loadImageFromUrl(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (_error) {
    return loadImageFromUrl(resolved);
  }
}
