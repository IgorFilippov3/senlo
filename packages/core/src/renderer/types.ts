import { EmailDesignDocument } from "../emailDesign";

export interface EmailRenderer {
  render(design: EmailDesignDocument): string;
}

export type RenderContext = {
  // To store shared state during rendering (e.g. unique classes for media queries)
  responsiveStyles: string[];
  options?: RenderOptions;
};

export interface RenderOptions {
  baseUrl?: string;
  data?: {
    contact?: Record<string, any>;
    project?: { name: string };
    campaign?: { name: string; id?: number };
    unsubscribeUrl?: string;
    custom?: Record<string, any>;
  };
}









