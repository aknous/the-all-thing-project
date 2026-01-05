export type PollType = "SINGLE" | "RANKED";

export interface PollOption {
  optionId: string;
  label: string;
  sortOrder: number;
}

export interface Poll {
  pollId: string;
  templateId: string;
  templateKey: string;
  pollDate: string;
  closeDate: string;
  title: string;
  question: string | null;
  pollType: PollType;
  maxRank: number | null;
  audience: string;
  status: "OPEN" | "CLOSED";
  featured: boolean;
  isNew: boolean;
  options: PollOption[];
}

export interface PollCategory {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  sortOrder: number;
  parentCategoryId?: string | null;
  polls: Poll[];
  subCategories?: PollCategory[];
}

export interface PollsData {
  pollDate: string;
  categories: PollCategory[];
}

export interface VoteSubmission {
  rankedChoices: string[]; // Array of optionIds in preference order (for both SINGLE and RANKED)
  idempotencyKey?: string;
  turnstileToken?: string;
}

export interface PollResult {
  pollId: string;
  pollDate: string;
  title: string;
  pollType: PollType;
  winner?: {
    optionId: string;
    label: string;
    voteCount: number;
    percentage: number;
  };
  options: {
    optionId: string;
    label: string;
    voteCount: number;
    percentage: number;
    isWinner?: boolean;
    rankBreakdown?: { [rank: number]: number };
  }[];
  totalVotes: number;
  totalBallots?: number;
  rounds?: {
    round: number;
    totals: { [optionId: string]: number };
    eliminated: string | null;
    exhausted: number;
  }[];
}

export interface CurrentPollResults {
  found: boolean;
  pollId: string;
  pollDate?: string;
  title?: string;
  question?: string | null;
  pollType?: PollType;
  maxRank?: number | null;
  audience?: string;
  status?: "OPEN" | "CLOSED";
  options?: {
    optionId: string;
    label: string;
    sortOrder: number;
  }[];
  totalVotes?: number;
  results?: {
    optionId: string;
    label: string;
    count: number;
  }[];
  totalBallots?: number;
  winnerOptionId?: string | null;
  rounds?: {
    round: number;
    totals: { [optionId: string]: number };
    eliminated: string | null;
    exhausted: number;
  }[];
  rankBreakdown?: {
    [optionId: string]: {
      [rank: number]: number;
    };
  };
}