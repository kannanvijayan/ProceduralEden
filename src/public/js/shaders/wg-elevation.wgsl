
struct Uniforms {
  seed: u32;
  scale: u32;
  pan: vec2<u32>;
  size: vec2<u32>;
  repeat_x: u32;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1)
var<storage, read_write> surface: Buffer2D;


let XXHASH_PRIME_1: u32 = 2654435761u;
let XXHASH_PRIME_2: u32 = 2246822519u;
let XXHASH_PRIME_3: u32 = 3266489917u;

let PI: f32 = 3.1415926535897932384626;

fn rot_left(val: vec4<u32>, rot: vec4<u32>) -> vec4<u32> {
  return (val << rot) | (val >> (32u - rot));
}

fn xxhash(seed: u32, values: vec4<u32>) -> u32 {
  let state: vec4<u32> = vec4<u32>(
    seed + XXHASH_PRIME_1 + XXHASH_PRIME_2,
    seed + XXHASH_PRIME_2,
    seed,
    seed - XXHASH_PRIME_1,
  );
  let pre_rotate = (state + values) * XXHASH_PRIME_2;
  let new_state = rot_left(
    rot_left(pre_rotate, vec4<u32>(13u)) * XXHASH_PRIME_1,
    vec4<u32>(1u, 7u, 12u, 18u)
  );

  var res = 16u + new_state[0] + new_state[1] + new_state[2] + new_state[3];
  res = (res ^ (res >> 15u)) * XXHASH_PRIME_2;
  res = (res ^ (res >> 13u)) * XXHASH_PRIME_3;
  return res ^ (res >> 16u);
}

fn swizzle(seed: u32, adjust: u32, x: u32, y: u32) -> f32 {
  let a = xxhash(seed, vec4<u32>(adjust, x, y, 0u));
  return f32(a) / f32(u32(-1));
}

fn smooth(v: f32) -> f32 {
  // return (v * v) * (3.0 - 2.0 * v);
  return (v * (v * 6.0 - 15.0) + 10.0) * v * v * v;
}

fn interpolate(start: f32, end: f32, travel: f32) -> f32 {
  return start + (end - start) * smooth(travel);
}

fn gridvec(stage: u32, pt: vec2<u32>) -> vec2<f32> {
  let rand_unit = swizzle(uniforms.seed, stage, pt.x, pt.y);
  // Multiply by 2pi, then take cos and sin for gridvec dx, dy
  // This gives us a natural unit-vector.
  let angle = rand_unit * 2.0 * PI;
  return vec2<f32>(cos(angle), sin(angle));
}

fn perlin_stage(stage: u32, scale: u32, x: u32, y: u32, repx: u32) -> f32 {
  let pt: vec2<f32> = vec2<f32>(f32(x), f32(y)) / f32(scale);

  let tl: vec2<f32> = floor(pt);
  let tr: vec2<f32> = vec2<f32>(tl.x + 1.0, tl.y);
  let br: vec2<f32> = vec2<f32>(tl.x + 1.0, tl.y + 1.0);
  let bl: vec2<f32> = vec2<f32>(tl.x, tl.y + 1.0);

  var tl_vec: vec2<f32> = gridvec(
    stage,
    vec2<u32>(u32(tl.x) % repx, u32(tl.y))
  );
  let tr_vec: vec2<f32> = gridvec(
    stage,
    vec2<u32>(u32(tr.x) % repx, u32(tr.y))
  );
  let br_vec: vec2<f32> = gridvec(
    stage,
    vec2<u32>(u32(br.x) % repx, u32(br.y))
  );
  let bl_vec: vec2<f32> = gridvec(
    stage,
    vec2<u32>(u32(bl.x) % repx, u32(bl.y))
  );

  var tl_val: f32 = dot(tl_vec, pt - tl);
  var tr_val: f32 = dot(tr_vec, pt - tr);
  var br_val: f32 = dot(br_vec, pt - br);
  var bl_val: f32 = dot(bl_vec, pt - bl);

  // Interpolate
  let top_val: f32 = interpolate(tl_val, tr_val, pt.x - tl.x);
  let bot_val: f32 = interpolate(bl_val, br_val, pt.x - tl.x);
  let value: f32 = interpolate(top_val, bot_val, pt.y - tl.y);

  // Clamp value to [-1, 1]
  let clamped_value = max(min(value, 1.0f), -1.0f);

  // Grade the value so that nearer the top and bottom of the map,
  // the elevation drops off to zero.
  var graded_value = clamped_value;
  let grade_border = scale/8u;
  if (y < grade_border) {
    graded_value = interpolate(-1.0, graded_value, f32(y) / f32(grade_border));
  }
  if (y > (uniforms.size.y - grade_border)) {
    graded_value = interpolate(-1.0, graded_value, f32(uniforms.size.y - y) / f32(grade_border));
  }

  // Write the value.
  return graded_value;
}

fn gen_f32_value(x: u32, y: u32) -> f32 {
  var accum: f32 = 0.0;
  var max_value: f32 = 0.0;
  var amplitude: f32 = 1.0;
  var stage: u32 = 0u;
  var repeat_x: u32 = uniforms.repeat_x;
  for (var s: u32 = uniforms.scale; s >= 2u; s = s >> 1u) {
    let val = perlin_stage(stage, s, x, y, repeat_x);
    accum = accum + val * amplitude;
    max_value = max_value + amplitude;
    amplitude = amplitude * 0.55;
    stage = stage + 1u;
    repeat_x = repeat_x * 2u;
  }
  let res = max(min(accum / max_value, 1.0f), -1.0f);
  return res;
}

fn gen_u16_value(x: u32, y: u32) -> u32 {
  let unit_ranged = (gen_f32_value(x, y) + 1.0f) / 2.0f;
  return u32(floor(unit_ranged * f32(0x0fff)));
}

@stage(compute) @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let x = global_id.x + uniforms.pan.x;
  let y = global_id.y + uniforms.pan.y;
  // Bounds check.
  if ((x << 1u) >= uniforms.size.x || (y << 1u) >= uniforms.size.y) {
    return;
  }
  let v0 = gen_u16_value((x << 1u), (y << 1u));
  let v1 = gen_u16_value((x << 1u) + 1u, (y << 1u));
  let v2 = gen_u16_value((x << 1u), (y << 1u) + 1u);
  let v3 = gen_u16_value((x << 1u) + 1u, (y << 1u) + 1u);

  // Pack into a single u32 value.
  let ww = uniforms.size.x >> 1u;
  surface.values[((y << 1u) * ww) + x] = v0 | (v1 << 16u);
  surface.values[(((y << 1u) + 1u) * ww) + x] = v2 | (v3 << 16u);
}