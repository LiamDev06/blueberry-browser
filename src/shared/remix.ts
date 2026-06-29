export type RemixVersion = {
  id: string;
  label: string;
  createdAt: number;
};

export type RemixPromptData = {
  pageTitle: string;
  versions: RemixVersion[];
};
