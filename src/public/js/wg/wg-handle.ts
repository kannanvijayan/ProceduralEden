import { alignIntegerUp } from "../../../common/utility/align-int";
import { TypedArrayConstructor } from "../../../common/utility/typed-arrays";

export const COLOR_TARGET_FORMAT = "bgra8unorm";

/**
 * Manages the GPU objects shared between the renderer
 * and compute structures.
 */
export class WgHandle {
  readonly gpu: GPU;
  readonly canvas: HTMLCanvasElement;
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly queue: GPUQueue;

  private constructor(opts: {
    gpu: GPU,
    canvas: HTMLCanvasElement,
    adapter: GPUAdapter,
    device: GPUDevice,
  }) {
    this.gpu = opts.gpu;
    this.canvas = opts.canvas;
    this.adapter = opts.adapter;
    this.device = opts.device;
    this.queue = this.device.queue;
  }

  public viewSize(): [number, number] {
    return [this.canvas.width, this.canvas.height];
  }

  public makeBuffer<T extends Float32Array | Uint32Array | Uint16Array>(
    arr: T,
    usage: GPUFlagsConstant,
  ): GPUBuffer {
    const size = alignIntegerUp(arr.byteLength, 4);
    const desc = { size, usage, mappedAtCreation: true };
    const buf = this.device.createBuffer(desc);
  
    const bufArray = new (arr.constructor as TypedArrayConstructor<T>)(
      buf.getMappedRange()
    );
    bufArray.set(arr);
    buf.unmap();
    return buf;
  }

  public makeUninitBuffer(size: number, usage: GPUFlagsConstant): GPUBuffer {
    const bufSize = alignIntegerUp(size, 4);
    const desc = { size, usage, mappedAtCreation: false };
    const buf = this.device.createBuffer(desc);
    return buf;
  }

  public makeShaderModule(code: any): GPUShaderModule {
    return this.device.createShaderModule({ code });
  }

  public makeCommandEncoder(): GPUCommandEncoder {
    return this.device.createCommandEncoder();
  }

  public static async create(opts: {
    canvas: HTMLCanvasElement
  }): Promise<WgHandle> {
    const gpu: GPU = navigator.gpu;
    if (!gpu) {
      throw new Error("Browser does not support WebGPU APIs");
    }
    console.log("Got GPU.", gpu);

    const { canvas } = opts;

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to request adapter.");
    }
    console.log("Got GPUAdapter", adapter);

    const device = await adapter.requestDevice();
    console.log("Got GPUDevice", device);

    return new WgHandle({ gpu, canvas, adapter, device });
  }
}