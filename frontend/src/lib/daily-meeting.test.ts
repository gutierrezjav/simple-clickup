import { describe, expect, it } from "vitest";
import {
  advanceDailyMeetingRound,
  getEligibleDailyMeetingRoster
} from "./daily-meeting";

function createSequenceRandom(values: number[]): () => number {
  let index = 0;

  return () => values[index++] ?? 0;
}

describe("getEligibleDailyMeetingRoster", () => {
  it("excludes Unassigned and Javier Gutierrez and keeps Jessica Nilsson last", () => {
    expect(
      getEligibleDailyMeetingRoster([
        "Unassigned",
        "Alice Smith",
        "Jessica Nilsson",
        "Javier Gutierrez",
        "Bob Jones"
      ])
    ).toEqual(["Alice Smith", "Bob Jones", "Jessica Nilsson"]);
  });

  it("does not append Jessica Nilsson when she is not in the filter list", () => {
    expect(getEligibleDailyMeetingRoster(["Alice Smith", "Bob Jones"])).toEqual([
      "Alice Smith",
      "Bob Jones"
    ]);
  });
});

describe("advanceDailyMeetingRound", () => {
  it("starts a randomized round on the first Next click", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      random: createSequenceRandom([0]),
      round: null
    });

    expect(result.assignee).toBe("Bob Jones");
    expect(result.round?.order).toEqual(["Bob Jones", "Alice Smith", "Jessica Nilsson"]);
    expect(result.round?.currentIndex).toBe(0);
  });

  it("advances through the stored order without reshuffling mid-round", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      random: createSequenceRandom([0]),
      round: null
    });

    const second = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      round: started.round ?? null
    });
    const third = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      round: second.round ?? null
    });

    expect(second.assignee).toBe("Alice Smith");
    expect(second.round?.order).toEqual(["Bob Jones", "Alice Smith", "Jessica Nilsson"]);
    expect(third.assignee).toBe("Jessica Nilsson");
    expect(third.round?.currentIndex).toBe(2);
  });

  it("resumes the stored order after a manual assignee interruption", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      random: createSequenceRandom([0]),
      round: null
    });

    const resumed = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      round: started.round ?? null
    });

    expect(resumed.assignee).toBe("Alice Smith");
    expect(resumed.round?.currentIndex).toBe(1);
  });

  it("clears the selection after the final speaker", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Jessica Nilsson"],
      random: createSequenceRandom([0]),
      round: null
    });
    const finalSpeaker = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Jessica Nilsson"],
      round: started.round ?? null
    });
    const cleared = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Jessica Nilsson"],
      round: finalSpeaker.round ?? null
    });

    expect(finalSpeaker.assignee).toBe("Jessica Nilsson");
    expect(cleared.assignee).toBe("");
    expect(cleared.round).toBeNull();
  });

  it("returns no selection when every assignee is excluded", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Unassigned", "Javier Gutierrez"],
      round: null
    });

    expect(result.assignee).toBe("");
    expect(result.round).toBeNull();
  });

  it("keeps advancing the stored order even if the assignee list changes", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Jessica Nilsson"],
      random: createSequenceRandom([0]),
      round: null
    });

    const changedRoster = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Jessica Nilsson", "New Person"],
      round: started.round ?? null
    });

    expect(changedRoster.assignee).toBe("Alice Smith");
    expect(changedRoster.round?.order).toEqual(["Bob Jones", "Alice Smith", "Jessica Nilsson"]);
  });
});
