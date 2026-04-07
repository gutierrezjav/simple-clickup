import type { DailyMeetingConfig } from "@custom-clickup/shared";

const alwaysExcludedDailyMeetingNames = new Set(["Unassigned"]);
const defaultDailyMeetingProgressSegmentCount = 9;

export interface DailyMeetingRound {
  currentIndex: number;
  order: string[];
}

export interface AdvanceDailyMeetingRoundOptions {
  assigneeOptions: string[];
  config: DailyMeetingConfig;
  random?: () => number;
  round: DailyMeetingRound | null;
}

export interface AdvanceDailyMeetingRoundResult {
  assignee: string;
  round: DailyMeetingRound | null;
}

function normalizeName(name: string): string {
  return name.trim();
}

function getExcludedDailyMeetingNames(config: DailyMeetingConfig): Set<string> {
  return new Set([
    ...alwaysExcludedDailyMeetingNames,
    ...config.excludedAssignees.map(normalizeName).filter(Boolean)
  ]);
}

function getFinalDailyMeetingSpeaker(config: DailyMeetingConfig): string | undefined {
  const normalized = config.finalSpeaker ? normalizeName(config.finalSpeaker) : "";
  return normalized || undefined;
}

function shuffleNames(names: string[], random: () => number): string[] {
  const nextNames = [...names];

  for (let index = nextNames.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentValue = nextNames[index];
    const nextValue = nextNames[swapIndex];

    if (currentValue === undefined || nextValue === undefined) {
      continue;
    }

    nextNames[index] = nextValue;
    nextNames[swapIndex] = currentValue;
  }

  return nextNames;
}

export function getEligibleDailyMeetingRoster(
  assigneeOptions: string[],
  config: DailyMeetingConfig
): string[] {
  const excludedDailyMeetingNames = getExcludedDailyMeetingNames(config);
  const finalDailyMeetingSpeaker = getFinalDailyMeetingSpeaker(config);
  const uniqueNames = [...new Set(assigneeOptions.map(normalizeName).filter(Boolean))].filter(
    (name) => !excludedDailyMeetingNames.has(name)
  );
  const includesFinalSpeaker = finalDailyMeetingSpeaker
    ? uniqueNames.includes(finalDailyMeetingSpeaker)
    : false;
  const nonFinalSpeakers = uniqueNames.filter((name) => name !== finalDailyMeetingSpeaker);

  if (!includesFinalSpeaker || !finalDailyMeetingSpeaker) {
    return nonFinalSpeakers;
  }

  return [...nonFinalSpeakers, finalDailyMeetingSpeaker];
}

export function getDailyMeetingProgressCount(
  round: DailyMeetingRound | null,
  segmentCount = defaultDailyMeetingProgressSegmentCount
): number {
  if (!round || round.order.length === 0 || segmentCount <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(segmentCount, Math.ceil(((round.currentIndex + 1) / round.order.length) * segmentCount)));
}

export function getNextDailyMeetingSpeaker(round: DailyMeetingRound | null): string | null {
  if (!round || round.order.length === 0) {
    return null;
  }

  return round.order[round.currentIndex + 1] ?? null;
}

export function advanceDailyMeetingRound({
  assigneeOptions,
  config,
  random = Math.random,
  round
}: AdvanceDailyMeetingRoundOptions): AdvanceDailyMeetingRoundResult {
  if (round && round.order.length > 0) {
    if (round.currentIndex >= round.order.length - 1) {
      return {
        assignee: "",
        round: null
      };
    }

    const nextIndex = round.currentIndex + 1;

    return {
      assignee: round.order[nextIndex] ?? "",
      round: {
        ...round,
        currentIndex: nextIndex
      }
    };
  }

  const roster = getEligibleDailyMeetingRoster(assigneeOptions, config);
  if (roster.length === 0) {
    return {
      assignee: "",
      round: null
    };
  }

  if (!round || round.order.length === 0) {
    const finalDailyMeetingSpeaker = getFinalDailyMeetingSpeaker(config);
    const hasFinalSpeaker = finalDailyMeetingSpeaker
      ? roster.includes(finalDailyMeetingSpeaker)
      : false;
    const randomizableNames = roster.filter((name) => name !== finalDailyMeetingSpeaker);
    const shuffledNames = shuffleNames(randomizableNames, random);
    const order =
      hasFinalSpeaker && finalDailyMeetingSpeaker
        ? [...shuffledNames, finalDailyMeetingSpeaker]
        : shuffledNames;

    return {
      assignee: order[0] ?? "",
      round:
        order.length > 0
          ? {
              currentIndex: 0,
              order
            }
          : null
    };
  }

  return {
    assignee: "",
    round: null
  };
}
