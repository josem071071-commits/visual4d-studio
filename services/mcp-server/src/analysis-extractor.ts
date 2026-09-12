export interface ExtractedAnalysis {
  sourceContent: string;
  analysisSummary: string;
  objective: string | null;
  essentialInformation: string[];
  missingInformation: string[];
  timeline: string[];
  agreements: string[];
  commitments: string[];
  validationFlags: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function valueAfterLabel(line: string, labels: string[]): string | null {
  const lower = line.toLowerCase();
  for (const label of labels) {
    const prefix = label.toLowerCase() + ":";
    if (lower.startsWith(prefix)) return line.slice(prefix.length).trim() || null;
  }
  return null;
}

export function extractAnalysisFromSource(sourceContent: string): ExtractedAnalysis {
  const source = sourceContent.trim();
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let objective: string | null = null;
  let section = "";
  const essential: string[] = [];
  const missing: string[] = [];
  const timeline: string[] = [];
  const agreements: string[] = [];
  const commitments: string[] = [];
  const validationFlags: string[] = [];

  for (const original of lines) {
    const line = original.replace(/^[-*•]\s*/, "").trim();
    const lower = line.toLowerCase();

    const directObjective = valueAfterLabel(line, ["Objetivo", "Objective"]);
    if (directObjective) {
      objective = directObjective;
      essential.push("Objetivo: " + directObjective);
      continue;
    }

    if (lower === "acuerdos" || lower === "acuerdos:" || lower === "agreements" || lower === "agreements:") { section = "agreements"; continue; }
    if (lower === "compromisos" || lower === "compromisos:" || lower === "commitments" || lower === "commitments:") { section = "commitments"; continue; }
    if (lower === "cronología" || lower === "cronologia" || lower === "ruta" || lower === "timeline") { section = "timeline"; continue; }
    if (lower.startsWith("observaciones") || lower.startsWith("pendientes") || lower.startsWith("validación") || lower.startsWith("validacion")) { section = "validation"; continue; }

    const uncertain = lower.includes("pendiente") || lower.includes("por validar") || lower.includes("por confirmar") || lower.includes("discrepancia") || lower.includes("requiere validación") || lower.includes("requiere validacion") || lower.includes("verificar");
    if (uncertain) {
      missing.push(line);
      validationFlags.push(line);
      continue;
    }

    if (section === "agreements") agreements.push(line);
    else if (section === "commitments") commitments.push(line);
    else if (section === "timeline") timeline.push(line);
    else if (section === "validation") { missing.push(line); validationFlags.push(line); }

    if (original !== line || lower.startsWith("fecha:") || lower.startsWith("lugar:") || lower.startsWith("asistencia:") || lower.includes("participantes") || lower.includes("tareas estratégicas") || lower.includes("tareas estrategicas") || lower.includes("ejes transversales") || lower.includes("cobertura")) essential.push(line);
  }

  essential.push(...agreements.map(value => "Acuerdo: " + value));
  essential.push(...commitments.map(value => "Compromiso: " + value));
  essential.push(...timeline.map(value => "Cronología: " + value));

  const essentialInformation = unique(essential);
  const missingInformation = unique(missing);
  const analysisSummary = unique([objective ? "Objetivo: " + objective : "", ...essentialInformation.slice(0, 5)]).join(". ");

  return {
    sourceContent: source,
    analysisSummary,
    objective,
    essentialInformation,
    missingInformation,
    timeline: unique(timeline),
    agreements: unique(agreements),
    commitments: unique(commitments),
    validationFlags: unique(validationFlags)
  };
}
