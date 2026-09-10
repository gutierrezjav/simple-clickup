import type { DailyMeetingConfig, DailyRow } from "@custom-clickup/shared";
import { describe, expect, it } from "vitest";
import {
  advanceDailyMeetingRound,
  getDailyMeetingFilterOptions,
  getDailyMeetingProgressCount,
  getEligibleDailyMeetingRoster,
  getNextDailyMeetingSpeaker
} from "./daily-meeting";

function createSequenceRandom(values: number[]): () => number {
  let index = 0;

  return () => values[index++] ?? 0;
}

const configuredDailyMeeting: DailyMeetingConfig = {
  excludedAssignees: ["Excluded Person One", "Excluded Person Two"],
  finalSpeaker: "Tail Speaker"
};

const finalSpeakerDailyMeeting: DailyMeetingConfig = {
  excludedAssignees: [],
  finalSpeaker: "Final Speaker"
};

describe("getEligibleDailyMeetingRoster", () => {
  it("excludes Unassigned and configured assignees, then keeps the configured final speaker last", () => {
    expect(
      getEligibleDailyMeetingRoster([
        "Unassigned",
        "Alice Smith",
        "Tail Speaker",
        "Excluded Person One",
        "Excluded Person Two",
        "Bob Jones"
      ], configuredDailyMeeting)
    ).toEqual(["Alice Smith", "Bob Jones", "Tail Speaker"]);
  });

  it("appends the configured final speaker even when they are not in the filter list", () => {
    expect(getEligibleDailyMeetingRoster(["Alice Smith", "Bob Jones"], configuredDailyMeeting)).toEqual([
      "Alice Smith",
      "Bob Jones",
      "Tail Speaker"
    ]);
  });
});

describe("getDailyMeetingFilterOptions", () => {
  it("keeps existing filter options and appends the configured final speaker when absent", () => {
    expect(
      getDailyMeetingFilterOptions(["Unassigned", "Alice Smith", "Bob Jones"], configuredDailyMeeting)
    ).toEqual(["Unassigned", "Alice Smith", "Bob Jones", "Tail Speaker"]);
  });

  it("does not duplicate the configured final speaker", () => {
    expect(
      getDailyMeetingFilterOptions(["Alice Smith", "Tail Speaker"], configuredDailyMeeting)
    ).toEqual(["Alice Smith", "Tail Speaker"]);
  });
});

describe("advanceDailyMeetingRound", () => {
  function story(id: string, assignees: string[], owner?: string): DailyRow {
    return {
      id,
      title: id,
      type: "story",
      ...(owner ? { assignee: owner } : {}),
      cards: assignees.map((assignee, index) => ({
        id: `${id}-${index}`,
        customId: `${id}-${index}`,
        title: "Task",
        status: "IN PROGRESS",
        assignee
      }))
    };
  }

  it.each([0, 0.5, 0.99])("keeps story teammates together with random seed %s", (seed) => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice", "Bob", "Carol", "Dave", "Solo", "Unassigned", "Excluded"],
      config: { excludedAssignees: ["Excluded"], finalSpeaker: "Final" },
      rows: [
        story("one", ["Carol", "Excluded", "Final"], "Alice"),
        story("two", ["Bob", "Dave"])
      ],
      random: () => seed,
      round: null
    });
    const order = result.round!.order;
    expect(Math.abs(order.indexOf("Alice") - order.indexOf("Carol"))).toBe(1);
    expect(Math.abs(order.indexOf("Bob") - order.indexOf("Dave"))).toBe(1);
    expect([...order].sort()).toEqual(["Alice", "Bob", "Carol", "Dave", "Final", "Solo"]);
    expect(order.at(-1)).toBe("Final");
  });

  it.each([0, 0.5, 0.99])("keeps the offline team together across multiple stories (%s)", (seed) => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alex", "Andrii", "Volodymyr", "Markus", "Javier", "Solo"],
      config: { excludedAssignees: [], finalSpeaker: "Javier" },
      rows: [
        story("netcorr", ["Alex", "Alex"], "Markus"),
        story("offline-bugs", ["Volodymyr", "Volodymyr", "Andrii", "Andrii"], "Volodymyr"),
        story("powersync", ["Andrii", "Andrii", "Andrii", "Andrii", "Volodymyr", "Volodymyr", "Alex", "Alex"], "Javier"),
        story("point-cloud", ["Javier", "Javier", "Javier"])
      ],
      random: () => seed,
      round: null
    });
    const order = result.round!.order;
    const positions = ["Alex", "Andrii", "Volodymyr"].map((name) => order.indexOf(name));
    expect(Math.max(...positions) - Math.min(...positions)).toBe(2);
    expect([...order].sort()).toEqual(["Alex", "Andrii", "Javier", "Markus", "Solo", "Volodymyr"]);
    expect(order.at(-1)).toBe("Javier");
  });

  it("counts unique eligible teammates and uses board order for equal-sized teams", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice", "Bob", "Carol", "Excluded", "Final"],
      config: { excludedAssignees: ["Excluded"], finalSpeaker: "Final" },
      rows: [
        story("one", ["Alice", "Bob"]),
        story("two", ["Alice", "Alice", "Alice", "Carol", "Excluded", "Final"])
      ],
      random: () => 0.99,
      round: null
    });
    expect(result.round?.order).toEqual(["Alice", "Bob", "Carol", "Final"]);
  });

  it("does not group unrelated standalone tasks or bugs", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice", "Bob", "Carol", "Dave"],
      config: { excludedAssignees: [] },
      rows: [
        { ...story("tasks", ["Alice", "Carol"]), type: "tasks" },
        { ...story("bugs", ["Bob", "Dave"]), type: "bugs" }
      ],
      random: () => 0.99,
      round: null
    });
    expect(result.round?.order).toEqual(["Alice", "Bob", "Carol", "Dave"]);
  });

  it("starts a randomized round on the first Next click", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    expect(result.assignee).toBe("Bob Jones");
    expect(result.round?.order).toEqual(["Bob Jones", "Alice Smith", "Final Speaker"]);
    expect(result.round?.currentIndex).toBe(0);
  });

  it("advances through the stored order without reshuffling mid-round", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const second = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });
    const third = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      round: second.round ?? null
    });

    expect(second.assignee).toBe("Alice Smith");
    expect(second.round?.order).toEqual(["Bob Jones", "Alice Smith", "Final Speaker"]);
    expect(third.assignee).toBe("Final Speaker");
    expect(third.round?.currentIndex).toBe(2);
  });

  it("resumes the stored order after a manual assignee interruption", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const resumed = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });

    expect(resumed.assignee).toBe("Alice Smith");
    expect(resumed.round?.currentIndex).toBe(1);
  });

  it("clears the selection after the final speaker", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });
    const finalSpeaker = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });
    const cleared = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      round: finalSpeaker.round ?? null
    });

    expect(finalSpeaker.assignee).toBe("Final Speaker");
    expect(cleared.assignee).toBe("");
    expect(cleared.round).toBeNull();
  });

  it("returns no selection when every assignee is excluded", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Unassigned", "Excluded Person One", "Excluded Person Two"],
      config: {
        excludedAssignees: ["Excluded Person One", "Excluded Person Two"]
      },
      round: null
    });

    expect(result.assignee).toBe("");
    expect(result.round).toBeNull();
  });

  it("keeps advancing the stored order even if the assignee list changes", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const changedRoster = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker", "New Person"],
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });

    expect(changedRoster.assignee).toBe("Alice Smith");
    expect(changedRoster.round?.order).toEqual(["Bob Jones", "Alice Smith", "Final Speaker"]);
  });
});

describe("getDailyMeetingProgressCount", () => {
  it("returns zero before the round starts", () => {
    expect(getDailyMeetingProgressCount(null)).toBe(0);
  });

  it.each([3, 12])("tracks every speaker in a round of %i people", (speakerCount) => {
    const assigneeOptions = Array.from({ length: speakerCount }, (_, index) => `Speaker ${index}`);
    let round = null;

    for (let selectedCount = 1; selectedCount <= speakerCount; selectedCount += 1) {
      const result = advanceDailyMeetingRound({
        assigneeOptions,
        config: { excludedAssignees: [] },
        round
      });
      round = result.round;

      expect(round?.order).toHaveLength(speakerCount);
      expect(getDailyMeetingProgressCount(round)).toBe(selectedCount);
    }

    const finished = advanceDailyMeetingRound({
      assigneeOptions,
      config: { excludedAssignees: [] },
      round
    });
    expect(getDailyMeetingProgressCount(finished.round)).toBe(0);
  });

  it("caps progress at the actual roster size", () => {
    expect(
      getDailyMeetingProgressCount({
        currentIndex: 8,
        order: ["Alice Smith", "Bob Jones", "Final Speaker"]
      })
    ).toBe(3);
  });

  it("keeps the indicator visible through the final speaker", () => {
    expect(
      getDailyMeetingProgressCount({
        currentIndex: 2,
        order: ["Alice Smith", "Bob Jones", "Final Speaker"]
      })
    ).toBe(3);
  });

  it("lights one segment for the first selected speaker", () => {
    expect(
      getDailyMeetingProgressCount({
        currentIndex: 0,
        order: ["Alice Smith", "Bob Jones", "Charlie Brown", "Final Speaker"]
      })
    ).toBe(1);
  });

  it("lights one additional segment for each selected speaker", () => {
    expect(
      getDailyMeetingProgressCount({
        currentIndex: 1,
        order: ["Alice Smith", "Bob Jones", "Charlie Brown", "Final Speaker"]
      })
    ).toBe(2);
  });
});

describe("getNextDailyMeetingSpeaker", () => {
  it("returns no preview before the round starts", () => {
    expect(getNextDailyMeetingSpeaker(null)).toBeNull();
  });

  it("returns the next speaker while the round is in progress", () => {
    expect(
      getNextDailyMeetingSpeaker({
        currentIndex: 0,
        order: ["Alice Smith", "Bob Jones", "Final Speaker"]
      })
    ).toBe("Bob Jones");
  });

  it("returns no preview after the final speaker is selected", () => {
    expect(
      getNextDailyMeetingSpeaker({
        currentIndex: 2,
        order: ["Alice Smith", "Bob Jones", "Final Speaker"]
      })
    ).toBeNull();
  });
});
