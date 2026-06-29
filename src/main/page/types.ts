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

export type PageTheme = {
  background: string;
  foreground: string;
  fontFamily: string;
  fontSize: string;
  linkColor: string;
  isDark: boolean;
}

export type ContentRegion = {
  id: number;
  tag: string;
  preview: string;
  text: string;
}

export type RemixModel = {
  theme: PageTheme;
  regions: ContentRegion[];
  mainText: string;
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
