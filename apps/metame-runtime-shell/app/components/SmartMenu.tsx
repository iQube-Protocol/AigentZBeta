"use client";

import type { RuntimeMenu, RuntimeMenuItem } from "@metame/aa-client";
import { BrowserLaunchEntry } from "./browser/BrowserLaunchEntry";

type SmartMenuProps = {
  menu: RuntimeMenu;
  busyActionId: string | null;
  onAction: (item: RuntimeMenuItem, payload?: Record<string, unknown>) => void;
  browserEnabled?: boolean;
  browserActive?: boolean;
  onBrowserLaunch?: () => void;
};

function selectEdgeItems(items: RuntimeMenuItem[]): { left: RuntimeMenuItem | null; right: RuntimeMenuItem | null } {
  const be = items.find((item) => item.id === "be") ?? null;
  const share = items.find((item) => item.id === "share") ?? null;
  return { left: be, right: share };
}

function isCore(item: RuntimeMenuItem): boolean {
  return item.id === "earn" || item.id === "play" || item.id === "make";
}

function MenuActionButton({
  item,
  busyActionId,
  onAction,
}: {
  item: RuntimeMenuItem;
  busyActionId: string | null;
  onAction: (item: RuntimeMenuItem) => void;
}) {
  const isBusy = busyActionId === item.id;
  return (
    <button
      type="button"
      className="menu-button"
      data-edge={item.edge ? "true" : "false"}
      disabled={!item.enabled || isBusy}
      onClick={() => onAction(item)}
      aria-busy={isBusy}
    >
      {item.label}
    </button>
  );
}

export function SmartMenu({ menu, busyActionId, onAction, browserEnabled = false, browserActive = false, onBrowserLaunch }: SmartMenuProps) {
  const coreItems = menu.items.filter(isCore);
  const { left: leftEdge, right: rightEdge } = selectEdgeItems(menu.items);
  const edgeEnabled = !!(leftEdge?.enabled || rightEdge?.enabled);
  const shouldCollapseCenter = menu.mode === "collapsed" || (!!menu.policy.collapse_to_metame_button && edgeEnabled);
  const beChildren = leftEdge?.children ?? [];

  if (shouldCollapseCenter) {
    return (
      <nav className="runtime-menu" aria-label="metaMe smart menu">
        {browserEnabled && onBrowserLaunch ? (
          <div className="browser-launch-row">
            <BrowserLaunchEntry active={browserActive} onOpen={onBrowserLaunch} />
          </div>
        ) : null}
        {beChildren.length > 0 ? (
          <div className="menu-be-strip">
            {beChildren.map((child) => (
              <button
                key={child.id}
                type="button"
                className="menu-be-child"
                disabled={!child.enabled || busyActionId === child.id}
                onClick={() => onAction(child)}
                aria-busy={busyActionId === child.id}
              >
                {child.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="menu-row-collapsed">
          {leftEdge ? (
            <MenuActionButton item={leftEdge} busyActionId={busyActionId} onAction={(item) => onAction(item)} />
          ) : (
            <button type="button" className="menu-button" disabled>
              Be
            </button>
          )}

          <details className="menu-meta">
            <summary className="menu-meta-trigger">metaMe</summary>
            <div className="menu-meta-list">
              {coreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled || busyActionId === item.id}
                  onClick={() => onAction(item, { source: "collapsed_center" })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>

          {rightEdge ? (
            <MenuActionButton item={rightEdge} busyActionId={busyActionId} onAction={(item) => onAction(item)} />
          ) : (
            <button type="button" className="menu-button" disabled>
              Share
            </button>
          )}
        </div>
      </nav>
    );
  }

  const displayItems = [...coreItems];
  if (leftEdge) displayItems.unshift(leftEdge);
  if (rightEdge) displayItems.push(rightEdge);

  return (
    <nav className="runtime-menu" aria-label="metaMe smart menu">
      {browserEnabled && onBrowserLaunch ? (
        <div className="browser-launch-row">
          <BrowserLaunchEntry active={browserActive} onOpen={onBrowserLaunch} />
        </div>
      ) : null}
      <div className="menu-row" style={{ gridTemplateColumns: `repeat(${displayItems.length}, minmax(0, 1fr))` }}>
        {displayItems.map((item) => (
          <MenuActionButton key={item.id} item={item} busyActionId={busyActionId} onAction={(next) => onAction(next)} />
        ))}
      </div>
    </nav>
  );
}
