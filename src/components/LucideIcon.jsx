import React, { createElement, forwardRef } from "react";
import * as Icons from "lucide-react";

const LucideIcon = forwardRef(function LucideIcon(
  { name, size = 18, strokeWidth = 1.75, className = "", ...props },
  ref,
) {
  const IconComponent = Icons[name] ?? Icons.HelpCircle;
  return createElement(IconComponent, { ref, size, strokeWidth, className, ...props });
});

export default LucideIcon;
