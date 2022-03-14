
struct Uniforms {
  size: vec2<u32>;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// 8-bit words packed 4-each into 32-bit words, mapped for
// each tile.
@group(0) @binding(1)
var<storage, read> buf_uiqf: Buffer2D;

// 32-bit words mapped for 16x16 tile panel.
@group(0) @binding(2)
var<storage, read_write> buf_uiqc16: Buffer2D;

fn read_uiqf(pt: vec2<u32>) -> u32 {
  let idx = (pt.y * uniforms.size.x) + pt.x;
  let word_idx = idx >> 2u; // 4 bytes per word.
  let shift = (idx & 0x3u) << 3u;  // (idx % 4) * 8.
  return (buf_uiqf.values[word_idx] >> shift) & 0xffu;
}
fn write_uiqc16(pt: vec2<u32>, count: u32) {
  let idx = (pt.y * (uniforms.size.x >> 4u)) + pt.x;
  buf_uiqc16.values[idx] = count;
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
  // Bounds check.
  if (px >= (uniforms.size.x >> 4u) || (py >= (uniforms.size.y >> 4u)) {
    return;
  }
  let ptx = px << 4u;
  let pty = py << 4u;

  var count: u32 = 0u;
  for (var ty = pty; ty < pty + 16u; ty = ty + 1u) {
    for (var tx = ptx; tx < ptx + 16u; tx = tx + 1u) {
      let flags = read_uiqf(vec2<u32>(tx, ty));
      count += count_flag_bits(flags);
    }
  }
  write_uiqc16(vec2<u32>(px, py), count);
}