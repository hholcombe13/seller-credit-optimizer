import { NextRequest, NextResponse } from "next/server";
import type { Template } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { ScenarioInput, ScenarioTemplate } from "@/types/mortgage";

const REQUIRED_NUMERIC_FIELDS: Array<keyof ScenarioInput> = [
  "price",
  "termMonths",
  "noteRate",
  "discountPointsPct",
  "closingCosts",
  "sellerCredit",
];

function toClientTemplate(template: Template): ScenarioTemplate {
  return {
    id: template.id,
    title: template.title,
    program: template.program as ScenarioTemplate["program"],
    termMonths: template.termMonths,
    price: template.price,
    ltv: template.ltv ?? undefined,
    loanAmount: template.loanAmount ?? undefined,
    noteRate: template.noteRate,
    discountPointsPct: template.discountPts,
    closingCosts: template.closingCosts,
    sellerCredit: template.sellerCredit,
    pmiType: template.pmiType ?? undefined,
    pmiAnnualFactor: template.pmiAnnualFac ?? undefined,
    taxesMonthly: template.taxesMonthly ?? undefined,
    insuranceMonthly: template.insuranceMonthly ?? undefined,
    hoaMonthly: template.hoaMonthly ?? undefined,
    lockRate: template.lockRate,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function isValidScenario(scenario: ScenarioInput | undefined): scenario is ScenarioInput {
  if (!scenario) return false;
  if (!scenario.program) return false;

  return REQUIRED_NUMERIC_FIELDS.every((field) => {
    const value = scenario[field];
    return typeof value === "number" && Number.isFinite(value);
  });
}

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(templates.map(toClientTemplate));
  } catch (error) {
    console.error("Failed to load templates", error);
    return NextResponse.json(
      { error: "Unable to load templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, scenario } = (await req.json()) as {
      title?: string;
      scenario?: ScenarioInput;
    };

    const trimmedTitle = title?.trim();

    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Template title is required" },
        { status: 400 },
      );
    }

    if (!isValidScenario(scenario)) {
      return NextResponse.json(
        { error: "Scenario payload is missing required fields" },
        { status: 400 },
      );
    }

    const template = await prisma.template.create({
      data: {
        title: trimmedTitle,
        program: scenario.program,
        termMonths: Math.round(scenario.termMonths),
        price: scenario.price,
        ltv: scenario.ltv ?? null,
        loanAmount: scenario.loanAmount ?? null,
        noteRate: scenario.noteRate,
        discountPts: scenario.discountPointsPct,
        closingCosts: scenario.closingCosts,
        sellerCredit: scenario.sellerCredit,
        pmiType: scenario.pmiType ?? null,
        pmiAnnualFac: scenario.pmiAnnualFactor ?? null,
        taxesMonthly: scenario.taxesMonthly ?? null,
        insuranceMonthly: scenario.insuranceMonthly ?? null,
        hoaMonthly: scenario.hoaMonthly ?? null,
        lockRate: !!scenario.lockRate,
      },
    });

    return NextResponse.json(toClientTemplate(template), { status: 201 });
  } catch (error) {
    console.error("Failed to save template", error);
    return NextResponse.json(
      { error: "Unable to save template" },
      { status: 500 },
    );
  }
}
