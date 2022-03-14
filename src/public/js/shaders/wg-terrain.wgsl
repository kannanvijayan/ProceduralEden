
struct Uniforms {
  size: vec2<u32>;
  deep_water_level: u32;
  shallow_water_level: u32;
  low_land_level: u32;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1)
var<storage, read_write> surface: Buffer2D;

let DEEP_WATER: u32 = 1u;
let SHALLOW_WATER: u32 = 2u;
let LOW_LAND: u32 = 3u;
let HIGH_LAND: u32 = 4u;

fn read_elevation(x: u32, y: u32) -> u32 {
  let ww = uniforms.size.x >> 1u;
  let shift = (x & 1u) << 4u;
  let elevation = surface.values[(y * ww) + (x >> 1u)];
  return (elevation >> shift) & 0xfffu;
}
fn compute_terrain(elevation: u32) -> u32 {
  if (elevation <= uniforms.deep_water_level) {
    return DEEP_WATER;
  }
  if (elevation <= uniforms.shallow_water_level) {
    return SHALLOW_WATER;
  }
  if (elevation <= uniforms.low_land_level) {
    return LOW_LAND;
  }
  return HIGH_LAND;
}
fn compute_annotated_elevation(x: u32, y: u32) -> u32 {
  let elevation = read_elevation(x, y);
  let terrain  = compute_terrain(elevation);
  return elevation | (terrain << 12u);
}

@stage(compute) @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let x = global_id.x;
  let y = global_id.y;
  // Bounds check.
  if ((x << 1u) >= uniforms.size.x || (y << 1u) >= uniforms.size.y) {
    return;
  }
  var v0 = compute_annotated_elevation((x << 1u), (y << 1u));
  var v1 = compute_annotated_elevation((x << 1u) + 1u, (y << 1u));
  var v2 = compute_annotated_elevation((x << 1u), (y << 1u) + 1u);
  var v3 = compute_annotated_elevation((x << 1u) + 1u, (y << 1u) + 1u);

  // Pack into a single u32 value.
  let ww = uniforms.size.x >> 1u;
  surface.values[((y << 1u) * ww) + x] = v0 | (v1 << 16u);
  surface.values[(((y << 1u) + 1u) * ww) + x] = v2 | (v3 << 16u);
}