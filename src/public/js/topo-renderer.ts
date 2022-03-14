import computeShaderCode from "./shaders/draw-topo.wgsl";
import { Coord2D, Dims2D } from "../../common/utility/vector-math";
import { WgHandle } from "./wg/wg-handle";

const WATER_LEVEL = 0.06;

export class TopoRenderer {
  private readonly wg: WgHandle;
  private readonly canvasDims: Dims2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: GPUCanvasContext;

  private readonly depthTexture: GPUTexture;
  private readonly depthTextureView: GPUTextureView;

  private readonly fsPosnBuffer: GPUBuffer;
  private readonly fsColorBuffer: GPUBuffer;
  private readonly fsIndexBuffer: GPUBuffer;

  private readonly shader: GPUShaderModule;
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroupLayout: GPUBindGroupLayout;

  private readonly pipeline: GPURenderPipeline;

  private constructor(opts: {
    wg: WgHandle;
    canvas: HTMLCanvasElement;
  }) {
    this.wg = opts.wg;
    this.canvasDims = [opts.canvas.width, opts.canvas.height];
    this.canvas = opts.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    const context = this.canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) {
      throw new Error("Failed to get WebGPU context.");
    }
    this.context = context;
    this.context.configure({
      device: this.wg.device,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    this.depthTexture = this.wg.device.createTexture({
      size: [this.canvas.width, this.canvas.height, 1],
      dimension: "2d",
      format: "depth24plus-stencil8",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    this.depthTextureView = this.depthTexture.createView();

    this.fsPosnBuffer = this.wg.makeBuffer(
      FULLSCREEN_TRIANGLES,
      GPUBufferUsage.VERTEX
    );
    this.fsColorBuffer = this.wg.makeBuffer(
      FULLSCREEN_COLORS,
      GPUBufferUsage.VERTEX
    );
    this.fsIndexBuffer = this.wg.makeBuffer(
      FULLSCREEN_INDICES,
      GPUBufferUsage.INDEX
    );

    this.shader = this.wg.makeShaderModule(computeShaderCode);

    const worldDims = this.canvasDims;
    this.uniformBuffer = this.wg.makeBuffer(
      new Float32Array([
        ...worldDims,        // World dims.
        ...this.canvasDims,  // Canvas dims.
        ...worldDims,        // Viewport dims.
        ...[0, 0],           // Viewport offset.
        WATER_LEVEL
      ]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    this.bindGroupLayout = this.wg.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: "read-only-storage",
          }
        }
      ]
    });
    const layout = this.wg.device.createPipelineLayout({
      bindGroupLayouts: [ this.bindGroupLayout ]
    });

    const positionBufferDesc: GPUVertexBufferLayout = {
        attributes: [
          {
            shaderLocation: 0, // [[location(0)]]
            offset: 0,
            format: 'float32x3'
          },
        ],
        arrayStride: 4 * 3, // sizeof(float) * 3
        stepMode: 'vertex'
    };
    const colorBufferDesc: GPUVertexBufferLayout = {
        attributes: [
          {
            shaderLocation: 1, // [[location(1)]]
            offset: 0,
            format: 'float32x3'
          }
        ],
        arrayStride: 4 * 3, // sizeof(float) * 3
        stepMode: 'vertex'
    };

    const depthStencil: GPUDepthStencilState = {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus-stencil8'
    };

    const colorState: GPUColorTargetState = {
        format: 'bgra8unorm'
    };

    const primitive: GPUPrimitiveState = {
        frontFace: 'cw',
        cullMode: 'none',
        topology: 'triangle-list'
    };

    this.pipeline = this.wg.device.createRenderPipeline({
      layout,
      vertex: {
        module: this.shader,
        entryPoint: 'vertex_main',
        buffers: [positionBufferDesc, colorBufferDesc]
      },
      fragment: {
        module: this.shader,
        entryPoint: 'fragment_main',
        targets: [colorState],
      },
      primitive,
      depthStencil,
    });
  }

  public static async create(opts: {
    wg: WgHandle;
    canvas: HTMLCanvasElement;
  }): Promise<TopoRenderer> {
    return new TopoRenderer(opts);
  }

  public async encodeRender(opts: {
    encoder: GPUCommandEncoder;
    worldDims: Dims2D;
    perlinData: GPUBuffer;
    viewOffset: Coord2D;
    viewport: Dims2D;
    zoom: number;
  }): Promise<void> {
    const { encoder, worldDims, perlinData, viewOffset, viewport, zoom } = opts;
    // This effectively disables the hex renderer.
    const updateUniformArray = new Float32Array([
      ...worldDims,        // World dims.
      ...this.canvasDims,  // Canvas dims.
      ...viewport,         // Viewport dims.
      ...viewOffset,       // Viewport offset.
      WATER_LEVEL
    ]);
    const updateUniform = this.wg.makeBuffer(
      updateUniformArray,
      GPUBufferUsage.COPY_SRC
    );
    encoder.copyBufferToBuffer(
      updateUniform, 0,
      this.uniformBuffer, 0,
      updateUniformArray.byteLength
    );

    const bindGroup = this.wg.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: perlinData },
        }
      ]
    });

    const passEncoder = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: "store",
        }
      ],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        stencilLoadOp: "load",
        stencilStoreOp: "store",
      }
    });
    const {width, height} = this.canvas;
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setViewport(0, 0, width, height, 0, 1);
    passEncoder.setScissorRect(0, 0, width, height);
    passEncoder.setVertexBuffer(0, this.fsPosnBuffer);
    passEncoder.setVertexBuffer(1, this.fsColorBuffer);
    passEncoder.setIndexBuffer(this.fsIndexBuffer, "uint32");
    passEncoder.drawIndexed(6);
    passEncoder.end();
  }
}


// The triangle vertex positions for drawing two covering
// triangles so we can use the shader to pixel-paint them.
//
//  A              B
//  +--------------+
//  |\___          |
//  |    \___      |
//  |        \___  |
//  |            \ |
//  +--------------+
//  D              C
const FULLSCREEN_TRIANGLES = new Float32Array([
  -1.0, 1.0, 0.0,   // A
  1.0, 1.0, 0.0,    // B
  1.0, -1.0, 0.0,   // C

  1.0, -1.0, 0.0,   // C
  -1.0, -1.0, 0.0,  // D
  -1.0, 1.0, 0.0,   // A
]);

const FULLSCREEN_COLORS = new Float32Array([
  1.0, 0.0, 0.0,    // A
  0.5, 0.0, 0.0,    // B
  0.0, 0.0, 0.0,    // C

  0.0, 0.0, 1.0,    // C
  0.0, 0.0, 0.5,    // D
  0.0, 0.0, 0.0,    // A
]);

const FULLSCREEN_INDICES = new Uint32Array([
  0, 1, 2,    // ABC
  3, 4, 5,    // CDA
]);


// The triangle vertex positions for drawing two covering
// triangles so we can use the shader to pixel-paint them.
//
//         A  
//         /\ 
//       /    \     
//  +--/--------\--+
// F|/            \|B
//  |              |
//  |      X       |
//  |              |C
// E|\            /|
//  +--\--------/--+
//       \    /     
//         \/
//          D 
//
const HEX_VP = 1 / Math.cos(Math.PI / 6);
const HEX_PT = {
  X: [0.0, 0.0, 0.0],
  A: [0.0, HEX_VP, 0.0],
  B: [1.0, HEX_VP/2, 0.0],
  C: [1.0, -HEX_VP/2, 0.0],
  D: [0.0, -HEX_VP, 0.0],
  E: [-1.0, -HEX_VP/2, 0.0],
  F: [-1.0, HEX_VP/2, 0.0],
}
const HEX_CM = {
  A: [1.0, 0.0, 0.0],
  B: [0.0, 1.0, 0.0],
  C: [0.0, 0.0, 1.0],
  D: [1.0, 1.0, 0.0],
  E: [0.0, 1.0, 1.0],
  F: [1.0, 0.0, 1.0],
}
const HEX_TRIANGLES = new Float32Array([
  ...HEX_PT.X, ...HEX_PT.A, ...HEX_PT.B,
  ...HEX_PT.X, ...HEX_PT.B, ...HEX_PT.C,
  ...HEX_PT.X, ...HEX_PT.C, ...HEX_PT.D,
  ...HEX_PT.X, ...HEX_PT.D, ...HEX_PT.E,
  ...HEX_PT.X, ...HEX_PT.E, ...HEX_PT.F,
  ...HEX_PT.X, ...HEX_PT.F, ...HEX_PT.A,
]);
const HEX_COLORS = new Float32Array([
  ...HEX_CM.A, ...HEX_CM.A, ...HEX_CM.A,
  ...HEX_CM.B, ...HEX_CM.B, ...HEX_CM.B,
  ...HEX_CM.C, ...HEX_CM.C, ...HEX_CM.C,
  ...HEX_CM.D, ...HEX_CM.D, ...HEX_CM.D,
  ...HEX_CM.E, ...HEX_CM.E, ...HEX_CM.E,
  ...HEX_CM.F, ...HEX_CM.F, ...HEX_CM.F,
]);
const HEX_INDICES = new Uint32Array([
  0, 1, 2,    // XAB
  3, 4, 5,    // XBC
  6, 7, 8,    // XCD
  9, 10, 11,  // XDE
  12, 13, 14, // XEF
  15, 16, 17, // XFA
]);