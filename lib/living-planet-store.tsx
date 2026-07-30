import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  generateWorld,
  introduceContribution,
  runTicks,
  type ContributionAnalysis,
  type Region,
  type SimulationDelta,
  type WorldSnapshot,
  type WorldState,
} from "@/packages/simulation-models/src";

const STORAGE_KEY = "living-planet.world.v1";
const DEFAULT_SEED = 2_047_319;
const MAX_SNAPSHOTS = 24;

interface PersistedState {
  world: WorldState;
  snapshots: WorldSnapshot[];
}

interface LivingPlanetValue {
  ready: boolean;
  world: WorldState;
  displayWorld: WorldState;
  snapshots: WorldSnapshot[];
  latestDelta: SimulationDelta | null;
  isPlaying: boolean;
  speed: 1 | 4 | 10;
  selectedRegionId: string;
  selectedRegion: Region;
  previewSnapshotId: string | null;
  runTick: (count?: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: 1 | 4 | 10) => void;
  selectRegion: (regionId: string) => void;
  previewSnapshot: (snapshotId: string | null) => void;
  addContribution: (input: {
    sourceText: string;
    originRegionId: string;
    analysis: ContributionAnalysis;
  }) => void;
  resetWorld: () => void;
}

function snapshotOf(world: WorldState, suffix: string): WorldSnapshot {
  return {
    id: `snapshot-${world.tick}-${suffix}`,
    tick: world.tick,
    year: world.year,
    createdAt: new Date().toISOString(),
    state: world,
  };
}

function validWorld(value: unknown): value is WorldState {
  if (!value || typeof value !== "object") return false;
  const world = value as Partial<WorldState>;
  return (
    world.version === 1 &&
    typeof world.seed === "number" &&
    typeof world.tick === "number" &&
    Array.isArray(world.regions) &&
    world.regions.length >= 48 &&
    Array.isArray(world.events) &&
    Array.isArray(world.civilizations)
  );
}

const initialWorld = generateWorld(DEFAULT_SEED);
const LivingPlanetContext = createContext<LivingPlanetValue | null>(null);

export function LivingPlanetProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [world, setWorld] = useState(initialWorld);
  const [snapshots, setSnapshots] = useState<WorldSnapshot[]>([
    snapshotOf(initialWorld, "origin"),
  ]);
  const [latestDelta, setLatestDelta] = useState<SimulationDelta | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4 | 10>(1);
  const [selectedRegionId, setSelectedRegionId] = useState(
    initialWorld.regions.find((region) => region.civilizationId)?.id ?? initialWorld.regions[0].id,
  );
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const restored = JSON.parse(raw) as Partial<PersistedState>;
        if (!validWorld(restored.world)) return;
        setWorld(restored.world);
        setSnapshots(
          Array.isArray(restored.snapshots) && restored.snapshots.length > 0
            ? restored.snapshots.filter((item) => validWorld(item?.state)).slice(-MAX_SNAPSHOTS)
            : [snapshotOf(restored.world, "restored")],
        );
        setSelectedRegionId(
          restored.world.regions.find((region) => region.civilizationId)?.id ??
            restored.world.regions[0].id,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const persisted: PersistedState = { world, snapshots };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
    }, 240);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [ready, snapshots, world]);

  const runTick = useCallback((count = 1) => {
    setPreviewSnapshotId(null);
    setWorld((current) => {
      const result = runTicks(current, count);
      const lastDelta = result.deltas[result.deltas.length - 1] ?? null;
      setLatestDelta(lastDelta);
      if (result.state.tick > 0 && result.state.tick % 5 === 0) {
        setSnapshots((items) => [
          ...items.filter((item) => item.tick !== result.state.tick),
          snapshotOf(result.state, "auto"),
        ].slice(-MAX_SNAPSHOTS));
      }
      return result.state;
    });
  }, []);

  useEffect(() => {
    if (!isPlaying || previewSnapshotId) return;
    const intervalMs = speed === 1 ? 1_600 : speed === 4 ? 760 : 380;
    const timer = setInterval(() => runTick(1), intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, previewSnapshotId, runTick, speed]);

  const resetWorld = useCallback(() => {
    const next = generateWorld(DEFAULT_SEED);
    setPlaying(false);
    setWorld(next);
    setSnapshots([snapshotOf(next, "origin")]);
    setLatestDelta(null);
    setPreviewSnapshotId(null);
    setSelectedRegionId(
      next.regions.find((region) => region.civilizationId)?.id ?? next.regions[0].id,
    );
  }, []);

  const addContribution = useCallback(
    (input: {
      sourceText: string;
      originRegionId: string;
      analysis: ContributionAnalysis;
    }) => {
      setPreviewSnapshotId(null);
      setWorld((current) => {
        const before = snapshotOf(current, `before-contribution-${current.contributions.length + 1}`);
        const next = introduceContribution(current, {
          ...input,
          ownerId: "sandbox-user",
        });
        const after = snapshotOf(next, `contribution-${next.contributions.length}`);
        setSnapshots((items) => [...items, before, after].slice(-MAX_SNAPSHOTS));
        return next;
      });
    },
    [],
  );

  const displayWorld = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === previewSnapshotId)?.state ?? world,
    [previewSnapshotId, snapshots, world],
  );
  const selectedRegion = useMemo(
    () =>
      displayWorld.regions.find((region) => region.id === selectedRegionId) ??
      displayWorld.regions[0],
    [displayWorld.regions, selectedRegionId],
  );

  const value = useMemo<LivingPlanetValue>(
    () => ({
      ready,
      world,
      displayWorld,
      snapshots,
      latestDelta,
      isPlaying,
      speed,
      selectedRegionId,
      selectedRegion,
      previewSnapshotId,
      runTick,
      setPlaying,
      setSpeed,
      selectRegion: setSelectedRegionId,
      previewSnapshot: setPreviewSnapshotId,
      addContribution,
      resetWorld,
    }),
    [
      addContribution,
      displayWorld,
      isPlaying,
      latestDelta,
      previewSnapshotId,
      ready,
      resetWorld,
      runTick,
      selectedRegion,
      selectedRegionId,
      snapshots,
      speed,
      world,
    ],
  );

  return <LivingPlanetContext.Provider value={value}>{children}</LivingPlanetContext.Provider>;
}

export function useLivingPlanet() {
  const value = useContext(LivingPlanetContext);
  if (!value) throw new Error("LivingPlanetProvider is missing");
  return value;
}
