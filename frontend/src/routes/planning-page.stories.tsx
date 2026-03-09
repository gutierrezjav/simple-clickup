import type { Meta, StoryObj } from "@storybook/react";
import { PlanningPage, planningPageStoryLoader } from "./planning-page";

const meta = {
  title: "Screens/PlanningPage",
  component: PlanningPage,
  argTypes: {
    loader: {
      control: false
    }
  }
} satisfies Meta<typeof PlanningPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    loader: planningPageStoryLoader
  }
};
