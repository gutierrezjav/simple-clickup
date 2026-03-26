const excludedDailyMeetingNames = new Set(["Unassigned", "Javier Gutierrez"]);
const finalDailyMeetingSpeaker = "Jessica Nilsson";
const defaultDailyMeetingProgressSegmentCount = 9;
export interface DailyMeetingRound {
  currentIndex: number;
  order: string[];
}

export interface AdvanceDailyMeetingRoundOptions {
  assigneeOptions: string[];
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

export function getEligibleDailyMeetingRoster(assigneeOptions: string[]): string[] {
  const uniqueNames = [...new Set(assigneeOptions.map(normalizeName).filter(Boolean))].filter(
    (name) => !excludedDailyMeetingNames.has(name)
  );
  const includesFinalSpeaker = uniqueNames.includes(finalDailyMeetingSpeaker);
  const nonFinalSpeakers = uniqueNames.filter((name) => name !== finalDailyMeetingSpeaker);

  return includesFinalSpeaker
    ? [...nonFinalSpeakers, finalDailyMeetingSpeaker]
    : nonFinalSpeakers;
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

  const roster = getEligibleDailyMeetingRoster(assigneeOptions);
  if (roster.length === 0) {
    return {
      assignee: "",
      round: null
    };
  }

  if (!round || round.order.length === 0) {
    const hasFinalSpeaker = roster.includes(finalDailyMeetingSpeaker);
    const randomizableNames = roster.filter((name) => name !== finalDailyMeetingSpeaker);
    const shuffledNames = shuffleNames(randomizableNames, random);
    const order = hasFinalSpeaker
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
