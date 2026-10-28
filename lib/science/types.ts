export type Source = {
  id: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  doi?: string;
  url: string;
  abstract: string;
  provider: string;
  type: string;
  retrievedAt: string;
};
export type ResearchResult = {
  answer: string;
  citations: Source[];
  limitations: string[];
  usage: {
    durationMs: number;
    sourcesRetrieved: number;
    requests: number;
    model: string | null;
  };
  findings: { text: string; sourceId: string }[];
  providerStatus: {
    name: string;
    ok: boolean;
    count: number;
    error?: string;
  }[];
};
export type ResearchRun = {
  id: string;
  projectId: string | null;
  question: string;
  domain: string;
  status: string;
  mode: string;
  sources: string[];
  result: ResearchResult | null;
  progress: { label: string; at: string }[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
};
export type Note = {
  id: string;
  title: string;
  content: string;
  sourceUrl: string | null;
  createdAt: string;
};
