import type { PriceCandidate, PriceCandidateSearchInput, RemotePriceDbProvider } from "./price-candidate-types";

export interface RemotePriceDbConfig {
  provider: RemotePriceDbProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface RemotePriceDbSearchResult {
  configured: boolean;
  candidates: PriceCandidate[];
  error?: string;
}

export interface RemotePriceDbAdapter {
  readonly provider: RemotePriceDbProvider | "disabled";
  isConfigured: () => boolean;
  searchCandidates: (input: PriceCandidateSearchInput) => Promise<RemotePriceDbSearchResult>;
}

export function resolveRemotePriceDbConfig(env: Record<string, string | undefined> = process.env): RemotePriceDbConfig | undefined {
  const provider = env.NEXT_PUBLIC_PRICE_DB_PROVIDER?.trim() || "supabase";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (provider !== "supabase") return undefined;
  if (!supabaseUrl || !supabaseAnonKey) return undefined;

  return {
    provider,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function createDisabledRemotePriceDbAdapter(reason = "Remote price database is not configured."): RemotePriceDbAdapter {
  return {
    provider: "disabled",
    isConfigured: () => false,
    searchCandidates: async () => ({
      configured: false,
      candidates: [],
      error: reason,
    }),
  };
}

export function createMockRemotePriceDbAdapter(candidates: PriceCandidate[] = [], options: { configured?: boolean; error?: string } = {}): RemotePriceDbAdapter {
  const configured = options.configured ?? true;

  return {
    provider: configured ? "supabase" : "disabled",
    isConfigured: () => configured,
    searchCandidates: async () => ({
      configured,
      candidates: configured ? candidates : [],
      error: configured ? options.error : options.error ?? "Remote price database is not configured.",
    }),
  };
}
