import type { Meta, StoryObj } from "@storybook/react";
import { planningFixtures } from "@custom-clickup/shared";
import { PlanningRow } from "./planning-row";

const meta = {
  title: "Planning/PlanningRow",
  component: PlanningRow
} satisfies Meta<typeof PlanningRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StoryCollapsed: Story = {
  args: {
    item: planningFixtures[0]!,
    expanded: false
  }
};

export const StoryExpanded: Story = {
  args: {
    item: planningFixtures[0]!,
    expanded: true
  }
};

export const StandaloneBug: Story = {
  args: {
    item: planningFixtures[2]!,
    expanded: false
  }
};
