import { strict as assert } from "assert";
import * as React from "react";
import { Coord2D, Vector2D } from "../../../common/utility/vector-math";

export type CanvasViewProps = {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onDrag: (offset: Vector2D) => void;
  onZoom: (dz: number, locus: Coord2D) => void;
};

export function CanvasView(props: CanvasViewProps): JSX.Element {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(
    () => {
      const canvas = ref.current!;
      const dragHandler = new CanvasDragHandler(props.onDrag, props.onZoom);
      canvas.onmousedown = ev => dragHandler.handleMouseDown(ev);
      // canvas.onmouseup = ev => dragHandler.handleMouseUp(ev);
      // canvas.onmouseout = ev => dragHandler.handleMouseOut(ev);
      // canvas.onmousemove = ev => dragHandler.handleMouseMove(ev);
      canvas.onwheel = ev => dragHandler.handleWheel(ev);
      props.onCanvasReady(ref.current!);
    },
    []
  );

  return (
    <div className="canvas-view" style={{ border: "2px solid black", padding: "0px" }}>
      <canvas ref={ref} style={{ width: "95%", height: "95%", margin: "0px" }} />
    </div>
  );
}

class CanvasDragHandler {
  private onDrag: CanvasViewProps["onDrag"];
  private onZoom: CanvasViewProps["onZoom"];
  private currentDrag: Coord2D | undefined;

  constructor(
    onDrag: CanvasViewProps["onDrag"],
    onZoom: CanvasViewProps["onZoom"]
  ) {
    this.onDrag = onDrag;
    this.onZoom = onZoom;
    this.currentDrag = undefined;
  }

  public handleMouseDown(ev: MouseEvent): void {
    this.currentDrag = [ev.clientX, ev.clientY];
    let moveListener = (ev: MouseEvent) => {
      this.handleMouseMove(ev);
    };
    let upListener = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", moveListener);
      window.removeEventListener("mouseup", upListener);
      this.handleMouseUp(ev);
    };
    window.addEventListener("mousemove", moveListener);
    window.addEventListener("mouseup", upListener);
  }
  public handleMouseMove(ev: MouseEvent): void {
    if (this.currentDrag) {
      const delta: Vector2D = [
        - (ev.clientX - this.currentDrag[0]),
        ev.clientY - this.currentDrag[1],
      ];
      this.onDrag(delta);
      this.currentDrag = [ev.clientX, ev.clientY];
    }
  }
  public handleMouseUp(ev: MouseEvent): void {
    this.currentDrag = undefined;
  }
  public handleMouseOut(ev: MouseEvent): void {
    this.currentDrag = undefined;
  }
  public handleWheel(ev: WheelEvent): boolean {
    if (ev.target instanceof HTMLCanvasElement) {
      const rect = ev.target.getBoundingClientRect();
      const pos: Coord2D = [ev.clientX - rect.left, ev.clientY - rect.top];
      this.onZoom(ev.deltaY, pos);
      return false;
    }
    return true;
  }
}