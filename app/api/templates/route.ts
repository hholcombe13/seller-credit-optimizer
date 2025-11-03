import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { LoanTemplate, ScenarioInput } from "@/types/mortgage";

const programEnum = z.enum(["Conventional", "FHA", "VA", "USDA", "Jumbo"]);
const pmiEnum = z.enum(["BPMI", "SPMI", "LPMI", "None"]);

const numberField = z.number().finite();
const nonNegativeNumber = numberField.min(0);

const scenarioSchema = z.object({
  name: z.string().optional(),
  price: nonNegativeNumber,
  ltv: numberField.min(0).max(1.5).optional(),
  loanAmount: nonNegativeNumber.optional(),
  program: programEnum,
  termMonths: numberField.int().positive(),
  noteRate: numberField,
  discountPointsPct: numberField,
  closingCosts: nonNegativeNumber,
  sellerCredit: nonNegativeNumber,
  pmiType: pmiEnum.optional(),
  pmiAnnualFactor: nonNegativeNumber.optional(),
  taxesMonthly: nonNegativeNumber.optional(),
  insuranceMonthly: nonNegativeNumber.optional(),
  hoaMonthly: nonNegativeNumber.optional(),
  lockRate: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  title: z.string().min(1).max(80).trim(),
  scenario: scenarioSchema,
});

function mapTemplate(dbTemplate: Awaited<ReturnType<typeof prisma.template.findUnique>>): LoanTemplate {
  if (!dbTemplate) {
    throw new Error("Template not found");
  }

  return {
    id: dbTemplate.id,
    title: dbTemplate.title,
    program: dbTemplate.program as ScenarioInput["program"],
    termMonths: dbTemplate.termMonths,
    price: dbTemplate.price,
    ltv: dbTemplate.ltv,
    loanAmount: dbTemplate.loanAmount,
    noteRate: dbTemplate.noteRate,
    discountPointsPct: dbTemplate.discountPts,
    closingCosts: dbTemplate.closingCosts,
    sellerCredit: dbTemplate.sellerCredit,
    pmiType: dbTemplate.pmiType as ScenarioInput["pmiType"],
    pmiAnnualFactor: dbTemplate.pmiAnnualFac,
    taxesMonthly: dbTemplate.taxesMonthly,
    insuranceMonthly: dbTemplate.insuranceMonthly,
    hoaMonthly: dbTemplate.hoaMonthly,
    lockRate: dbTemplate.lockRate,
    createdAt: dbTemplate.createdAt.toISOString(),
    updatedAt: dbTemplate.updatedAt.toISOString(),
  };
}

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates.map(mapTemplate));
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { title, scenario } = createTemplateSchema.parse(json);

    const data = await prisma.template.create({
      data: {
        title,
        program: scenario.program,
        termMonths: scenario.termMonths,
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
        lockRate: scenario.lockRate ?? false,
      },
    });

    return NextResponse.json(mapTemplate(data), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.format() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
