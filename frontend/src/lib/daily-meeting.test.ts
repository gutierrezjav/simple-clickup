import { dailyStatuses, type DailyMeetingConfig, type DailyRow } from "@custom-clickup/shared";
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

function taskRows(assignees: string[]): DailyRow[] {
  return [{ ...story("tasks", assignees), type: "tasks" }];
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
  it("only includes card assignees in the four main statuses, plus Jessica", () => {
    const rows = taskRows([...dailyStatuses]);
    rows[0]!.cards.forEach((card, index) => {
      card.status = dailyStatuses[index]!;
    });
    rows.push(story("owner-only", [], "Story Owner"));

    expect(getEligibleDailyMeetingRoster(
      [...dailyStatuses, "Story Owner", "Jessica Nilsson"],
      { excludedAssignees: [], finalSpeaker: "Jessica Nilsson" },
      rows
    )).toEqual([
      "SPRINT BACKLOG", "IN PROGRESS", "IN CODE REVIEW", "DEPLOYED TO DEV", "Jessica Nilsson"
    ]);
  });

  it("includes Javier with qualifying work and keeps Jessica even on an empty board", () => {
    const config = { excludedAssignees: ["Basil Weibel"], finalSpeaker: "Jessica Nilsson" };
    expect(getEligibleDailyMeetingRoster(
      ["Javier Gutierrez", "Basil Weibel"], config,
      taskRows(["Javier Gutierrez", "Basil Weibel"])
    )).toEqual(["Javier Gutierrez", "Jessica Nilsson"]);
    expect(getEligibleDailyMeetingRoster(["Javier Gutierrez"], config, [])).toEqual(["Jessica Nilsson"]);
  });

  it("excludes Unassigned and configured assignees, then keeps the configured final speaker last", () => {
    expect(
      getEligibleDailyMeetingRoster([
        "Unassigned",
        "Alice Smith",
        "Tail Speaker",
        "Excluded Person One",
        "Excluded Person Two",
        "Bob Jones"
      ], configuredDailyMeeting, taskRows(["Alice Smith", "Bob Jones"]))
    ).toEqual(["Alice Smith", "Bob Jones", "Tail Speaker"]);
  });

  it("appends the configured final speaker even when they are not in the filter list", () => {
    expect(getEligibleDailyMeetingRoster(["Alice Smith", "Bob Jones"], configuredDailyMeeting, taskRows(["Alice Smith", "Bob Jones"]))).toEqual([
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
  it("filters the Next rotation using card status while keeping Jessica last", () => {
    const rows = taskRows(["Javier Gutierrez", "Staging Only"]);
    rows[0]!.cards[1]!.status = "DEPLOYED TO STAGING";
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Staging Only", "Javier Gutierrez"],
      config: { excludedAssignees: [], finalSpeaker: "Jessica Nilsson" },
      rows,
      round: null
    });
    expect(result.round?.order).toEqual(["Javier Gutierrez", "Jessica Nilsson"]);
  });

  it.each([0, 0.5, 0.99])("keeps story teammates together with random seed %s", (seed) => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alice", "Bob", "Carol", "Dave", "Solo", "Unassigned", "Excluded"],
      config: { excludedAssignees: ["Excluded"], finalSpeaker: "Final" },
      rows: [
        story("one", ["Alice", "Carol", "Excluded", "Final"], "Alice"),
        story("two", ["Bob", "Dave"]),
        ...taskRows(["Alice", "Solo"])
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
        story("point-cloud", ["Javier", "Javier", "Javier"]),
        ...taskRows(["Markus", "Solo"])
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

  it.each([false, true])("does not group Javier with a story he only owns or has staging cards in (%s)", (hasStagingCard) => {
    const powersync = story("powersync", ["Alex", "Andrii", "Volodymyr"], "Javier Gutierrez");
    if (hasStagingCard) {
      powersync.cards.push({
        ...story("staging", ["Javier Gutierrez"]).cards[0]!,
        status: "DEPLOYED TO STAGING"
      });
    }
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Alex", "Andrii", "Volodymyr", "Javier Gutierrez", "Jessica Nilsson"],
      config: { excludedAssignees: [], finalSpeaker: "Jessica Nilsson" },
      rows: [powersync, story("point-cloud", ["Javier Gutierrez"])],
      random: () => 0.99,
      round: null
    });
    expect(result.round?.order).toEqual([
      "Alex", "Andrii", "Volodymyr", "Javier Gutierrez", "Jessica Nilsson"
    ]);
  });

  it("leaves Javier out when he only owns a user story", () => {
    const result = advanceDailyMeetingRound({
      assigneeOptions: ["Andrii", "Javier Gutierrez", "Jessica Nilsson"],
      config: { excludedAssignees: [], finalSpeaker: "Jessica Nilsson" },
      rows: [story("powersync", ["Andrii"], "Javier Gutierrez")],
      round: null
    });
    expect(result.round?.order).toEqual(["Andrii", "Jessica Nilsson"]);
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
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
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
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const second = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });
    const third = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
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
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const resumed = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Bob Jones", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });

    expect(resumed.assignee).toBe("Alice Smith");
    expect(resumed.round?.currentIndex).toBe(1);
  });

  it("clears the selection after the final speaker", () => {
    const started = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });
    const finalSpeaker = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      round: started.round ?? null
    });
    const cleared = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker"],
      rows: taskRows(["Alice Smith", "Final Speaker"]),
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
      rows: taskRows(["Unassigned", "Excluded Person One", "Excluded Person Two"]),
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
      rows: taskRows(["Alice Smith", "Bob Jones", "Final Speaker"]),
      config: finalSpeakerDailyMeeting,
      random: createSequenceRandom([0]),
      round: null
    });

    const changedRoster = advanceDailyMeetingRound({
      assigneeOptions: ["Alice Smith", "Final Speaker", "New Person"],
      rows: taskRows(["Alice Smith", "Final Speaker", "New Person"]),
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
        rows: taskRows(assigneeOptions),
        config: { excludedAssignees: [] },
        round
      });
      round = result.round;

      expect(round?.order).toHaveLength(speakerCount);
      expect(getDailyMeetingProgressCount(round)).toBe(selectedCount);
    }

    const finished = advanceDailyMeetingRound({
      assigneeOptions,
        rows: taskRows(assigneeOptions),
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
