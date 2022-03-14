
struct Uniforms {
  size: vec2<u32>;
};

struct Buffer2D {
  values: array<u32>;
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// map from 16x16 panels to index of start of results.
@group(0) @binding(1)
var<storage, read> buf_uiqx16: Buffer2D;

// map from tiles to 8-bit query flag words.
@group(0) @binding(1)
var<storage, read> buf_uiqf: Buffer2D;

// map from tiles to 16-bit position offsets within
// the array.  The position offset's high bit (bit 15)
// can be used to mark the position offset as invalid,
// which will always cause all unit info query results
// at that tile to yield `u32(-1)`.
@group(0) @binding(2)
var<storage, read_write> buf_uiqp: Buffer2D;

fn read_uiqx16(pt: vec2<u32>) -> u32 {
  let scale = 4;
  let idx = (pt.y * (uniforms.size.x >> scale)) + pt.x;
  return buf_uiqx16.values[idx];
}
fn read_uiqf(pt: vec2<u32>) -> u32 {
  let idx = (pt.y * uniforms.size.x) + pt.x;
  let word_idx = idx >> 2u; // 4 bytes per word.
  let shift = (idx & 0x3u) << 3u;  // (idx % 4) * 8.
  return (buf_uiqf.values[word_idx] >> shift) & 0xffu;
}
fn write_two_uiqp(pt: vec2<u32>, results_pos0: u32), results_pos1: u32) {
  let idx = (pt.y * (uniforms.size.x >> 1u)) + pt.x;
  let word_idx = idx >> 1u; // 2 16-bit positions per word.
  buf_uiqp.values[word_idx] = results_pos0 | (results_pos1 << 16);
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

  let panel_results_idx = read_uiqx16(vec2<u32>(px, py));
  var accum: u32 = 0u;
  for (var ty = pty; ty < pty + 16u; ty = ty + 1u) {
    for (var tx = ptx; tx < ptx + 16u; tx = tx + 2u) {
      let val0 = accum;
      let flags0 = read_uiqf(vec2<u32>(tx, ty));
      accum = accum + count_flag_bits(flags0);

      let val1 = accum;
      let flags1 = read_uiqf(vec2<u32>(tx+1, ty));
      accum = accum + count_flag_bits(flags1);

      write_two_uiqp(vec2<u32>(tx, ty), val0, val1);
    }
  }
}