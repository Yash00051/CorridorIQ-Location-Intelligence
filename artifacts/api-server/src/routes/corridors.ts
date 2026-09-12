import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import Papa from "papaparse";
import {
  GetCorridorParams,
  GetCorridorResponse,
  GetCorridorsResponse,
  GetDashboardSummaryResponse,
  type Corridor,
} from "@workspace/api-zod";

type RawRow = Record<string, string | number | undefined>;

const router: IRouter = Router();

const numericFields = [
  "neighborhood_momentum",
  "timing_alpha",
  "safety_day",
  "safety_evening",
  "safety_late_night",
  "weekday_am",
  "weekday_midday",
  "weekday_evening",
  "late_night",
  "weekend_day",
  "path_of_travel_friction",
  "transit_car_orientation",
  "halo_strength",
  "chain_dominance",
  "cafe_whitespace",
  "qsr_whitespace",
  "fast_casual_whitespace",
  "fitness_whitespace",
  "beauty_wellness_whitespace",
  "grocery_convenience_whitespace",
  "shock_resilience",
  "seasonality_amplitude",
  "event_dependency",
  "development_dependency",
  "office_routine",
  "hybrid_remote",
  "family_household",
  "morning_commuters",
  "car_errands",
  "weekend_brunch",
  "young_social_cohort",
] as const;

type NumericField = (typeof numericFields)[number];

const categoryFields = {
  cafe: "cafe_whitespace",
  qsr: "qsr_whitespace",
  fast_casual: "fast_casual_whitespace",
  fitness: "fitness_whitespace",
  beauty_wellness: "beauty_wellness_whitespace",
  grocery_convenience: "grocery_convenience_whitespace",
} as const;

const categoryAudienceFields = {
  cafe: ["weekend_brunch", "hybrid_remote", "young_social_cohort"],
  qsr: ["car_errands", "morning_commuters", "family_household"],
  fast_casual: ["family_household", "car_errands", "weekend_brunch"],
  fitness: ["young_social_cohort", "hybrid_remote", "family_household"],
  beauty_wellness: ["young_social_cohort", "hybrid_remote", "weekend_brunch"],
  grocery_convenience: ["family_household", "car_errands", "morning_commuters"],
} as const satisfies Record<string, readonly NumericField[]>;

const daypartFields = [
  "weekday_am",
  "weekday_midday",
  "weekday_evening",
  "late_night",
  "weekend_day",
] as const;

function numberValue(row: RawRow, field: NumericField): number {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function score(row: RawRow, category: keyof typeof categoryFields): number {
  const whitespace = numberValue(row, categoryFields[category]);
  const momentum = numberValue(row, "neighborhood_momentum");
  const safety = average([
    numberValue(row, "safety_day"),
    numberValue(row, "safety_evening"),
    numberValue(row, "safety_late_night"),
  ]);
  const audienceFit = average(
    categoryAudienceFields[category].map((field) => numberValue(row, field)),
  );
  const daypartDemand = Math.max(
    ...daypartFields.map((field) => numberValue(row, field)),
  );
  const resilience = numberValue(row, "shock_resilience");
  const accessibility = 100 - numberValue(row, "path_of_travel_friction");

  return round(
    whitespace * 0.3 +
      momentum * 0.15 +
      safety * 0.15 +
      audienceFit * 0.2 +
      daypartDemand * 0.1 +
      resilience * 0.05 +
      accessibility * 0.05,
  );
}

function toCorridor(row: RawRow): Corridor {
  const numeric = Object.fromEntries(
    numericFields.map((field) => [field, numberValue(row, field)]),
  ) as Record<NumericField, number>;
  const base = {
    ...row,
    ...numeric,
  } as RawRow;

  const categoryScores = {
    cafe_score: score(base, "cafe"),
    qsr_score: score(base, "qsr"),
    fast_casual_score: score(base, "fast_casual"),
    fitness_score: score(base, "fitness"),
    beauty_wellness_score: score(base, "beauty_wellness"),
    grocery_convenience_score: score(base, "grocery_convenience"),
  };

  const whitespaceAverage = average(
    Object.values(categoryFields).map((field) => numberValue(base, field)),
  );
  const safety = average([
    numberValue(base, "safety_day"),
    numberValue(base, "safety_evening"),
    numberValue(base, "safety_late_night"),
  ]);
  const audienceFit = average([
    numberValue(base, "family_household"),
    numberValue(base, "car_errands"),
    numberValue(base, "weekend_brunch"),
  ]);
  const daypartDemand = Math.max(
    ...daypartFields.map((field) => numberValue(base, field)),
  );
  const opportunityScore = round(
    whitespaceAverage * 0.25 +
      numberValue(base, "neighborhood_momentum") * 0.2 +
      safety * 0.15 +
      audienceFit * 0.15 +
      daypartDemand * 0.1 +
      numberValue(base, "shock_resilience") * 0.1 +
      (100 - numberValue(base, "path_of_travel_friction")) * 0.05,
  );

  return {
    metro: String(row.metro ?? ""),
    corridor_id: String(row.corridor_id ?? ""),
    legacy_corridor_id: String(row.legacy_corridor_id ?? ""),
    corridor_name: String(row.corridor_name ?? ""),
    district: String(row.district ?? ""),
    level: String(row.level ?? ""),
    object_form: String(row.object_form ?? ""),
    form: String(row.form ?? ""),
    character: String(row.character ?? ""),
    dominant_audience: String(row.dominant_audience ?? ""),
    gateway_dependency: String(row.gateway_dependency ?? ""),
    ...numeric,
    opportunity_score: opportunityScore,
    ...categoryScores,
  };
}

let cachedCorridors: Corridor[] | undefined;

function loadCorridors(): Corridor[] {
  if (cachedCorridors) return cachedCorridors;

  const candidates = [
    path.resolve(process.cwd(), "data/corridors.csv"),
    path.resolve(process.cwd(), "artifacts/api-server/data/corridors.csv"),
  ];
  const csvPath = candidates.find((candidate) => existsSync(candidate));
  if (!csvPath) {
    throw new Error(
      `Corridor dataset not found. Checked: ${candidates.join(", ")}`,
    );
  }
  const csv = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<RawRow>(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Unable to parse corridor CSV");
  }

  cachedCorridors = GetCorridorsResponse.parse(
    parsed.data.map((row) => toCorridor(row)),
  );
  return cachedCorridors;
}

router.get("/corridors", (_req, res): void => {
  res.json(GetCorridorsResponse.parse(loadCorridors()));
});

router.get("/corridors/:corridorId", (req, res): void => {
  const params = GetCorridorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const corridor = loadCorridors().find(
    (item) => item.corridor_id === params.data.corridorId,
  );
  if (!corridor) {
    res.status(404).json({ error: "Corridor not found" });
    return;
  }

  res.json(GetCorridorResponse.parse(corridor));
});

router.get("/dashboard-summary", (_req, res): void => {
  const corridors = loadCorridors();
  const averageField = (field: NumericField): number =>
    round(average(corridors.map((corridor) => corridor[field])));
  const best = (
    label: string,
    field: keyof Corridor,
    format: (value: number) => string = (value) => `${Math.round(value)}`
  ) => {
    const corridor = corridors.reduce((current, item) =>
      Number(item[field]) > Number(current[field]) ? item : current,
    );
    const value = Number(corridor[field]);
    return {
      label,
      corridor_name: corridor.corridor_name,
      district: corridor.district,
      value: round(value),
      value_label: format(value),
    };
  };

  const summary = {
    total_corridors: corridors.length,
    average_cafe_whitespace: averageField("cafe_whitespace"),
    average_qsr_whitespace: averageField("qsr_whitespace"),
    average_neighborhood_momentum: averageField("neighborhood_momentum"),
    average_safety: round(
      average(
        corridors.map((corridor) =>
          average([
            corridor.safety_day,
            corridor.safety_evening,
            corridor.safety_late_night,
          ]),
        ),
      ),
    ),
    highlights: [
      best("Top opportunity corridor", "opportunity_score", (value) => `${Math.round(value)} / 100`),
      best("Strongest emerging corridor", "neighborhood_momentum", (value) => `${Math.round(value)} momentum`),
      best("Best corridor for cafés", "cafe_score", (value) => `${Math.round(value)} / 100`),
      best("Best corridor for QSR / fast casual", "qsr_score", (value) => `${Math.round(value)} / 100`),
    ],
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;