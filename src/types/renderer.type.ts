export type RendererType = "deckgl" | "pixijs";

export interface ViewState {
  target: [number, number];
  zoom: number;
}
