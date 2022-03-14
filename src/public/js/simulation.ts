import { SimulationState } from "../../common/simulation-state";
import { Coord2D, Dims2D } from "../../common/utility/vector-math";
import { WgHandle } from "./wg/wg-handle";
import { TopoRenderer } from "./topo-renderer";
import { WgElevation } from "./wg/wg-elevation";
import { WgTerrain } from "./wg/wg-terrain";

/**
 * The actual simulation is run on the frontend.
 */
export class Simulation {
  readonly simState: SimulationState;
  private readonly wg: WgHandle;
  private readonly canvas: HTMLCanvasElement;
  private readonly wgElevation: WgElevation;
  private readonly wgTerrain: WgTerrain;
  private readonly topoRenderer: TopoRenderer;

  // The surface buffer being rendered to.
  private readonly surfaceBuffer: GPUBuffer;

  private constructor(opts: {
    simState: SimulationState,
    wg: WgHandle,
    canvas: HTMLCanvasElement,
    topoRenderer: TopoRenderer,
  }) {
    this.simState = opts.simState;
    this.wg = opts.wg;
    this.canvas = opts.canvas;
    this.wgElevation = new WgElevation(this.wg);
    this.wgTerrain = new WgTerrain(this.wg);
    this.topoRenderer = opts.topoRenderer;

    this.surfaceBuffer = this.wgElevation.makeTargetBuffer(
      this.simState.initState.worldDims,
      GPUBufferUsage.COPY_SRC
    );
  }

  public addNewRandomUnits(count: number) {
    this.simState.addNewRandomUnits(count);
  }

  // Just draw a perlin frame to screen.
  public async drawPerlinFrame(opts: {
    seed: number,
    size: Dims2D,
    scale: number,
    repeat?: number,
    viewOffset: Coord2D,
    zoom?: number,
  }): Promise<void> {
    const { seed, scale, viewOffset } = opts;
    // Always render the simulation size.
    const worldDims = this.simState.initState.worldDims;
    const zoom = opts.zoom || 1;
    const pan: Dims2D = [0, 0];
    const timeStart = Date.now();
    const repeat = opts.repeat || 10;
    const encoder = this.wg.device.createCommandEncoder();
    await this.wgElevation.encodeGenerate(
      encoder,
      this.surfaceBuffer,
      { seed, scale, pan, size: worldDims, repeat }
    );
    await this.wgTerrain.encodeGenerate(encoder, this.surfaceBuffer, {
      size: worldDims,
      deepWaterLevel: 0.01,
      shallowWaterLevel: 0.06,
      lowLandLevel: 0.25,
    });
    /*
    this.perlinWgpu.encodeGenerate({ encoder, seed, size, scale, repeat });
    */
    const viewport: Dims2D = [
      (this.canvas.width / zoom)|0,
      (this.canvas.height / zoom)|0,
    ];
    this.topoRenderer.encodeRender({
      perlinData: this.surfaceBuffer,
      worldDims,
      encoder,
      viewOffset,
      viewport,
      zoom,
    });

    // Submit the command and wait for it to complete.
    this.wg.queue.submit([encoder.finish()]);
    await this.wg.queue.onSubmittedWorkDone();
    const timeEnd = Date.now();
    console.log("Perlin Generate Time", timeEnd - timeStart);
  }

  // Repaint a drawn perlin frame.
  public async repaintPerlinFrame(opts: {
    viewOffset: Coord2D,
    zoom?: number
  }): Promise<void> {
    const { viewOffset } = opts;
    const zoom = opts.zoom || 1;
    const viewport: Dims2D = [
      this.canvas.width / zoom,
      this.canvas.height / zoom,
    ];
    const timeStart = Date.now();
    const encoder = this.wg.device.createCommandEncoder();
    const worldDims = this.simState.initState.worldDims;
    this.topoRenderer.encodeRender({
      perlinData: this.surfaceBuffer,
      worldDims,
      encoder,
      viewOffset,
      viewport,
      zoom,
    });
    // Submit the command and wait for it to complete.
    this.wg.queue.submit([encoder.finish()]);
    await this.wg.queue.onSubmittedWorkDone();
    const timeEnd = Date.now();
    console.log("Perlin Display Time", timeEnd - timeStart);
  }

  public static async createFromState(opts: {
    simState: SimulationState,
    canvas: HTMLCanvasElement,
  }): Promise<Simulation> {
    const { simState, canvas } = opts;
    const wg = await WgHandle.create({ canvas });
    const topoRenderer = await TopoRenderer.create({
      wg,
      canvas,
    });
    return new Simulation({
      simState,
      wg,
      canvas,
      topoRenderer,
    });
  }
}