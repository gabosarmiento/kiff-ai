import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { KiffCreatePage } from "./KiffCreatePage";

const meta: Meta<typeof KiffCreatePage> = {
  title: "Kiffs/Create",
  component: KiffCreatePage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    isSubmitting: false,
  },
};

export default meta;

type Story = StoryObj<typeof KiffCreatePage>;

export const Default: Story = {
  args: {
    onCreate: () => alert("New Kiff created (mock)"),
    mode: "auto",
  },
};

export const Light: Story = {
  name: "Light (white)",
  args: {
    onCreate: () => alert("New Kiff created (mock)"),
    mode: "light",
  },
};

export const Dark: Story = {
  name: "Dark",
  args: {
    onCreate: () => alert("New Kiff created (mock)"),
    mode: "dark",
  },
};

export const Submitting: Story = {
  name: "Submitting state",
  args: {
    isSubmitting: true,
  },
};
