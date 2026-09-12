import test from "node:test";
import assert from "node:assert/strict";

const sample=`REPORTE EJECUTIVO – REUNIÓN EXTRAORDINARIA
Objetivo: Presentar el Plan Operativo septiembre–noviembre 2026 y realizar mesa de trabajo mediante diálogo generativo.
- Fecha: 11/09/2026, 9:00 a.m.
- Lugar: Salón Social de la Planta de Baja Densidad POLINTER.
- Asistencia: 70 trabajadores, 54 hombres y 16 mujeres.
- Cuatro tareas estratégicas.
- Cuatro ejes transversales.
Acuerdos:
- Desplegar la ruta septiembre–noviembre.
Compromisos:
- Dar seguimiento a los acuerdos.
Observaciones:
- Discrepancia 45 vs. 47 pendiente de validación institucional.`;

test("ANALYSIS extracts objective, essentials, agreements, commitments and validation gaps",async()=>{
  const {extractAnalysisFromSource}=await import("../../dist-integration/services/mcp-server/src/analysis-extractor.js");
  const analysis=extractAnalysisFromSource(sample);
  assert.match(analysis.objective,/Plan Operativo septiembre–noviembre 2026/i);
  assert.ok(analysis.analysisSummary.length>0);
  assert.ok(analysis.essentialInformation.some(value=>/70 trabajadores/i.test(value)));
  assert.ok(analysis.agreements.some(value=>/ruta septiembre–noviembre/i.test(value)));
  assert.ok(analysis.commitments.some(value=>/seguimiento/i.test(value)));
  assert.ok(analysis.missingInformation.some(value=>/45 vs\. 47/i.test(value)));
  assert.ok(analysis.validationFlags.some(value=>/45 vs\. 47/i.test(value)));
});

test("ANALYSIS keeps unlabeled-source uncertainty explicit instead of empty semantic fields",async()=>{
  const {extractAnalysisFromSource}=await import("../../dist-integration/services/mcp-server/src/analysis-extractor.js");
  const analysis=extractAnalysisFromSource("Documento fuente V4D-SAT");
  assert.ok(analysis.objective);
  assert.ok(analysis.essentialInformation.length>0);
  assert.ok(analysis.missingInformation.some(value=>/Objetivo explícito no identificado/i.test(value)));
});
