import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { DocumentRecord, EmergencyProtocolRecord, MedicationRecord, PatientRecord } from "@carecircle/shared";

export const exportService = {
  buildCsv(rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(
        headers
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      );
    });
    return lines.join("\n");
  },

  buildEmergencyProtocolPdf(patient: PatientRecord, protocol: EmergencyProtocolRecord) {
    const doc = new jsPDF({ format: "a6" });
    doc.setFontSize(18);
    doc.text("CareCircle Emergency Protocol", 10, 16);
    doc.setFontSize(11);
    doc.text(`Patient: ${patient.name}`, 10, 28);
    doc.text(`Blood type: ${patient.bloodType}`, 10, 36);
    doc.text(`Allergies: ${patient.allergies.join(", ")}`, 10, 44, { maxWidth: 90 });
    doc.text(`Doctor: ${patient.primaryDoctorName} ${patient.primaryDoctorPhone}`, 10, 58, { maxWidth: 90 });
    doc.text(`Protocol: ${protocol.title}`, 10, 72);
    protocol.steps.slice(0, 4).forEach((step, index) => {
      doc.text(`${index + 1}. ${step}`, 10, 84 + index * 9, { maxWidth: 90 });
    });
    return Buffer.from(doc.output("arraybuffer"));
  },

  buildEmergencyCardPdf(patient: PatientRecord, medications: MedicationRecord[]) {
    const doc = new jsPDF({ format: "a6" });
    doc.setFontSize(18);
    doc.text("CareCircle Emergency Card", 10, 15);
    doc.setFontSize(11);
    doc.text(`Patient: ${patient.name}`, 10, 28);
    doc.text(`Blood type: ${patient.bloodType}`, 10, 36);
    doc.text(`Allergies: ${patient.allergies.join(", ")}`, 10, 44, { maxWidth: 86 });
    doc.text(`Conditions: ${[patient.primaryDiagnosis, ...patient.secondaryConditions].slice(0, 3).join(", ")}`, 10, 60, {
      maxWidth: 86,
    });
    doc.text(`Doctor: ${patient.primaryDoctorName} ${patient.primaryDoctorPhone}`, 10, 78, { maxWidth: 86 });
    doc.text(`Insurance: ${patient.insuranceProvider} ${patient.insuranceId}`, 10, 94, { maxWidth: 86 });
    medications.slice(0, 5).forEach((medication, index) => {
      doc.text(`${index + 1}. ${medication.name} ${medication.doseAmount}${medication.doseUnit}`, 10, 110 + index * 8, {
        maxWidth: 86,
      });
    });
    return Buffer.from(doc.output("arraybuffer"));
  },

  async buildDocumentsZip(documents: DocumentRecord[]) {
    const zip = new JSZip();

    documents.forEach((document) => {
      const fallbackSummary = [
        `Document: ${document.fileName}`,
        `Category: ${document.documentCategory}`,
        `Uploaded: ${document.uploadDate}`,
        "",
        document.aiSummary.summary,
      ].join("\n");

      zip.file(document.fileName.endsWith(".txt") ? document.fileName : `${document.fileName}.txt`, fallbackSummary);
    });

    return zip.generateAsync({ type: "nodebuffer" });
  },
};
