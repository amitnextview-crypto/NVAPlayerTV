export interface SectionConfig {
  slideDirection: "left" | "right" | "top" | "bottom";
  slideDuration: number;
  sourceType?: "multimedia" | "web" | "youtube" | "template";
  sourceUrl?: string;
  sourceTemplate?: OrderTemplateConfig | null;
  sourceTemplates?: OrderTemplateConfig[];
  usbFitMode?: "stretch" | "cover" | "contain";
  volume?: number;
  muted?: boolean;
}

export interface OrderTemplateConfig {
    id?: string;
    presetId?: string;
    name?: string;
    title?: string;
    subtitle?: string;
    footer?: string;
    prepTitle?: string;
    readyTitle?: string;
    prepItems?: string;
    readyItems?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    textColor?: string;
    backgroundColor?: string;
    panelColor?: string;
    fontSize?: number;
    layout?: "classic" | "split";
    imageData?: string;
}

export interface TickerConfig {
  text: string;
  color: string;
  bgColor: string;
  speed: number;
  fontSize: number;
  position: "top" | "bottom";
}

export interface CacheConfig {
  videoMB?: number;
}

export interface AppConfig {
  layout: "fullscreen" | "grid2" | "grid3";
  orientation:
    | "horizontal"
    | "vertical"
    | "reverse-horizontal"
    | "reverse-vertical";
  slideDuration: number;
  animation: "slide";
  bgColor: string;
  sections: SectionConfig[];
  ticker: TickerConfig;
  cache?: CacheConfig;
}
