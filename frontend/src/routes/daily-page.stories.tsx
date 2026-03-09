import type { Meta, StoryObj } from "@storybook/react";
import { DailyPage } from "./daily-page";

const meta = {
  title: "Screens/DailyPage",
  component: DailyPage
} satisfies Meta<typeof DailyPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
