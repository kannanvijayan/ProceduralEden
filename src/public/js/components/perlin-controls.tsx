
import * as React from "react";
import { Grid, Box, Button, TextField } from "@material-ui/core";
import { PerlinSubmitParams, PerlinViewState } from "./perlin-view";

export type PerlinControlsProps = {
  onSubmit?: (params: PerlinSubmitParams) => void,
};
export type PerlinControlsState = {
  seed: string,
  size: string,
  scale: string,
  repeat: string,
  validated?: PerlinSubmitParams,
};

export class PerlinControls extends React.Component<
  PerlinControlsProps,
  PerlinControlsState
> {
  constructor(props: PerlinControlsProps) {
    super(props);
    const state = {
      seed: '1',
      size: '8192x4096',
      scale: '2048',
      repeat: '4',
    };
    const validated = PerlinControls.validateState(state);
    this.state = { ...state, validated };
  }

  override render() {
    return (
      <Grid container spacing={2}>
        <Grid item sm={12}>
          <Box sx={{ fontSize: 24, color: "#333" }}>
            Perlin Controls
          </Box>
        </Grid>
        <Grid item sm={12}>
          <TextField
            size="small"
            label="Seed"
            variant="outlined"
            value={this.state.seed}
            onChange={ev => {
              this.updateState({ seed: ev.target.value });
            }}
          />
        </Grid>
        <Grid item sm={12}>
          <TextField
            size="small"
            label="Size"
            variant="outlined"
            value={this.state.size}
            onChange={ev => {
              this.updateState({ size: ev.target.value });
            }}
          />
        </Grid>
        <Grid item sm={12}>
          <TextField
            size="small"
            label="Scale"
            variant="outlined"
            value={this.state.scale}
            onChange={ev => {
              this.updateState({ scale: ev.target.value });
            }}
          />
        </Grid>
        <Grid item sm={12}>
          <TextField
            size="small"
            label="Repeat"
            variant="outlined"
            value={this.state.repeat}
            onChange={ev => {
              this.updateState({ repeat: ev.target.value });
            }}
          />
        </Grid>
        <Grid item sm={12}>
          <Button
            variant="contained"
            disabled={!this.state.validated}
            onClick={ev => this.handleSubmit()}
          >
            Submit
          </Button>
        </Grid>
      </Grid>
    );
  }

  private handleSubmit() {
    const { validated } = this.state;
    if (!validated) {
      return;
    }
    this.props.onSubmit?.(validated);
  }

  private updateState(update: Partial<PerlinControlsState>): void {
    const newState = { ...this.state, ...update };
    const validated = PerlinControls.validateState(newState);
    newState.validated = validated;
    this.setState(newState);
  }

  private static validateState(
    state: PerlinControlsState
  ): PerlinSubmitParams | undefined {
    const seedStr = state.seed;
    if (!seedStr.match(/^[0-9]+$/)) {
      console.error("Invalid seed", seedStr);
      return;
    }
    const seed = Number.parseInt(seedStr);

    const sizeStr = state.size;
    if (!sizeStr.match(/^[0-9]+x[0-9]+$/)) {
      console.error("Invalid size", sizeStr);
      return;
    }
    const size =
      sizeStr.split("x").map(s => Number.parseInt(s)) as [number, number];

    const scaleStr = state.scale;
    if (!scaleStr.match(/^[0-9]+$/)) {
      console.error("Invalid scale", scaleStr);
      return;
    }
    const scale = Number.parseInt(scaleStr);

    const repeatStr = state.repeat;
    if (!repeatStr.match(/^[0-9]+$/)) {
      console.error("Invalid repeat", repeatStr);
      return;
    }
    const repeat = Number.parseInt(repeatStr);

    return {
      seed,
      size: size as [number, number],
      scale,
      repeat
    };
  }
}