export type RainHour = { time: string; precipitationMm: number };
export type RainAccumulations = { hour1: number | null; hour3: number | null; hour6: number | null; hour24: number | null };

export function calculateRainAccumulations(hours: RainHour[]): RainAccumulations {
  const total = (window: number) => {
    const sample = hours.slice(0, window);
    if (sample.length !== window || sample.some(({ precipitationMm }) => !Number.isFinite(precipitationMm) || precipitationMm < 0)) return null;
    return Number(sample.reduce((sum, hour) => sum + hour.precipitationMm, 0).toFixed(1));
  };
  return { hour1: total(1), hour3: total(3), hour6: total(6), hour24: total(24) };
}
