
struct Uniforms {
  size: vec2<u32>;
  level: u32;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// mapped for panels at level L.
@group(0) @binding(1)
var<storage, read> buf_uiqx_in: Buffer2D;

// mapped for panels at level L - 1.
@group(0) @binding(1)
var<storage, read> buf_uiqc_in: Buffer2D;

// mapped for panels at level L - 1.
@group(0) @binding(2)
var<storage, read_write> buf_uiqx_out: Buffer2D;

fn read_uiqx_in(pt: vec2<u32>) -> u32 {
  let scale = level << 2u;
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  return buf_uiqx_in.values[idx];
}
fn read_uiqc_in(pt: vec2<u32>) -> u32 {
  let scale = (level - 1) << 2u;
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  return buf_uiqc_in.values[idx];
}
fn write_uiqx_out(pt: vec2<u32>, results_idx: u32) {
  let scale = (level - 1) << 2u;
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  buf_uiqx_out.values[idx] = results_idx;
}

@stage(compute) @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let px = global_id.x;
  let py = global_id.y;
  // Bounds check.
  if (px >= (uniforms.size.x >> 4u) || (py >= (uniforms.size.y >> 4u)) {
    return;
  }
  let ptx = px << 4u;
  let pty = py << 4u;

  let panel_results_idx = read_uiqx_in(vec2<u32>(px, py));
  var accum: u32 = 0u;
  for (var ty = pty; ty < pty + 16u; ty = ty + 1u) {
    for (var tx = ptx; tx < ptx + 16u; tx = tx + 1u) {
      write_uiqx_out(vec2<u32>(tx, ty), accum);
      accum = accum + read_uiqc_in(vec2<u32>(tx, ty));
    }
  }
}