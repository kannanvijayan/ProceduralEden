import { strict as assert } from "assert";
import { WgHandle } from "./wg-handle";

import shaderCode from "../shaders/wg-elevation.wgsl";
import { Dims2D } from "../../../common/utility/vector-math";
import { isPowerOfTwo } from "../../../common/utility/align-int";

export type ElevationUniforms = {
  seed: number;
  scale: number;
  pan: [number, number];
  size: [number, number];
  repeat: number;
}

/**
 * GPU-based generator of an elevation map.  The field data is written
 * to GPU buffers as 16-bit unsigned values.  Each 16-bit value is
 * packed into an array of 32-bit words in little-endian order.
 * 
 * The elevation value itself ranges from 0 to 0x0fff (inclusive).
 * This leaves the top 4 bits of the 16-bit value available to store
 * a terrain type.
 */
export class WgElevation {
  private readonly wg: WgHandle;

  // The uniforms buffer, and the mappable update buffer.
  private readonly uniforms: GPUBuffer;
  private readonly uniformsUpdate: GPUBuffer;

  // The shader code.
  private readonly shader: GPUShaderModule;

  // The bind group layout.
  private readonly layout: GPUBindGroupLayout;

  // The pipeline.
  private readonly pipeline: GPUComputePipeline;

  public constructor(wg: WgHandle) {
    this.wg = wg;

    this.shader = wg.makeShaderModule(shaderCode);

    this.uniforms = wg.makeUninitBuffer(
      UNIFORMS_BYTES,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    this.uniformsUpdate = wg.makeUninitBuffer(
      UNIFORMS_BYTES,
      GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC
    );

    this.layout = wg.device.createBindGroupLayout({
      label: "WgElevation.BindGroupLayout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        }
      ]
    });

    this.pipeline = wg.device.createComputePipeline({
      label: "WgElevation.Pipeline",
      compute: {
        module: this.shader,
        entryPoint: "main"
      },
      layout: wg.device.createPipelineLayout({
        label: "WgElevation.PipelineLayout",
        bindGroupLayouts: [ this.layout ]
      }),
    });
  }

  // Encode the generation of the elevation field into the specified buffers.
  public async encodeGenerate(
    encoder: GPUCommandEncoder,
    target: GPUBuffer,
    options: ElevationUniforms,
  ): Promise<void> {
    // Encode the uniforms buffer update.
    await this.updateUniforms(encoder, options);
    const size = options.size;

    const computeBindGroup = this.wg.device.createBindGroup({
      label: "WgElevation.BindGroup",
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniforms } },
        { binding: 1, resource: { buffer: target } },
      ],
    });

    const passEnc = encoder.beginComputePass();
    passEnc.setPipeline(this.pipeline);
    passEnc.setBindGroup(0, computeBindGroup);

    // Each shader cell generates 2 values on a row.
    const workgroupSize = [8, 8];
    const groupx = Math.ceil(size[0] / (2 * workgroupSize[0]));
    const groupy = Math.ceil(size[1] / (2 * workgroupSize[1]));
    passEnc.dispatch(groupx, groupy);

    passEnc.end();
  }

  // Create a GPU buffer that holds elevation data with 16 bits per tile.
  public makeTargetBuffer(size: Dims2D, usage: number): GPUBuffer {
    assert(
      isPowerOfTwo(size[0]) && isPowerOfTwo(size[1]),
      "Expect power-of-two width and height."
    );
    return this.wg.makeUninitBuffer(
      size[0] * size[1] * 2,
      GPUBufferUsage.STORAGE | usage,
    );
  }

  private async updateUniforms(
    encoder: GPUCommandEncoder,
    uniforms: ElevationUniforms
  ): Promise<void> {
    await this.uniformsUpdate.mapAsync(GPUMapMode.WRITE);
    const arr = new Uint32Array(this.uniformsUpdate.getMappedRange());
    writeUniformArray(uniforms, arr);
    this.uniformsUpdate.unmap();

    encoder.copyBufferToBuffer(
      this.uniformsUpdate, 0,
      this.uniforms, 0,
      UNIFORMS_BYTES,
    );
  }
}


/**
 * The uniforms format:
 * 
 * seed: u32;
 * scale: u32;
 * top_left: vec2<u32>;
 * size: vec2<u32>;
 * repeat_x: u32;
 */
const UNIFORM_SEED_BYTES = 4;
const UNIFORM_SCALE_BYTES = 4;
const UNIFORM_PAN_BYTES = 8;
const UNIFORM_SIZE_BYTES = 8;
const UNIFORM_REPEAT_BYTES = 4;

const UNIFORM_SEED_IDX = 0;
const UNIFORM_SCALE_IDX = 1;
const UNIFORM_PAN_IDX = 2;
const UNIFORM_SIZE_IDX = 4;
const UNIFORM_REPEAT_IDX = 6;

const UNIFORMS_BYTES =
  UNIFORM_SEED_BYTES +
  UNIFORM_SCALE_BYTES +
  UNIFORM_PAN_BYTES +
  UNIFORM_SIZE_BYTES +
  UNIFORM_REPEAT_BYTES;

function writeUniformArray(uniforms: ElevationUniforms, arr: Uint32Array): void {
  arr[UNIFORM_SEED_IDX] = uniforms.seed;
  arr[UNIFORM_SCALE_IDX] = uniforms.scale;
  arr[UNIFORM_PAN_IDX + 0] = uniforms.pan[0];
  arr[UNIFORM_PAN_IDX + 1] = uniforms.pan[1];
  arr[UNIFORM_SIZE_IDX + 0] = uniforms.size[0];
  arr[UNIFORM_SIZE_IDX + 1] = uniforms.size[1];
  arr[UNIFORM_REPEAT_IDX] = uniforms.repeat;
}