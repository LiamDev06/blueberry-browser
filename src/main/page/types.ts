export type ElementSnapshot = {
  index: number;
  role: string;
  name: string;
  href?: string;
  backendNodeId: number;
  inViewport: boolean;
}

export type PageContent = {
  title: string;
  url: string;
  text: string;
}

export type PageSnapshot = {
  url: string;
  title: string;
  scrollY: number;
  scrollHeight: number;
  viewportHeight: number;
  elements: ElementSnapshot[];
  hiddenElements: number;
}
