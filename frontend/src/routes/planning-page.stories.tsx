import type { Meta, StoryObj } from "@storybook/react";
import { PlanningPage } from "./planning-page";

const meta = {
  title: "Screens/PlanningPage",
  component: PlanningPage
} satisfies Meta<typeof PlanningPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
