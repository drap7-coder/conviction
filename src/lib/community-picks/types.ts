export type CommunityPick = {
  ticker: string;
  entryPrice: number;
  currentPrice: number | null;
  returnPct: number | null;
  pickedAt: string;
};

export type CommunityPickGroup = {
  groupId: string;
  name: string;
  primaryColor: string | null;
};

export type CommunityStanding = CommunityPickGroup & {
  pickCount: number;
  avgReturnPct: number | null;
};

export type CommunityPicksPayload = {
  authenticated: boolean;
  viewerGroup: CommunityPickGroup | null;
  viewerPick: CommunityPick | null;
  standings: CommunityStanding[];
};
