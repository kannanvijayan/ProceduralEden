import { WgHandle } from "./wg-handle";

import shaderCode from "../shaders/wg-terrain.wgsl";
import { Dims2D } from "../../../common/utility/vector-math";

/**
 * Various tile-coordinate indexed GPU buffers are used to prepare
 * a data buffer containing answers to unit info queries.
 * 
 * 1. Unit Info Query Flag map (UIQF) Map
 *   - A map from tiles to a 8-bit value, where each bit indicates an
 *     interest in reading a particular word from the public word
 *     buffer of a unit at that tile.
 *   - For the purposes of this file, this is an input buffer.
 *   - This buffer is generated by operating over every unit, iterting
 *     over each unit info query in its current set of state machine nodes,
 *     and atomically marking that flag in in the appropriate UIQF map word.
 * 2. Unit Info Query Count (16x16) Count (UIQC-16) Map
 *    Unit Info Query Count (256x256) Count (UIQC-256) Map
 *    Unit Info Query Count (4096x4096) Count (UIQC-4096) Map
 *   - These buffers are turn transient (doesn't need to live across turns)
 *   - A map from tile panels of the given size to a u32 count of the total
 *     words that are needed for all the unit info queries for all tiles in
 *     that panel.
 *   - Filled by a shader run that sums over entries in the next higher
 *     resolution panel buffer, with UIQC-16 being populated by counting the
 *     number of 1-valued bits in each constituent 16-bit UIQF value.
 * 3. Unit Info Query Index (4096x4096) Count (UIQX-4096) Map
 *    Unit Info Query Index (256x256) Count (UIQX-256) Map
 *    Unit Info Query Index (16x16) Count (UIQX-16) Map
 *   - These buffers are turn transient (doesn't need to live across turns)
 *   - A map from panels of the given size to a u32 index into the Unit Info
 *     Readout buffer.
 *   - UIQX-4096 (a size 2x1 buffer), is filled by iterating over the
 *     buffer and summing over all prior values.
 *   - UIQX-256 and UIQX-16 are filled by iterating over the index value from
 *     the next lower resolution panel buffer, and filling all higher resolution
 *     sub-panels within it by summing all prior values in the sub-panel and
 *     adding it to the index value.
 * 4. Unit Info Query Position map (UIQP)
 *   - This buffer is turn transient (doesn't need to live across turns)
 *   - A map from tiles to a 16-bit, indicating how much to offset from the
 *     index value for the corresponding panel in the UIQX-16 map, to get
 *     the start index for the sequence of unit info words for the given tile.
 *   - This is computed by mapping over every entry in UIQX-16, iterating
 *     over every UIQF entry for every constituent tile, and writing out
 *     the cumulative sum of all the set bits in each prior UIQF word.
 * 
 * The inputof this process is 1 buffer:
 *   - The UIQF buffer containing per-tile query flags.
 *
 * The visible output of this process is 3 buffers:
 *   - The UIQP buffer mapping tiles to an offset from the 16x16 panel index
 *     into the UIQR buffer.
 *   - The UIQX-16 buffer mapping 16x16 tile panels to the index of the
 *     start of the concatenation all result sequences for tiles in the panel.
 * 
 * The usage of the two buffers is as follows:
 * ```
 *   // Given a tile position, compute the index of the first result
 *   // word for this tile within the unit info query result (UIQR) u32-array.
 *   inputs {
 *     tile: vec2<u32>;
 *   }
 *   buffers: {
 *     UIQP: array2d<u16>; 
 *     UIQX16: array2d<u32>;
 *   }
 *   outputs {
 *     uiqResultsIdx: u32;
 *   }
 *   let panel = inputs.tile / 16u;
 *   let panelIdx = buffers.UIQX16[panel];
 *   let tileOffset = buffers.UIQP[inputs.tile];
 *   let tileIdx = panelIdx + tileOffset;
 * 
 *   // If the high bit (bit 15) of tileOffset is 1, then
 *   // return 0 instead.  To do this, we first produce
 *   // a &-mask that's 0-valued or u32max-valued, and
 *   // use it to adjust the tileIdx before returning.
 *   let highBit = tileOffset >> 15; // result is 0 or 1
 *   let mask = highBit - 1; // 0 becomes 11....11, 1 becomes 00....00
 * 
 *   outputs.uiqResultsIdx = tileIdx & mask;
 * ```
 */


export type TileUniforms = {
  size: Dims2D;
  deepWaterLevel: number;
  shallowWaterLevel: number;
  lowLandLevel: number;
}

const ELEVATION_LIMIT = 0xfff;

/**
 * Helper class for operating on buffers which are mapped by
 * tile coordinates.
 */
export class WgUiq {
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
      label: "WgUiq.BindGroupLayout",
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
      label: "WgUiq.ComputePipeline",
      compute: {
        module: this.shader,
        entryPoint: "main"
      },
      layout: wg.device.createPipelineLayout({
        label: "WgUiq.PipelineLayout",
        bindGroupLayouts: [ this.layout ]
      }),
    });
  }

  // Encode the annotation of terrain types for the given buffer.
  public async encodeGenerate(
    encoder: GPUCommandEncoder,
    target: GPUBuffer,
    options: TileUniforms,
  ): Promise<void> {
    // Encode the uniforms buffer update.
    await this.updateUniforms(encoder, options);
    const size = options.size;

    const computeBindGroup = this.wg.device.createBindGroup({
      label: "WgUiq.BindGroup",
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
    uniforms: TileUniforms
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

function writeUniformArray(uniforms: TileUniforms, arr: Uint32Array): void {
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