// Exact two-body astrodynamics and rocketry for SOZO's calculator tool.
// Standard gravitational parameters (km³/s²) and equatorial radii (km) are
// JPL/IAU values; heliocentric semi-major axes are mean orbital values (km).
export const BODIES = {
  sun: { mu: 1.32712440018e11, radius: 695700 },
  mercury: { mu: 2.2031868551e4, radius: 2440.53, orbit: 5.7909e7 },
  venus: { mu: 3.24858592e5, radius: 6051.8, orbit: 1.08209e8 },
  earth: { mu: 3.986004418e5, radius: 6378.137, orbit: 1.49598e8 },
  moon: { mu: 4.9028001184e3, radius: 1737.4 },
  mars: { mu: 4.282837362e4, radius: 3396.19, orbit: 2.27939e8 },
  jupiter: { mu: 1.267127648e8, radius: 71492, orbit: 7.78479e8 },
  saturn: { mu: 3.79405852e7, radius: 60268, orbit: 1.43353e9 },
  uranus: { mu: 5.794556e6, radius: 25559, orbit: 2.87097e9 },
  neptune: { mu: 6.8365299e6, radius: 24764, orbit: 4.4984e9 },
  pluto: { mu: 8.696138e2, radius: 1188.3 },
  ceres: { mu: 62.6284, radius: 469.7 },
} as const;
export type BodyName = keyof typeof BODIES;
const G0 = 9.80665; // m/s²

export const ASTRO_OPERATIONS = [
  "circular_orbit",
  "escape_velocity",
  "hohmann_transfer",
  "planet_transfer",
  "rocket_equation",
  "surface_gravity",
] as const;
export type AstroOperation = (typeof ASTRO_OPERATIONS)[number];

export class AstroError extends Error {}

const round = (value: number, digits = 4) => Number(value.toPrecision(digits));
function bodyOf(value: unknown, fallback: BodyName = "earth"): BodyName {
  const name = String(value ?? fallback).trim().toLowerCase().replace(/^the\s+/, "");
  if (!(name in BODIES)) throw new AstroError(`Unknown body "${value}". Use one of: ${Object.keys(BODIES).join(", ")}.`);
  return name as BodyName;
}
function number(value: unknown, name: string, { min = 0, max = 1e12 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new AstroError(`${name} must be a number between ${min} and ${max}.`);
  return n;
}

export function circularOrbit(body: BodyName, altitudeKm: number) {
  const { mu, radius } = BODIES[body];
  const r = radius + altitudeKm;
  const velocity = Math.sqrt(mu / r);
  const period = 2 * Math.PI * Math.sqrt(r ** 3 / mu);
  return { body, altitude_km: altitudeKm, orbit_radius_km: round(r, 6), velocity_km_s: round(velocity), period_s: round(period, 5), period_min: round(period / 60) };
}

export function escapeVelocity(body: BodyName, altitudeKm = 0) {
  const { mu, radius } = BODIES[body];
  return { body, altitude_km: altitudeKm, escape_velocity_km_s: round(Math.sqrt((2 * mu) / (radius + altitudeKm))) };
}

export function hohmannTransfer(body: BodyName, fromAltitudeKm: number, toAltitudeKm: number) {
  const { mu, radius } = BODIES[body];
  const r1 = radius + fromAltitudeKm, r2 = radius + toAltitudeKm;
  const a = (r1 + r2) / 2;
  const dv1 = Math.abs(Math.sqrt(mu * (2 / r1 - 1 / a)) - Math.sqrt(mu / r1));
  const dv2 = Math.abs(Math.sqrt(mu / r2) - Math.sqrt(mu * (2 / r2 - 1 / a)));
  const time = Math.PI * Math.sqrt(a ** 3 / mu);
  return {
    body, from_altitude_km: fromAltitudeKm, to_altitude_km: toAltitudeKm,
    delta_v1_km_s: round(dv1), delta_v2_km_s: round(dv2), total_delta_v_km_s: round(dv1 + dv2),
    transfer_time_h: round(time / 3600),
  };
}

// Heliocentric Hohmann transfer between two planets' (circular, coplanar)
// orbits: hyperbolic excess speeds at departure and arrival, and flight time.
export function planetTransfer(from: BodyName, to: BodyName) {
  const a1 = (BODIES[from] as { orbit?: number }).orbit, a2 = (BODIES[to] as { orbit?: number }).orbit;
  if (!a1 || !a2) throw new AstroError("planet_transfer needs two planets that orbit the Sun.");
  const mu = BODIES.sun.mu, a = (a1 + a2) / 2;
  const vInfDeparture = Math.abs(Math.sqrt(mu * (2 / a1 - 1 / a)) - Math.sqrt(mu / a1));
  const vInfArrival = Math.abs(Math.sqrt(mu / a2) - Math.sqrt(mu * (2 / a2 - 1 / a)));
  const time = Math.PI * Math.sqrt(a ** 3 / mu);
  return {
    from, to,
    departure_v_infinity_km_s: round(vInfDeparture), arrival_v_infinity_km_s: round(vInfArrival),
    transfer_time_days: round(time / 86400),
    synodic_period_days: round(1 / Math.abs(1 / (2 * Math.PI * Math.sqrt(a1 ** 3 / mu)) - 1 / (2 * Math.PI * Math.sqrt(a2 ** 3 / mu))) / 86400),
  };
}

export function rocketEquation(ispS: number, { initialMassKg, finalMassKg, deltaVMs }: { initialMassKg?: number; finalMassKg?: number; deltaVMs?: number }) {
  const ve = ispS * G0;
  if (initialMassKg !== undefined && finalMassKg !== undefined) {
    if (finalMassKg >= initialMassKg) throw new AstroError("final_mass_kg must be less than initial_mass_kg.");
    return { isp_s: ispS, exhaust_velocity_m_s: round(ve), mass_ratio: round(initialMassKg / finalMassKg), delta_v_m_s: round(ve * Math.log(initialMassKg / finalMassKg)) };
  }
  if (deltaVMs !== undefined) {
    const ratio = Math.exp(deltaVMs / ve);
    return { isp_s: ispS, exhaust_velocity_m_s: round(ve), delta_v_m_s: deltaVMs, mass_ratio: round(ratio), propellant_fraction: round(1 - 1 / ratio) };
  }
  throw new AstroError("rocket_equation needs initial_mass_kg and final_mass_kg, or delta_v_m_s.");
}

export function surfaceGravity(body: BodyName) {
  const { mu, radius } = BODIES[body];
  return { body, surface_gravity_m_s2: round((mu / radius ** 2) * 1000), surface_gravity_g: round((mu / radius ** 2) * 1000 / G0) };
}

export type Calculation = { operation: string; input: Record<string, unknown>; result?: Record<string, unknown>; error?: string };

// Runs one tool call; errors are returned for the model to read, not thrown.
export function runAstroCalculation(input: Record<string, unknown>): Calculation {
  const operation = String(input.operation ?? "");
  try {
    let result: Record<string, unknown>;
    switch (operation as AstroOperation) {
      case "circular_orbit": result = circularOrbit(bodyOf(input.body), number(input.altitude_km ?? 0, "altitude_km", { max: 1e10 })); break;
      case "escape_velocity": result = escapeVelocity(bodyOf(input.body), number(input.altitude_km ?? 0, "altitude_km", { max: 1e10 })); break;
      case "hohmann_transfer": result = hohmannTransfer(bodyOf(input.body), number(input.from_altitude_km, "from_altitude_km", { max: 1e10 }), number(input.to_altitude_km, "to_altitude_km", { max: 1e10 })); break;
      case "planet_transfer": result = planetTransfer(bodyOf(input.from_body), bodyOf(input.to_body)); break;
      case "rocket_equation": result = rocketEquation(number(input.isp_s, "isp_s", { min: 1, max: 100000 }), {
        initialMassKg: input.initial_mass_kg === undefined ? undefined : number(input.initial_mass_kg, "initial_mass_kg", { min: 1e-6 }),
        finalMassKg: input.final_mass_kg === undefined ? undefined : number(input.final_mass_kg, "final_mass_kg", { min: 1e-6 }),
        deltaVMs: input.delta_v_m_s === undefined ? undefined : number(input.delta_v_m_s, "delta_v_m_s", { max: 1e6 }),
      }); break;
      case "surface_gravity": result = surfaceGravity(bodyOf(input.body)); break;
      default: throw new AstroError(`Unknown operation "${operation}".`);
    }
    return { operation, input, result };
  } catch (error) {
    return { operation, input, error: error instanceof AstroError ? error.message : "Calculation failed." };
  }
}

export const ASTRO_TOOL = {
  type: "function",
  function: {
    name: "astro_calculator",
    description:
      "Exact two-body astrodynamics and rocketry. Use it for every number it can compute: circular orbit speed and period at an altitude (circular_orbit), escape velocity (escape_velocity), Hohmann transfers between two circular orbits around ONE body, given as altitudes above its surface in km (hohmann_transfer, e.g. LEO to GEO), travel between two planets around the Sun (planet_transfer with from_body and to_body, e.g. Earth to Mars; never hohmann_transfer for this), the Tsiolkovsky rocket equation with masses in kg (rocket_equation), and surface gravity (surface_gravity).",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: [...ASTRO_OPERATIONS] },
        body: { type: "string", enum: Object.keys(BODIES), description: "Central body (default earth)." },
        altitude_km: { type: "number" },
        from_altitude_km: { type: "number" },
        to_altitude_km: { type: "number" },
        from_body: { type: "string", description: "planet_transfer: departure planet." },
        to_body: { type: "string", description: "planet_transfer: arrival planet." },
        isp_s: { type: "number", description: "Specific impulse in seconds." },
        initial_mass_kg: { type: "number" },
        final_mass_kg: { type: "number" },
        delta_v_m_s: { type: "number" },
      },
      required: ["operation"],
    },
  },
} as const;

// Questions that need numbers SOZO can compute exactly.
export const COMPUTATIONAL = /delta[- ]?v|Δv|hohmann|transfer orbit|orbital (period|speed|velocity)|circular (orbit|velocity)|escape (velocity|speed)|rocket equation|tsiolkovsky|specific impulse|\bisp\b|mass ratio|surface gravity|how long .*(orbit|transfer|to reach)|period of|km\/s|burn(out)? mass|propellant (mass|fraction)|v[- ]?infinity|synodic/i;
