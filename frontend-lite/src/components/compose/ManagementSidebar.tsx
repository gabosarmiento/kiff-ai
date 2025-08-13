"use client";
import React from "react";
import { useComposeUi } from "./composeUiStore";
import { FolderTree, Users, Database, KeySquare, Settings, LayoutTemplate } from "lucide-react";

// Icon wrapper to avoid JSX typing issues (matches BottomNav pattern)
const wrap = (C: any) => {
  const W: React.FC<React.SVGProps<SVGSVGElement>> = (props) => React.createElement(C as any, props as any);
  W.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return W;
};
const FolderTreeIcon = wrap(FolderTree);
const UsersIcon = wrap(Users);
const DatabaseIcon = wrap(Database);
const KeySquareIcon = wrap(KeySquare);
const SettingsIcon = wrap(Settings);
const LayoutTemplateIcon = wrap(LayoutTemplate);

function Item(props: { label: string; icon: React.ReactNode; disabled?: boolean; onClick?: () => void }){
  const cls = `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
    props.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
  }`;
  return (
    <div className={cls} onClick={props.disabled ? undefined : props.onClick}>
      <span className="h-4 w-4">{props.icon}</span>
      <span className="truncate">{props.label}</span>
    </div>
  );
}

export function ManagementSidebar(props: { className?: string; onOpenCode?: () => void }){
  const { phase, sidebarOpen, toggleSidebar } = useComposeUi();
  const built = phase === 'built' || phase === 'running' || phase === 'reviewing';
  return (
    <aside className={("h-full rounded border bg-white "+(props.className||""))}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-medium">Manage</div>
        <button className="button" onClick={toggleSidebar}>{sidebarOpen ? 'Hide' : 'Show'}</button>
      </div>
      <div className="p-2 grid gap-1">
        <Item label="Overview" icon={<LayoutTemplateIcon className="h-4 w-4"/>} disabled={!built} />
        <Item label="Code" icon={<FolderTreeIcon className="h-4 w-4"/>} disabled={!built} onClick={props.onOpenCode} />
        <Item label="Users" icon={<UsersIcon className="h-4 w-4"/>} disabled={!built} />
        <Item label="DB" icon={<DatabaseIcon className="h-4 w-4"/>} disabled={!built} />
        <Item label="Env & Secrets" icon={<KeySquareIcon className="h-4 w-4"/>} disabled={!built} />
        <Item label="Settings" icon={<SettingsIcon className="h-4 w-4"/>} disabled={!built} />
      </div>
    </aside>
  );
}

export default ManagementSidebar;
