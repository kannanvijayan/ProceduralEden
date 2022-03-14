
struct Uniforms {
  size: vec2<u32>;
  level: u32;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// 32-bit words mapped for 16x16 or 256x256 tile panels.
@group(0) @binding(1)
var<storage, read> buf_uiqc_in: Buffer2D;

// 32-bit words mapped for 256x256 or 4096x4096 tile panels.
@group(0) @binding(2)
var<storage, read_write> buf_uiqc_out: Buffer2D;

fn read_uiqc_in(pt: vec2<u32>) -> u32 {
  let scale = level << 2u; // scale bits: level * 4
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  return buf_uiqc_in.values[idx];
}
fn write_uiqc_out(pt: vec2<u32>, count: u32) {
  let scale = (level+1) << 2u; // scale bits: (level * 1) * 4
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  buf_uiqc_out.values[idx] = count;
}
fn count_flag_bits(flags: u32) -> u32 {
  return
    ((flags >> 0u) & 1u) | ((flags >> 1u) & 1u)
  | ((flags >> 2u) & 1u) | ((flags >> 3u) & 1u)
  | ((flags >> 4u) & 1u) | ((flags >> 5u) & 1u)
  | ((flags >> 6u) & 1u) | ((flags >> 7u) & 1u);
}

@stage(compute) @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let px = global_id.x;
  let py = global_id.y;
  let scale = (level+1) << 4u;
  // Bounds check.
  if (px >= (uniforms.size.x >> 4u) || (py >= (uniforms.size.y >> 4u)) {
    return;
  }
  let ptx = px << 4u;
  let pty = py << 4u;

  var sum: u32 = 0u;
  for (var ty = pty; ty < pty + 16u; ty = ty + 1u) {
    for (var tx = ptx; tx < ptx + 16u; tx = tx + 1u) {
      sum = sum + read_uiqc_in(vec2<u32>(tx, ty));
    }
  }
  write_uiqc_out(vec2<u32>(px, py), sum);
}