import type { Meta, StoryObj } from "@storybook/react";
import { dailyFixtures } from "@custom-clickup/shared";
import { DailyCard } from "./daily-card";

const meta = {
  title: "Daily/DailyCard",
  component: DailyCard
} satisfies Meta<typeof DailyCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: dailyFixtures[0]!.cards[0]!
  }
};
