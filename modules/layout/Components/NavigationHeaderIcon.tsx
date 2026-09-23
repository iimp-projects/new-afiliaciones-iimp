"use client";

import { securityModuleDefinition } from "@/modules/security/Config/Navigation";
import type { NavigationNode } from "@/modules/navigation/Models/NavigationNode";
import { DynamicIcon } from "../Utils/DynamicIcon";

export function findNavigationItemByPath(nodes: NavigationNode[], pathname: string): NavigationNode | undefined {
  const matches: NavigationNode[] = [];
  const visit = (items: NavigationNode[]) => items.forEach((item) => {
    if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) matches.push(item);
    if (item.children) visit(item.children);
  });
  visit(nodes);
  return matches.sort((left, right) => (right.href?.length ?? 0) - (left.href?.length ?? 0))[0];
}

/**
 * Renders the icon declared by the navigation source of truth for a module route.
 * New modules only need an icon in Navigation.ts for their header to inherit it.
 */
export function NavigationHeaderIcon({ href }: { href: string }) {
  const item = findNavigationItemByPath(securityModuleDefinition.navigation ?? [], href);
  if (!item?.icon) return null;

  return <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdfaf5] text-[#a67c00]"><DynamicIcon name={item.icon} size={22} strokeWidth={2.25} /></span>;
}
