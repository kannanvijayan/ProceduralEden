
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Box, Grid, Button } from "@material-ui/core";
import { CanvasView } from "./canvas-view";
import { PerlinControls } from "./perlin-controls";
import { Coord2D, Dims2D, Vector2D } from "../../../common/utility/vector-math";

export type PerlinSubmitParams = {
  seed: number,
  size: Dims2D,
  scale: number,
  repeat: number,
};

export type PerlinViewProps = {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onSubmit: (params: PerlinViewState & { submitParams: PerlinSubmitParams }) => void;
  onRepaint: (params: PerlinViewState) => void;
};

// Zoom range is from 1 -> infinity.
// A zoom of K specifies that K pixels are used per tile.
export type PerlinViewState = {
  viewOffset: Coord2D;
  zoom: number;
  canvas?: HTMLCanvasElement;
  submitParams?: PerlinSubmitParams;
};
const INIT_VIEW_STATE: PerlinViewState = {
  viewOffset: [0, 0],
  zoom: 1 / 2,
};

export class PerlinView extends React.Component<PerlinViewProps, PerlinViewState> {
  constructor(props: PerlinViewProps) {
    super(props);
    this.state = { ...INIT_VIEW_STATE };
  }

  override render() {
    return (
      <Box>
        <Box sx={{
          fontSize: "24pt",
          fontWeight: "bold",
          bgcolor: "#aa33bb",
          color: "#dddddd",
          width: "100%",
          margin: "0px",
          padding: "10px",
          marginBottom: "10px",
        }}>
          Perlin
        </Box>
        <Grid container spacing={2}>
          <Grid item sm={2}>
            <PerlinControls onSubmit={params => this.handleSubmit(params)} />
          </Grid>
          <Grid item sm={10}>
            <Grid container>
              <Grid item sm={1}>
                <Button
                  variant="text"
                  onClick={ev => this.handleReset()}
                >
                  Reset
                </Button>
              </Grid>
              <Grid item sm={1}>
                <Button variant="text">&lt;</Button>
              </Grid>
              <Grid item sm={1}>
                <Button variant="text">^</Button>
              </Grid>
              <Grid item sm={1}>
                <Button variant="text">v</Button>
              </Grid>
              <Grid item sm={1}>
                <Button variant="text">&gt;</Button>
              </Grid>
              <Grid item sm={3}>
                Zoom: {this.state.zoom}
              </Grid>
              <Grid item sm={4}>
                Offset: {this.state.viewOffset.join(",")}
              </Grid>
              <Grid item sm={12}>
                <CanvasView
                  onCanvasReady={ canvas => this.handleCanvas(canvas) }
                  onDrag={ offset => this.handleDrag(offset) }
                  onZoom={ (zoomPercent, locus) => this.handleZoom(zoomPercent, locus) }
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    );
  }

  private handleCanvas(canvas: HTMLCanvasElement): void {
    const state = this.normalizeState({ ...this.state, canvas });
    this.setState(state);
    this.props.onCanvasReady(canvas);
  }
  private handleSubmit(submitParams: PerlinSubmitParams): void {
    const state = this.normalizeState({ ...this.state, submitParams });
    this.setState(state);
    this.props.onSubmit(state);
  }
  private handleReset(): void {
    const { submitParams } = this.state;
    const state = this.normalizeState({ ...this.state, submitParams });
    this.setState(state);
  }
  private normalizeState<T extends PerlinViewState>(state: T): T {
    if (state.submitParams && state.canvas) {
      // The furthest zoom should not exceed vertical scale.
      const furthestZoom = state.canvas.height / state.submitParams.size[1];
      const zoom = Math.min(Math.max(state.zoom, furthestZoom), 100);
      state.zoom = zoom;

      const [mapWidth, mapHeight] = state.submitParams.size;
      const offsetX = (mapWidth + (state.viewOffset[0] % mapWidth)) % mapWidth;
      const offsetY = Math.min(
        Math.max(state.viewOffset[1], 0),
        mapHeight - (state.canvas.height / zoom)
      );
      state.viewOffset = [offsetX, offsetY];
    }
    return state;
  }

  private handleDrag(offset: Vector2D): void {
    const [dx, dy] = offset.map(n => n / this.state.zoom);
    const scale = window.devicePixelRatio || 1;
    const [x, y] = this.state.viewOffset;
    const viewOffset: [number, number] = [ x + (dx * scale), y - (dy * scale) ];
    const updatedState = this.normalizeState({ ...this.state, viewOffset });
    this.setState(updatedState);
    this.props.onRepaint(updatedState);
  }
  private handleZoom(dz: number, _locus: Coord2D): void {
    const zoom = this.state.zoom * (1.01 ** dz);
    const updatedState = this.normalizeState({ ...this.state, zoom });
    this.setState(updatedState);
    this.props.onRepaint(updatedState);
  }
}

export function renderPerlinView(opts: PerlinViewProps): void {
  ReactDOM.render(
    <PerlinView {...opts} />,
    document.getElementById("root")
  );
}