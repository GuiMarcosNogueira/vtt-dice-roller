// Análise de movimento sobre quadros reduzidos (160x120, RGBA).
// Cada quadro vira uma grade de blocos de 8x8 pixels com a média de cinza de cada um, o que
// torna a comparação imune a ruído do sensor e a deslocamentos de poucos pixels.

export const FRAME_WIDTH = 160;
export const FRAME_HEIGHT = 120;
export const BLOCK_SIZE = 8;
export const BLOCK_COLS = FRAME_WIDTH / BLOCK_SIZE;
export const BLOCK_ROWS = FRAME_HEIGHT / BLOCK_SIZE;
export const BLOCK_COUNT = BLOCK_COLS * BLOCK_ROWS;

// Fração de blocos que precisa mudar para contar como movimento (3 blocos de 300)
export const MIN_CHANGED_RATIO = 0.01;
// A partir daqui a imagem toda mudou: é a câmera (ou a luz), não um dado
export const GLOBAL_CHANGED_RATIO = 0.5;

export function blockMeans(rgba: Uint8ClampedArray): Float32Array {
  const sums = new Float32Array(BLOCK_COUNT);
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    const blockRow = Math.floor(y / BLOCK_SIZE) * BLOCK_COLS;
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const i = (y * FRAME_WIDTH + x) * 4;
      sums[blockRow + Math.floor(x / BLOCK_SIZE)] += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
    }
  }
  const area = BLOCK_SIZE * BLOCK_SIZE;
  for (let b = 0; b < BLOCK_COUNT; b++) sums[b] /= area;
  return sums;
}

// Fração dos blocos cuja média de cinza mudou mais que `threshold` níveis
export function changedRatio(a: Float32Array, b: Float32Array, threshold: number): number {
  let changed = 0;
  for (let i = 0; i < BLOCK_COUNT; i++) {
    if (Math.abs(a[i] - b[i]) > threshold) changed++;
  }
  return changed / BLOCK_COUNT;
}

// Diferença média de cinza entre os quadros (alimenta o medidor de movimento)
export function meanDifference(a: Float32Array, b: Float32Array): number {
  let total = 0;
  for (let i = 0; i < BLOCK_COUNT; i++) total += Math.abs(a[i] - b[i]);
  return total / BLOCK_COUNT;
}
