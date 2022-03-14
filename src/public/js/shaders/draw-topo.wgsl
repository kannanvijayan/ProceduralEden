
struct Uniforms {
  world_dims: vec2<f32>;
  canvas_dims: vec2<f32>;
  viewport_dims: vec2<f32>;
  viewport_pos: vec2<f32>;
  water_level: f32;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(1)
var<storage, read> surface: Buffer2D;

@group(0) @binding(0)
var<uniform> params: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>;
    @location(0) color: vec3<f32>;
};

let deep_sea_blue: vec3<f32> = vec3<f32>(0.0, 0.0, 0.5);
let shallow_sea_blue: vec3<f32> = vec3<f32>(0.5, 0.5, 0.8);
let ground_zero: vec3<f32> = vec3<f32>(0.0, 0.4, 0.0);
let peak_white: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);
let black: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

fn topo_line(val: f32) -> bool {
  let rval = round(val * 50.0) / 50.0;
  return abs(val - rval) <= 0.0005;
}

fn color_value(val: f32, water_level: f32) -> vec4<f32> {
  var color: vec3<f32>;
  if (val <= water_level) {
    let depth = (water_level - val) / (water_level + 1.0);
    color = mix(shallow_sea_blue, deep_sea_blue, depth);
  } else {
    let height = ((val - water_level) / (1.0 - water_level)) * 2.0;
    // if (topo_line(height)) {
    //  color = black;
    // } else {
    //  color = mix(ground_zero, peak_white, round(height * 50.0) / 50.0);
    // }
    color = mix(ground_zero, peak_white, round(height * 50.0) / 50.0);
  }
  return vec4<f32>(color, 1.0);
}

let DEEP_WATER: u32 = 1u;
let SHALLOW_WATER: u32 = 2u;
let LOW_LAND: u32 = 3u;
let HIGH_LAND: u32 = 4u;

fn color_terrain(val: u32) -> vec3<f32> {
  if (val == DEEP_WATER) {
    return deep_sea_blue;
  }
  if (val == SHALLOW_WATER) {
    return shallow_sea_blue;
  }
  if (val == LOW_LAND) {
    return ground_zero;
  }
  if (val == HIGH_LAND) {
    return peak_white;
  }
  return vec3<f32>(0.0, 0.0, 0.0);
}

fn point_to_tile(pt: vec2<f32>) -> vec2<u32> {
  // Convert coordinates to [0, 1] range, flip Y.
  let view_pt = ((pt + 1.0) / 2.0);
  let norm_pt = view_pt * vec2<f32>(1.0, -1.0) + vec2<f32>(0.0, 1.0);
  let scale_pt = params.viewport_pos + (norm_pt * params.viewport_dims);
  let adj = f32(u32(floor(scale_pt.y)) & 1u) * 0.5;
  let coord = vec2<u32>(floor(scale_pt + vec2<f32>(adj, 0.0)));
  return coord;
}

fn read_tile_value(tile: vec2<u32>) -> f32 {
  let row_stride = u32(params.world_dims.x) >> 1u;
  let row_offset = (u32(tile.x) % u32(params.world_dims.x)) >> 1u;
  let shift = (u32(tile.x) & 1u) << 4u;
  let word = surface.values[(tile.y * row_stride) + row_offset];
  let u16_value = (word >> shift) & 0x0fffu;
  return ((f32(u16_value) / f32(0x0fffu)) * 2.0f) - 1.0f;
}

fn read_tile_terrain(tile: vec2<u32>) -> u32 {
  let row_stride = u32(params.world_dims.x) >> 1u;
  let row_offset = (u32(tile.x) % u32(params.world_dims.x)) >> 1u;
  let shift = (u32(tile.x) & 1u) << 4u;
  let word = surface.values[(tile.y * row_stride) + row_offset];
  let terrain_and_elevation = (word >> shift) & 0xffffu;
  return terrain_and_elevation >> 12u;
}

@stage(fragment)
fn fragment_main(in: VSOut) -> @location(0) vec4<f32> {
  let tile = point_to_tile(in.color.xy);
  // let val = read_tile_value(tile);
  // return color_value(val, params.water_level);
  let ter = read_tile_terrain(tile);
  return vec4<f32>(color_terrain(ter), 1.0);
}

@stage(vertex)
fn vertex_main(
  @location(0) inPos: vec3<f32>,
  @location(1) inColor: vec3<f32>
) -> VSOut {
    var vsOut: VSOut;
    vsOut.position = vec4<f32>(inPos, 1.0);
    vsOut.color = inPos;
    return vsOut;
}