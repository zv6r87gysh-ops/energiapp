import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// shadcn/ui-style composable button, owned by this project.
export function Button({
  className,
  asChild = false,
  ...props
}: React.ComponentPropsWithRef<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={twMerge(clsx("button", className))} {...props} />;
}
