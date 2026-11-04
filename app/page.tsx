import { withOptionalFallback } from "@/lib/optionalData";
import { canRefreshEditorialSourcesNow } from "@/lib/updateSchedule";
import { ManualRefreshButton } from "./components/ManualRefreshButton";
import { RetryMorningEditionButton } from "./components/RetryMorningEditionButton";
import { TrackableLink } from "./components/TrackableLink";
import { getReaderProfile } from "@/lib/readerProfile";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getDailyHeaderInfo } from "@/lib/dailyHeader";
import { getCachedWeather } from "@/lib/weather";
import { getCachedSportDay } from "@/lib/sportDayCache";
import { getCachedMarketDay } from "@/lib/marketDay";
import { getTodayDailyEdition } from "@/lib/dailyEdition";
import { MarketDayPanel } from "./components/MarketDayPanel";
import { SportDayPanel } from "./components/SportDayPanel";
import {
  CultureSnapshotPanel,
  LocalSnapshotPanel,
  NationalSnapshotPanel,
  WorldSnapshotPanel,
} from "./components/DailySnapshotPanels";
import {
  getCachedCultureSnapshot,
  getCachedLocalSnapshot,
  getCachedNationalSnapshot,
  getCachedWorldSnapshot,
} from "@/lib/dailySnapshots";
import { ReaderCount } from "./components/ReaderCount";
import type { EditorialSection } from "@/lib/editorV2";

export const dynamic = "force-dynamic";

const CATEGORY_ACCENTS = {
  elfsborg: "text-yellow-700",
  boras: "text-orange-700",
  sverige: "text-blue-700",
  varlden: "text-emerald-700",
  ekonomi: "text-amber-800",
  fotboll: "text-s¶»§q«^