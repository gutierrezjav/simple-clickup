import type { Meta, StoryObj } from "@storybook/react";
import { DailyPage, dailyPageStoryLoader } from "./daily-page";

const meta = {
  title: "Screens/DailyPage",
  component: DailyPage,
  argTypes: {
    loader: {
      control: false
    }
  }
} satisfies Meta<typeof DailyPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    loader: dailyPageStoryLoader
  }
};
