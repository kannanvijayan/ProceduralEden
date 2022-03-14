import { WgHandle } from "./wg-handle";

import shaderCode from "../shaders/wg-terrain.wgsl";
import { Dims2D } from "../../../common/utility/vector-math";

export type TerrainUniforms = {
  size: Dims2D;
  deepWaterLevel: number;
  shallowWaterLevel: number;
  lowLandLevel: number;
}

const ELEVATION_LIMIT = 0xfff;

/**
 * GPU-based assigner of terrain types.  This takes an elevation
 * buffer by `WgElevation`, and fills the top 4 bits with terrain
 * values, given the provided parameters.
 */
export class WgTerrain {
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
      label: "WgTerrain.BindGroupLayout",
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
      label: "WgTerrain.ComputePipeline",
      compute: {
        module: this.shader,
        entryPoint: "main"
      },
      layout: wg.device.createPipelineLayout({
        label: "WgTerrain.PipelineLayout",
        bindGroupLayouts: [ this.layout ]
      }),
    });
  }

  // Encode the annotation of terrain types for the given buffer.
  public async encodeGenerate(
    encoder: GPUCommandEncoder,
    target: GPUBuffer,
    options: TerrainUniforms,
  ): Promise<void> {
    // Encode the uniforms buffer update.
    await this.updateUniforms(encoder, options);
    const size = options.size;

    const computeBindGroup = this.wg.device.createBindGroup({
      label: "WgTerrain.BindGroup",
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

  private async updateUniforms(
    encoder: GPUCommandEncoder,
    uniforms: TerrainUniforms
  ): Promise<void> {
    await this.uniformsUpdate.mapAsync(GPUMapMode.WRITE);
    const arr = new Uint32Array(this.uniformsUpdate.getMappedRange());
    writeUniformArray(uniforms, arr);
    console.log("TerrainUniforms", uniforms);
    console.log("TerrainUniformsArray", arr.slice());
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
const UNIFORM_SIZE_BYTES = 8;
const UNIFORM_DEEP_WATER_LEVEL_BYTES = 4;
const UNIFORM_SHALLOW_WATER_LEVEL_BYTES = 4;
const UNIFORM_LOW_LAND_LEVEL_BYTES = 4;

const UNIFORM_SIZE_IDX = 0;
const UNIFORM_DEEP_WATER_LEVEL_IDX = 2;
const UNIFORM_SHALLOW_WATER_LEVEL_IDX = 3;
const UNIFORM_LOW_LAND_LEVEL_IDX = 4;

const UNIFORMS_BYTES =
  UNIFORM_SIZE_BYTES +
  UNIFORM_DEEP_WATER_LEVEL_BYTES +
  UNIFORM_SHALLOW_WATER_LEVEL_BYTES +
  UNIFORM_LOW_LAND_LEVEL_BYTES;

function writeUniformArray(uniforms: TerrainUniforms, arr: Uint32Array): void {
  arr[UNIFORM_SIZE_IDX + 0] = uniforms.size[0];
  arr[UNIFORM_SIZE_IDX + 1] = uniforms.size[1];
  arr[UNIFORM_DEEP_WATER_LEVEL_IDX] =
    convertSignedUnitToElevation(uniforms.deepWaterLevel);
  arr[UNIFORM_SHALLOW_WATER_LEVEL_IDX] =
    convertSignedUnitToElevation(uniforms.shallowWaterLevel);
  arr[UNIFORM_LOW_LAND_LEVEL_IDX] =
    convertSignedUnitToElevation(uniforms.lowLandLevel);
}

function convertSignedUnitToElevation(signedUnit: number): number {
  return Math.floor(((signedUnit + 1.0) / 2.0) * ELEVATION_LIMIT);
}