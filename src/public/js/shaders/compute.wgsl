
struct Globals {
  world_width: u32;
  world_height: u32;
  seed: u32;
  next_turn: u32;
  units_array_size: u32;
};

struct UnitState {
  type_and_health: u32;
  position: u32;
};
struct UnitStateArray {
  arr: array<UnitState>;
};

@group(0) @binding(0)
var<uniform> globals: Globals;

@group(0) @binding(1)
var<storage, read_write> unit_states: UnitStateArray;

@stage(compute) @workgroup_size(16, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let idx = global_id.x;
  // Skip indices outside of the units array.
  if (idx >= globals.units_array_size) {
    return;
  }
  let pos_x: u32 = unit_states.arr[idx].position & u32(0xffff);
  let pos_y: u32 = (unit_states.arr[idx].position >> u32(16)) & u32(0xffff);

  // Move the unit.
  if (pos_y > u32(0)) {
    let newpos = pos_x | ((pos_y - u32(1)) << u32(16));
    //let newpos = pos_x;
    unit_states.arr[idx].position = newpos;
  }
}