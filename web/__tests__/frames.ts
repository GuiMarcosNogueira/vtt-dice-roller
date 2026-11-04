import { vi } from "vitest";
import { FRAME_HEIGHT, FRAME_WIDTH } from "../app/lib/motion";

export interface Blob {
  x: number;
  y: number;
  size?: number;
  value?: number;
}

export interface FrameOptions {
  base?: number;
  texture?: number; // amplitude do xadrez de fundo (a "mesa" tem textura)
  shiftX?: number; // desloca a textura: simula a câmera balançando
  brightness?: number; // soma em toda a imagem: simula variação de luz/exposição
  blobs?: Blob[]; // "dados" desenhados por cima
}

const CELL = 8;

// Quadro RGBA 160x120: mesa texturizada (xadrez) com dados opcionais por cima
export function makeFrame({
  base = 100,
  texture = 40,
  shiftX = 0,
  brightness = 0,
  blobs = [],
}: FrameOptions = {}): Uint8ClampedArray {
  const data = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT * 4);
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const cell = (Math.floor((x + shiftX) / CELL) + Math.floor(y / CELL)) % 2;
      let value = base + (cell === 0 ? 0 : texture) + brightness;
      for (const blob of blobs) {
        const size = blob.size ?? 16;
        if (x >= blob.x && x < blob.x + size && y >= blob.y && y < blob.y + size) {
          value = blob.value ?? 230;
        }
      }
      const i = (y * FRAME_WIDTH + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return data;
}

// Faz o canvas de teste devolver, em getImageData, o quadro que o teste escolher
export function installFrameSource() {
  const source = { current: makeFrame() };
  HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
    if (contextId !== "2d") return null;
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: source.current })),
    } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return source;
}

export function readyVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", { value: 4, configurable: true });
  Object.defineProperty(video, "videoWidth", { value: 1280, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 720, configurable: true });
  return video;
}
