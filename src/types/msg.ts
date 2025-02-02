import { Tab, TabCache, GroupInfo, TabsTreeData } from './tabs'
import { Panel } from './sidebar'
import { NormalizedSnapshot, RemovingSnapshotResult, Snapshot } from './snapshots'
import { DragInfo, DropType, ItemInfo, DstPlaceInfo, Notification } from '../types'
import { IPCheckResult, UpgradingState } from '../types'
import { GroupPageInitData, UrlPageInitData } from 'src/services/tabs.bg.actions'

export const enum InstanceType {
  unknown = -1,
  bg = 0,
  group = 1,
  sidebar = 2,
  setup = 3,
  search = 4,
  url = 5,
  proxy = 6,
}

export interface ConnectInfo {
  instanceType: InstanceType
  windowId: ID
}

export interface Message<T extends InstanceType, A extends ActionsKeys<T>> {
  windowId?: ID
  instanceType?: InstanceType
  action?: A
  name?: string
  arg?: FirstParameter<ActionsType<T>[A]>
  args?: Parameters<ActionsType<T>[A]>
}

export type BgActions = {
  cacheTabsData: (windowId: ID, tabs: TabCache[], delay?: number) => void
  createSnapshot: () => Promise<Snapshot | undefined>
  removeSnapshot: (id: ID) => Promise<RemovingSnapshotResult>
  openSnapshotWindows: (snapshot: NormalizedSnapshot, winIndex?: number) => Promise<void>
  saveFavicon: (url: string, icon: string) => void
  checkIpInfo: (cookieStoreId: ID) => Promise<IPCheckResult | null>
  createWindowWithTabs: (
    tabsInfo: ItemInfo[],
    conf?: browser.windows.CreateData
  ) => Promise<boolean>
  isWindowTabsLocked: (id: ID) => boolean
  getUrlPageInitData: () => Promise<UrlPageInitData>
  getGroupPageInitData: (winId: ID, tabId: ID) => Promise<GroupPageInitData>
  tabsApiProxy: (method: string, ...args: any[]) => Promise<any>
  checkUpgrade: () => UpgradingState | null
  continueUpgrade: () => void
}

export type SettingsActions = {
  goToPerm: (permId: string) => void
}

export type SidebarActions = {
  reloadTab: (tab: Tab) => void
  queryTab: (props: Partial<Tab>) => Tab | null
  getTabs: (tabIds: ID[]) => Tab[] | undefined
  getTabsTreeData: () => TabsTreeData
  getActivePanelInfo: () => Panel
  startDrag: (info: DragInfo, dstType?: DropType) => void
  stopDrag: () => void
  getGroupInfo: (groupTabId: ID) => GroupInfo | null
  handleReopening: (tabId: ID, newCtx: string) => number | undefined

  loadFavicons: () => void
  setFavicon: (domain: string, url: string, hash: number, icon: string) => void

  onOutsideSearchInput: (value: string) => void
  onOutsideSearchNext: () => void
  onOutsideSearchPrev: () => void
  onOutsideSearchEnter: () => void
  onOutsideSearchSelectAll: () => void
  onOutsideSearchMenu: () => void
  onOutsideSearchExit: () => void

  moveTabsToThisWin: (tabs: Tab[], dst?: DstPlaceInfo) => Promise<boolean>
  openTabs: (items: ItemInfo[], dst: DstPlaceInfo) => Promise<boolean>

  notify: (config: Notification, timeout?: number) => void
  notifyAboutNewSnapshot: () => void
}

export type SearchPopupActions = {
  closePopup: () => void
}

export type Actions = BgActions | SettingsActions | SidebarActions | SearchPopupActions

export type ActionsKeys<T> = T extends InstanceType.bg
  ? keyof BgActions
  : T extends InstanceType.setup
  ? keyof SettingsActions
  : T extends InstanceType.sidebar
  ? keyof SidebarActions
  : T extends InstanceType.search
  ? keyof SearchPopupActions
  : never

export type ActionsType<T> = T extends InstanceType.bg
  ? BgActions
  : T extends InstanceType.setup
  ? SettingsActions
  : T extends InstanceType.sidebar
  ? SidebarActions
  : T extends InstanceType.search
  ? SearchPopupActions
  : any
