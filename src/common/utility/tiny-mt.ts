
/**
 * tinymt32 internal state vector and parameters
 */
export class TinyMt32 {
  private status: number[];
  static MAT1 = 0x8f7011ee;
  static MAT2 = 0xfc78ff1f;
  static TMAT = 0x3793fdff;

  public constructor(seed: number) {
    const MIN_LOOP = 8;
    const PRE_LOOP = 8;
    this.status = [seed, TinyMt32.MAT1, TinyMt32.MAT2, TinyMt32.TMAT];
    for (let i = 1; i < MIN_LOOP; i++) {
      this.status[i & 3] ^= (
        ((i + 1812433253)|0)
        *
        (this.status[(i - 1) & 3] ^ (this.status[(i - 1) & 3] >> 30))
      )|0;
    }
    for (let i = 0; i < PRE_LOOP; i++) {
      this.nextState();
    }
  }

  public generateUint32(): number {
    this.nextState();
    return this.temper();
  }

  private nextState(): void {
    let y = this.status[3];
    let x = (this.status[0] & TINYMT32_MASK) ^ this.status[1] ^ this.status[2];
    x ^= (x << TINYMT32_SH0);
    y ^= (y >> TINYMT32_SH0) ^ x;
    this.status[0] = this.status[1];
    this.status[1] = this.status[2];
    this.status[2] = x ^ (y << TINYMT32_SH1);
    this.status[3] = y;
    if (y & 1) {
         this.status[1] ^= TinyMt32.MAT1;
         this.status[2] ^= TinyMt32.MAT2;
     }
  }

  private temper(): number {
    let t0 = this.status[3];
    const t1 = (this.status[0] + (this.status[2] >> TINYMT32_SH8))|0;
    t0 ^= t1;
    if (t1 & 1) {
        t0 ^= TinyMt32.TMAT;
    }
    return t0;
  }
}

/**
 * Internal tinymt32 constants and functions.
 * Users should not call these functions directly.
 */
const TINYMT32_SH0 = 1;
const TINYMT32_SH1 = 10;
const TINYMT32_SH8 = 8;
const TINYMT32_MASK = 0x7fffffff;