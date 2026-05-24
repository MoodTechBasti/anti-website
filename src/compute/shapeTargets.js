// Shape-Sampling: portiert aus particles.js (getShapeImageData + createPointsDistanceDataWorker)
// 1:1 — Algorithmus unveraendert. Einziger Unterschied: das Ergebnis schreibt
// in EINEN StorageBuffer (targets) statt 5 separate DataTextures.
//
// Wieso die Worker-Logik bleibt: Distance-Transform und Poisson-Sampling sind
// reine CPU-Arbeit (kein WebGPU-Compute lohnt sich bei 5 einmaligen Shapes mit
// je ~500x500 Pixeln). Workers parallelisieren die 5 Shapes auf 5 Threads.

// 2D-Poisson-Disk-Sampling fuer Basis-Punkte (refs).
// Identisch zu particles.js:19-97.
export function generateBasePoints(density) {
  const minDst = ((density - 0) * (2 - 10)) / (300 - 0) + 10;
  const maxDst = ((density - 0) * (3 - 11)) / (300 - 0) + 11;
  const width = 500;
  const height = 500;
  const activeList = [];
  const samples = [];
  const cellSize = maxDst / Math.sqrt(2);
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid = new Int32Array(gridWidth * gridHeight).fill(-1);

  const insertSample = (p) => {
    const idx = samples.length;
    samples.push(p);
    activeList.push(idx);
    const gx = Math.floor(p[0] / cellSize);
    const gy = Math.floor(p[1] / cellSize);
    grid[gx + gy * gridWidth] = idx;
  };

  insertSample([Math.random() * width, Math.random() * height]);
  const tries = 20;
  while (activeList.length > 0) {
    const activeIdx = activeList[Math.floor(Math.random() * activeList.length)];
    const p = samples[activeIdx];
    let gotSample = false;
    for (let t = 0; t < tries; t++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDst + Math.random() * (maxDst - minDst);
      const nx = p[0] + Math.cos(angle) * dist;
      const ny = p[1] + Math.sin(angle) * dist;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        let tooClose = false;
        const gx = Math.floor(nx / cellSize);
        const gy = Math.floor(ny / cellSize);
        const searchRadius = Math.ceil(maxDst / cellSize);
        for (let cx = -searchRadius; cx <= searchRadius && !tooClose; cx++) {
          for (let cy = -searchRadius; cy <= searchRadius && !tooClose; cy++) {
            const tgx = gx + cx;
            const tgy = gy + cy;
            if (tgx >= 0 && tgx < gridWidth && tgy >= 0 && tgy < gridHeight) {
              const sIdx = grid[tgx + tgy * gridWidth];
              if (sIdx !== -1) {
                const sp = samples[sIdx];
                const d = Math.sqrt((nx - sp[0]) ** 2 + (ny - sp[1]) ** 2);
                if (d < minDst) tooClose = true;
              }
            }
          }
        }
        if (!tooClose) {
          insertSample([nx, ny]);
          gotSample = true;
          break;
        }
      }
    }
    if (!gotSample) {
      const idxInActive = activeList.indexOf(activeIdx);
      if (idxInActive !== -1) activeList.splice(idxInActive, 1);
    }
  }
  return samples;
}

// Canvas-2D-Rendering der 5 Shapes. Identisch zu particles.js:100-205.
export function getShapeImageData(shapeIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 500, 500);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  if (shapeIndex === 0) {
    ctx.font = 'bold 360px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 250, 250);
  } else if (shapeIndex === 1) {
    ctx.font = 'bold 360px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', 250, 250);
  } else if (shapeIndex === 2) {
    ctx.lineWidth = 18;
    const cx = 250, cy = 250;
    const outerRadius = 140, innerRadius = 90, holeRadius = 35;
    const teeth = 8;
    const theta = Math.PI / teeth;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const angle = i * theta;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeIndex === 3) {
    ctx.lineWidth = 15;
    const cx = 250, cy = 250, r = 150;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.86, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.86, cy - r * 0.5);
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx - r * 0.86, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.86, cy + r * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.4, r, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, r * 0.7, r, 0, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
  } else if (shapeIndex === 4) {
    ctx.lineWidth = 15;
    const cx = 250, cy = 250, size = 120;
    const dx = size * Math.cos(Math.PI / 6);
    const dy = size * Math.sin(Math.PI / 6);
    const pCenter = [cx, cy];
    const pTop = [cx, cy - size];
    const pBottom = [cx, cy + size];
    const pTopLeft = [cx - dx, cy - dy];
    const pTopRight = [cx + dx, cy - dy];
    const pBottomLeft = [cx - dx, cy + dy];
    const pBottomRight = [cx + dx, cy + dy];
    ctx.beginPath();
    ctx.moveTo(pTop[0], pTop[1]);
    ctx.lineTo(pTopRight[0], pTopRight[1]);
    ctx.lineTo(pBottomRight[0], pBottomRight[1]);
    ctx.lineTo(pBottom[0], pBottom[1]);
    ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
    ctx.lineTo(pTopLeft[0], pTopLeft[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pCenter[0], pCenter[1]);
    ctx.lineTo(pTop[0], pTop[1]);
    ctx.moveTo(pCenter[0], pCenter[1]);
    ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
    ctx.moveTo(pCenter[0], pCenter[1]);
    ctx.lineTo(pBottomRight[0], pBottomRight[1]);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, 500, 500);
}

// Worker-basierte Sampling-Distribution. Algorithmus aus
// particles.js:423-494 portiert, aber Output ist jetzt Float32Array statt
// "nearestPoints"-Array. count = N (Anzahl Partikel), nicht basePoints.length.
function sampleShapeInWorker(imageData, count, index) {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = function(e) {
        const { imageData, count, index } = e.data;
        const distanceFunction = function(point, imgData) {
          const x = Math.round(point[0]);
          const y = Math.round(point[1]);
          if (x < 0 || x >= imgData.width || y < 0 || y >= imgData.height) return 1.0;
          const pixelRedIndex = (x + y * imgData.width) * 4;
          const pixel = imgData.data[pixelRedIndex] / 255;
          return pixel * pixel * pixel;
        };
        const width = imageData.width;
        const height = imageData.height;
        const samples = [];
        const step = 6;
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const p = [x, y];
            if (distanceFunction(p, imageData) < 0.95) samples.push(p);
          }
        }
        if (samples.length === 0) samples.push([width / 2, height / 2]);
        const out = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          const nearestPoint = samples[i % samples.length];
          out[i * 2 + 0] = (nearestPoint[0] - 250) / 250;
          out[i * 2 + 1] = (nearestPoint[1] - 250) / 250;
        }
        self.postMessage({ targets: out, index }, [out.buffer]);
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);
    worker.onmessage = (eData) => {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve(eData.data);
    };
    worker.onerror = (err) => {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      reject(err);
    };
    worker.postMessage({ imageData, count, index });
  });
}

// Sample alle 5 Shapes parallel, pack sie als concat in ein einzelnes
// Float32Array[N*5*2] fuer den StorageBuffer.
export async function buildShapeTargets({ count }) {
  const promises = [];
  for (let idx = 0; idx < 5; idx++) {
    const imgData = getShapeImageData(idx);
    promises.push(sampleShapeInWorker(imgData, count, idx));
  }
  const results = await Promise.all(promises);
  results.sort((a, b) => a.index - b.index);

  // Flat buffer: targets[shapeIdx * N + particleIdx] -> vec2
  const flat = new Float32Array(count * 5 * 2);
  for (let s = 0; s < 5; s++) {
    flat.set(results[s].targets, s * count * 2);
  }
  return flat;
}

// Live-Text-Sampling fuer morphToText. Schreibt in einen separaten Buffer
// (count*2 floats), den ParticleUniverse als 6tes Shape-Slot in den
// targets-Buffer schreibt (Slot 5, der erste "frei" jenseits der 5 Standard-Shapes).
export function buildTextTargets({ text, count, font = 'bold 360px sans-serif' }) {
  const size = 500;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Auto-Fit
  let fontSize = 360;
  while (ctx.measureText(text).width > size * 0.88 && fontSize > 30) {
    fontSize -= 10;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillText(text, size / 2, size / 2);

  const imageData = ctx.getImageData(0, 0, size, size);
  const samples = [];
  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const idx = (x + y * size) * 4;
      const v = imageData.data[idx] / 255;
      if (v * v * v < 0.95) samples.push([x, y]);
    }
  }
  if (samples.length === 0) samples.push([size / 2, size / 2]);

  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const p = samples[i % samples.length];
    out[i * 2 + 0] = (p[0] - 250) / 250;
    out[i * 2 + 1] = (p[1] - 250) / 250;
  }
  return out;
}
