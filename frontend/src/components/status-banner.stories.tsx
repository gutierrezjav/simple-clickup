import type { Meta, StoryObj } from "@storybook/react";
import { StatusBanner } from "./status-banner";

const meta = {
  title: "System/StatusBanner",
  component: StatusBanner
} satisfies Meta<typeof StatusBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mock: Story = {
  args: { readMode: "mock", writeMode: "mock" }
};

export const TestSpace: Story = {
  args: { readMode: "live", writeMode: "test-space" }
};

export const Live: Story = {
  args: { readMode: "live", writeMode: "live" }
};
