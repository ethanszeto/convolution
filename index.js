const input = document.getElementById("image-input");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const toolButtons = document.querySelectorAll(".tool-button");
const brushSizeInput = document.getElementById("brush-size");
const brushSizeValue = document.getElementById("brush-size-value");
const applyWholeImageButton = document.getElementById("apply-whole-image-button");
const kernelInputs = document.querySelectorAll(".kernel-input");
const kernelDivisorInput = document.getElementById("kernel-divisor");
const deconvIterationsInput = document.getElementById("deconv-iterations");
const deconvIterationsValue = document.getElementById("deconv-iterations-value");

let currentTool = "none";
let isPainting = false;

const FILTERS = {
  "mean-filter": {
    mode: "weighted",
    kernel: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    divisor: 9,
  },
  "median-filter": {
    mode: "median",
    kernel: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    divisor: 1,
  },
  "edge-detection": {
    mode: "weighted",
    kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
    divisor: 1,
  },
  "diag-emboss": {
    mode: "weighted",
    kernel: [0, 0, 2, 0, 0, 0, 0, 0, -2],
    divisor: 1,
  },
  sharpen: {
    mode: "weighted",
    kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0],
    divisor: 1,
  },
  "custom-filter": {
    mode: "weighted",
    getKernel: () => getCustomKernel(),
    getDivisor: () => Math.max(1, Number(kernelDivisorInput.value) || 1),
  },
  deconvolution: {
    mode: "richardsonLucy",
    psf: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    getIterations: () => {
      const n = Number.parseInt(deconvIterationsInput.value, 10);
      return Number.isNaN(n) ? 12 : Math.max(1, Math.min(50, n));
    },
  },
};

input.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const imgWidth = img.width;
      const imgHeight = img.height;

      const ratio = imgWidth / imgHeight;

      let scaledWidth, scaledHeight;

      if (ratio > 1) {
        const scale = width / imgWidth;
        scaledWidth = width;
        scaledHeight = imgHeight * scale;
      } else {
        const scale = height / imgHeight;
        scaledWidth = imgWidth * scale;
        scaledHeight = height;
      }

      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      URL.revokeObjectURL(img.src);
    };
  }
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentTool = button.dataset.tool;
    toolButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
  });
});

brushSizeInput.addEventListener("input", () => {
  brushSizeValue.textContent = brushSizeInput.value;
});

deconvIterationsInput.addEventListener("input", () => {
  deconvIterationsValue.textContent = deconvIterationsInput.value;
});

canvas.addEventListener("mousedown", (e) => {
  if (currentTool === "none") return;
  isPainting = true;
  applyEffectAtCursor(e);
});

canvas.addEventListener("mousemove", (e) => {
  if (!isPainting || currentTool === "none") return;
  applyEffectAtCursor(e);
});

canvas.addEventListener("mouseup", () => {
  isPainting = false;
});

canvas.addEventListener("mouseleave", () => {
  isPainting = false;
});

applyWholeImageButton.addEventListener("click", () => {
  applyEffectToWholeImage();
});

function applyEffectAtCursor(mouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor(mouseEvent.clientX - rect.left);
  const cy = Math.floor(mouseEvent.clientY - rect.top);
  const radius = Number(brushSizeInput.value);

  const x = Math.max(0, cx - radius);
  const y = Math.max(0, cy - radius);
  const patchWidth = Math.min(width - x, radius * 2 + 1);
  const patchHeight = Math.min(height - y, radius * 2 + 1);

  if (patchWidth <= 0 || patchHeight <= 0) return;

  // Read the local patch around the cursor and write updates directly back.
  const patch = ctx.getImageData(x, y, patchWidth, patchHeight);
  const source = new Uint8ClampedArray(patch.data);
  const output = patch.data;
  const filterConfig = getActiveFilterConfig();

  if (!filterConfig) return;

  if (filterConfig.mode === "richardsonLucy") {
    if (patchWidth < 3 || patchHeight < 3) return;
    applyRichardsonLucy(patch, filterConfig, {
      patchLeft: x,
      patchTop: y,
      cx,
      cy,
      radius,
    });
    ctx.putImageData(patch, x, y);
    return;
  }

  for (let py = 0; py < patchHeight; py += 1) {
    for (let px = 0; px < patchWidth; px += 1) {
      const dx = x + px - cx;
      const dy = y + py - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (px === 0 || py === 0 || px === patchWidth - 1 || py === patchHeight - 1) continue;

      applyConvolution(px, py, patchWidth, source, output, filterConfig);
    }
  }

  ctx.putImageData(patch, x, y);
}

function applyEffectToWholeImage() {
  const filterConfig = getActiveFilterConfig();

  if (!filterConfig) return;

  const image = ctx.getImageData(0, 0, width, height);

  if (filterConfig.mode === "richardsonLucy") {
    applyRichardsonLucy(image, filterConfig, null);
    ctx.putImageData(image, 0, 0);
    return;
  }

  const source = new Uint8ClampedArray(image.data);
  const output = image.data;

  for (let py = 1; py < height - 1; py += 1) {
    for (let px = 1; px < width - 1; px += 1) {
      applyConvolution(px, py, width, source, output, filterConfig);
    }
  }

  ctx.putImageData(image, 0, 0);
}

function applyConvolution(px, py, patchWidth, source, output, filterConfig) {
  const kernel = filterConfig.getKernel ? filterConfig.getKernel() : filterConfig.kernel;
  const divisor = filterConfig.getDivisor ? filterConfig.getDivisor() : filterConfig.divisor;
  const outputIndex = (py * patchWidth + px) * 4;

  if (filterConfig.mode === "weighted") {
    const channels = [0, 0, 0];
    let kernelIndex = 0;

    for (let ky = -1; ky <= 1; ky += 1) {
      for (let kx = -1; kx <= 1; kx += 1) {
        const pixelIndex = ((py + ky) * patchWidth + (px + kx)) * 4;
        const weight = kernel[kernelIndex];
        channels[0] += source[pixelIndex] * weight;
        channels[1] += source[pixelIndex + 1] * weight;
        channels[2] += source[pixelIndex + 2] * weight;
        kernelIndex += 1;
      }
    }

    output[outputIndex] = clamp(Math.round(channels[0] / divisor));
    output[outputIndex + 1] = clamp(Math.round(channels[1] / divisor));
    output[outputIndex + 2] = clamp(Math.round(channels[2] / divisor));
    return;
  }

  const reds = [];
  const greens = [];
  const blues = [];

  for (let ky = -1; ky <= 1; ky += 1) {
    for (let kx = -1; kx <= 1; kx += 1) {
      const pixelIndex = ((py + ky) * patchWidth + (px + kx)) * 4;
      const weight = kernel[(ky + 1) * 3 + (kx + 1)];

      for (let repeat = 0; repeat < weight; repeat += 1) {
        reds.push(source[pixelIndex]);
        greens.push(source[pixelIndex + 1]);
        blues.push(source[pixelIndex + 2]);
      }
    }
  }

  if (reds.length === 0) return;

  reds.sort((a, b) => a - b);
  greens.sort((a, b) => a - b);
  blues.sort((a, b) => a - b);

  const medianIndex = Math.floor(reds.length / 2);
  output[outputIndex] = reds[medianIndex];
  output[outputIndex + 1] = greens[medianIndex];
  output[outputIndex + 2] = blues[medianIndex];
}

function getActiveFilterConfig() {
  return FILTERS[currentTool] ?? null;
}

function getCustomKernel() {
  return Array.from(kernelInputs, (inputEl) => {
    const value = Number.parseInt(inputEl.value, 10);
    return Number.isNaN(value) ? 0 : value;
  });
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function flipKernel3(kernel) {
  const out = new Array(9);
  for (let i = 0; i < 9; i += 1) {
    out[i] = kernel[8 - i];
  }
  return out;
}

function normalizePsf(kernel) {
  const sum = kernel.reduce((acc, v) => acc + v, 0) || 1;
  return kernel.map((v) => v / sum);
}

function convolveAtFloat(buffer, w, h, x, y, kernel9) {
  let sum = 0;
  let ki = 0;
  for (let ky = -1; ky <= 1; ky += 1) {
    for (let kx = -1; kx <= 1; kx += 1) {
      const ix = clampInt(x + kx, 0, w - 1);
      const iy = clampInt(y + ky, 0, h - 1);
      sum += buffer[iy * w + ix] * kernel9[ki];
      ki += 1;
    }
  }
  return sum;
}

/**
 * Richardson–Lucy deconvolution
 *
 * @param {ImageData} imageData
 * @param {object} filterConfig
 * @param {null | { patchLeft: number, patchTop: number, cx: number, cy: number, radius: number }} brush
 */
function applyRichardsonLucy(imageData, filterConfig, brush) {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  if (w < 3 || h < 3) return;

  const iterations = filterConfig.getIterations ? filterConfig.getIterations() : filterConfig.iterations;
  const psfRaw = filterConfig.psf;
  const psfN = normalizePsf(psfRaw);
  const psfFlip = flipKernel3(psfN);

  const blurBuf = new Float32Array(n);
  const ratioBuf = new Float32Array(n);
  const corrBuf = new Float32Array(n);
  const sourceCopy = new Uint8ClampedArray(data);

  for (let c = 0; c < 3; c += 1) {
    const u = new Float32Array(n);
    const d = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const v = sourceCopy[i * 4 + c];
      u[i] = v;
      d[i] = v;
    }

    for (let iter = 0; iter < iterations; iter += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          blurBuf[y * w + x] = convolveAtFloat(u, w, h, x, y, psfN);
        }
      }
      for (let i = 0; i < n; i += 1) {
        ratioBuf[i] = d[i] / Math.max(blurBuf[i], 1e-4);
      }
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          corrBuf[y * w + x] = convolveAtFloat(ratioBuf, w, h, x, y, psfFlip);
        }
      }
      for (let i = 0; i < n; i += 1) {
        u[i] *= corrBuf[i];
        if (u[i] < 0) u[i] = 0;
        if (u[i] > 255) u[i] = 255;
      }
    }

    for (let i = 0; i < n; i += 1) {
      const px = i % w;
      const py = (i / w) | 0;

      if (brush) {
        const wx = brush.patchLeft + px;
        const wy = brush.patchTop + py;
        const dx = wx - brush.cx;
        const dy = wy - brush.cy;
        const onEdge = px === 0 || py === 0 || px === w - 1 || py === h - 1;
        if (onEdge || dx * dx + dy * dy > brush.radius * brush.radius) {
          continue;
        }
      }

      data[i * 4 + c] = clamp(Math.round(u[i]));
    }
  }
}
