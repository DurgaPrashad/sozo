import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { COMPUTATIONAL, circularOrbit, escapeVelocity, hohmannTransfer, planetTransfer, rocketEquation, runAstroCalculation, surfaceGravity } from "../lib/science/astro";
import { budgetFrom, chatProviders, generateReply } from "../lib/companion/provider";

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("orbits, escape speeds and gravity match reference values", () => {
  const iss = circularOrbit("earth", 408);
  near(iss.period_min, 92.6, 0.2);
  near(iss.velocity_km_s, 7.66, 0.01);
  near(escapeVelocity("earth").escape_velocity_km_s, 11.18, 0.01);
  near(escapeVelocity("mars").escape_velocity_km_s, 5.03, 0.01);
  near(surfaceGravity("moon").surface_gravity_m_s2, 1.62, 0.01);
});

test("a LEO to GEO Hohmann transfer needs about 3.85 km/s", () => {
  const transfer = hohmannTransfer("earth", 400, 35786);
  near(transfer.delta_v1_km_s, 2.40, 0.01);
  near(transfer.delta_v2_km_s, 1.46, 0.01);
  near(transfer.total_delta_v_km_s, 3.85, 0.01);
  near(transfer.transfer_time_h, 5.29, 0.02);
});

test("an Earth to Mars Hohmann transfer takes about 259 days", () => {
  const transfer = planetTransfer("earth", "mars");
  near(transfer.transfer_time_days, 259, 1);
  near(transfer.departure_v_infinity_km_s, 2.94, 0.02);
  near(transfer.arrival_v_infinity_km_s, 2.65, 0.02);
  near(transfer.synodic_period_days, 780, 2);
});

test("the rocket equation works both ways", () => {
  near(rocketEquation(311, { initialMassKg: 549000, finalMassKg: 130000 }).delta_v_m_s, 4393, 2);
  const ratio = rocketEquation(450, { deltaVMs: 9400 });
  near(ratio.mass_ratio, 8.42, 0.02);
  near(ratio.propellant_fraction!, 0.881, 0.002);
});

test("bad tool input becomes an error the model can read", () => {
  assert.match(runAstroCalculation({ operation: "escape_velocity", body: "vulcan" }).error!, /Unknown body/);
  assert.match(runAstroCalculation({ operation: "rocket_equation", isp_s: 300, initial_mass_kg: 10, final_mass_kg: 20 }).error!, /less than/);
  assert.match(runAstroCalculation({ operation: "warp" }).error!, /Unknown operation/);
  assert.equal(runAstroCalculation({ operation: "circular_orbit", body: "The Moon", altitude_km: 100 }).result!.body, "moon");
  assert.ok(COMPUTATIONAL.test("Delta-v for a Hohmann transfer to GEO?"));
  assert.ok(!COMPUTATIONAL.test("Hello SOZO"));
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("numeric questions run the calculator and the answer quotes its result", async () => {
  const bodies: { tools?: unknown; messages: { role: string; content?: string; tool_call_id?: string }[] }[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    if (body.tools && body.tool_choice !== "none") return Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "astro_calculator", arguments: JSON.stringify({ operation: "hohmann_transfer", body: "earth", from_altitude_km: 400, to_altitude_km: 35786 }) } }] }, finish_reason: "tool_calls" }] });
    return Response.json({ choices: [{ message: { content: "About 3.854 km/s in total." } }] });
  }) as typeof fetch;
  const result = await generateReply(chatProviders({ SARVAM_API_KEY: "k" }), { message: "Delta-v for a Hohmann transfer from LEO to GEO?", history: [] }, [], { budget: budgetFrom(Date.now() + 20000) });
  assert.equal(result.reply, "About 3.854 km/s in total.");
  assert.equal(result.calculations.length, 1);
  near(Number(result.calculations[0].result!.total_delta_v_km_s), 3.854, 0.002);
  assert.equal(bodies.length, 2);
  const toolMessage = bodies[1].messages.find((m) => m.role === "tool")!;
  assert.equal(toolMessage.tool_call_id, "c1");
  assert.match(toolMessage.content!, /total_delta_v_km_s/);
  assert.match(bodies[0].messages[0].content!, /astro_calculator/);
  // Providers require the tool list alongside tool results.
  assert.equal((bodies[1] as { tool_choice?: string }).tool_choice, "none");
});
