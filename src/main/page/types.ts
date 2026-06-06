export type ElementSnapshot = {
  index: number;
  role: string;
  name: string;
  href?: string;
  backendNodeId: number;
  inViewport: boolean;
}

export type PageSnapshot = {
  url: string;
  title: string;
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
  elements: ElementSnapshot[];
}
