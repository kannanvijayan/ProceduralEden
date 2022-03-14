
export type TypedArray = Float32Array | Uint32Array | Uint16Array;

export type TypedArrayConstructor<T extends TypedArray> = {
  new (): T;
  new (size: number): T;
  new (buffer: ArrayBuffer): T;
  BYTES_PER_ELEMENT: number;
}