import { useMemo, useState } from "react";
import { Download, PhoneCall, Printer, QrCode, RefreshCcw, Share2, ShieldAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Badge, Button, Card, Modal, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { apiBase } from "@/lib/api";
import { calcAge, formatDate } from "@/lib/format";

const backendUrl = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

const severityLabel = (type: string) =>
  ["fall", "cardiac", "diabetic_emergency", "allergic_reaction", "breathing_difficulty", "seizure"].includes(type)
    ? "IMMEDIATE"
    : "URGENT";

export const EmergencyPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  if (!bootstrap) return null;

  const { patient, data } = bootstrap;
  const canShareEmergency = bootstrap.capabilities.includes("share_emergency");
  const canViewInsurance = bootstrap.capabilities.includes("view_insurance");
  const activeMedications = data.medications.filter((item) => item.isActive);
  const shareableFamily = data.familyMembers.filter((member) => member.joinStatus === "active" && member.email);
  const primaryProtocolId = data.emergencyProtocols[0]?.id ?? "";
  const publicEmergencyUrl = shareUrl || `${backendUrl}/api/public/emergency/${data.emergencyProtocols[0]?.shareToken ?? ""}`;

  const openShareTools = async () => {
    try {
      const result = await request<{ url: string }>("/emergency/share-link", {
        method: "POST",
        body: JSON.stringify({ protocolId: primaryProtocolId }),
      });
      setShareUrl(result.url);
      setSelectedFamilyIds(shareableFamily.map((member) => member.id));
      setShareOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const openQrTools = async () => {
    try {
      const result = await request<{ url: string }>("/emergency/share-link", {
        method: "POST",
        body: JSON.stringify({ protocolId: primaryProtocolId }),
      });
      setShareUrl(result.url);
      setQrOpen(true);
      await navigator.clipboard.writeText(result.url);
      toast.success("QR link copied to clipboard.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const sendToFamily = async () => {
    try {
      const result = await request<{ sent: number }>("/emergency/share-email", {
        method: "POST",
        body: JSON.stringify({ familyMemberIds: selectedFamilyIds }),
      });
      toast.success(`Sent to ${result.sent} family members.`);
      setShareOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const printCard = () => {
    window.open(`${backendUrl}/api/emergency/card/pdf`, "_blank", "noopener,noreferrer");
    toast.success("Opening the printable emergency card.");
  };

  const regenerateProtocols = async () => {
    try {
      await request("/emergency/generate", { method: "POST" });
      toast.success("Emergency protocols refreshed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const criticalSummary = useMemo(
    () => [patient.primaryDiagnosis, ...patient.secondaryConditions].filter(Boolean).join(", "),
    [patient.primaryDiagnosis, patient.secondaryConditions],
  );

  const secondaryActionGrid = `mt-4 grid gap-3 sm:grid-cols-2 ${canShareEmergency ? "lg:grid-cols-4" : "lg:grid-cols-2"}`;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[#1A1A2E] p-0 text-white shadow-calm">
        <div className="p-6 md:p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">Emergency Quick Access</p>
          <h1 className="mt-3 text-3xl font-bold text-white">One tap to the most important help.</h1>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <a
              href="tel:911"
              className="flex min-h-[56px] items-center justify-center rounded-3xl border border-red-200 bg-white px-5 text-lg font-bold text-red-600"
            >
              <PhoneCall className="mr-2 h-5 w-5" />
              Call 911
            </a>
            <a
              href={patient.primaryDoctorPhone ? `tel:${patient.primaryDoctorPhone.replaceAll(/[^0-9]/g, "")}` : "/settings"}
              className="flex min-h-[56px] items-center justify-center rounded-3xl border border-slate-500 bg-white px-5 text-lg font-bold text-slate-900"
            >
              <PhoneCall className="mr-2 h-5 w-5" />
              {patient.primaryDoctorPhone ? `Call Dr. ${patient.primaryDoctorName.replace("Dr. ", "")}` : "No number saved | Add now"}
            </a>
            <Button className="min-h-[56px] w-full" onClick={() => setInfoOpen(true)}>
              <ShieldAlert className="h-5 w-5" />
              Patient Info Card
            </Button>
          </div>

          <div className={secondaryActionGrid}>
            <Button
              variant="secondary"
              className="min-h-[48px] bg-white text-brandDark"
              onClick={() => {
                if (!patient.primaryDoctorPhone) {
                  toast.error("No doctor phone saved.");
                  return;
                }
                window.open(`tel:${patient.primaryDoctorPhone.replaceAll(/[^0-9]/g, "")}`, "_self");
              }}
            >
              <PhoneCall className="h-4 w-4" />
              Call Now
            </Button>
            <Button variant="secondary" className="min-h-[48px] bg-white text-brandDark" onClick={printCard}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            {canShareEmergency ? (
              <Button variant="secondary" className="min-h-[48px] bg-white text-brandDark" onClick={() => void openShareTools()}>
                <Share2 className="h-4 w-4" />
                Share with Family
              </Button>
            ) : null}
            {canShareEmergency ? (
              <Button variant="secondary" className="min-h-[48px] bg-white text-brandDark" onClick={() => void openQrTools()}>
                <QrCode className="h-4 w-4" />
                Copy QR Link
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Emergency protocols"
          description="Clear, calm steps personalized to Ellie's conditions, allergies, and medications."
          action={
            canShareEmergency ? (
              <Button onClick={regenerateProtocols}>
                <RefreshCcw className="h-4 w-4" />
                Regenerate all
              </Button>
            ) : undefined
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {data.emergencyProtocols.map((protocol) => {
            const severity = severityLabel(protocol.protocolType);
            const expanded = expandedId === protocol.id;
            return (
              <div
                key={protocol.id}
                className={`rounded-[28px] border border-borderColor bg-white p-5 ${severity === "IMMEDIATE" ? "border-l-4 border-l-danger" : "border-l-4 border-l-secondary"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-danger" />
                      <p className="text-xl font-bold text-textPrimary">{protocol.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-textSecondary">{protocol.steps[0]}</p>
                  </div>
                  <Badge tone={severity === "IMMEDIATE" ? "danger" : "warning"}>{severity}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="danger" onClick={() => window.open("tel:911", "_self")}>
                    <PhoneCall className="h-4 w-4" />
                    Call now
                  </Button>
                  <a href={`${apiBase}/emergency/${protocol.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" onClick={() => setDownloadingId(protocol.id)}>
                      <Download className="h-4 w-4" />
                      {downloadingId === protocol.id ? "Downloading..." : "PDF"}
                    </Button>
                  </a>
                  {canShareEmergency ? (
                    <Button variant="ghost" onClick={() => void openShareTools()}>
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="mt-4 text-base font-semibold text-brandDark"
                  onClick={() => setExpandedId(expanded ? null : protocol.id)}
                >
                  {expanded ? "Hide steps" : "View steps"}
                </button>

                {expanded ? (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-3">
                      {protocol.steps.map((step, index) => (
                        <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{index + 1}</div>
                          <p className="pt-1 text-[17px] leading-7 text-textPrimary">{step}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-3xl bg-amber-50 p-4">
                      <p className="font-semibold text-amber-900">What to tell 911</p>
                      <ul className="mt-2 space-y-2 text-sm text-amber-900/80">
                        {protocol.responderNotes.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-3xl bg-sky-50 p-4">
                      <p className="font-semibold text-sky-900">Critical info for ER</p>
                      <p className="mt-2 text-sm text-sky-900/80">{criticalSummary}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <QRCodeSVG value={publicEmergencyUrl} size={180} />
          <div>
            <p className="text-lg font-bold text-textPrimary">Scan for emergency info - no login required</p>
            <p className="mt-1 text-sm text-textSecondary">Print and keep this QR code on the fridge, in a wallet, or by the patient's chair.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canShareEmergency ? (
              <Button variant="secondary" onClick={() => void openQrTools()}>
                <QrCode className="h-4 w-4" />
                Download QR as image
              </Button>
            ) : null}
            <Button onClick={printCard}>
              <Printer className="h-4 w-4" />
              Print Emergency Card
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={infoOpen} title="Patient information card" onClose={() => setInfoOpen(false)}>
        <div className="space-y-4 text-base">
          <div className="rounded-3xl border border-borderColor p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-textSecondary">Identity</p>
            <div className="mt-3 flex items-center gap-4">
              {patient.photoUrl ? (
                <img src={patient.photoUrl} alt={`${patient.name} profile`} className="h-20 w-20 rounded-3xl object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brandSoft text-2xl font-bold text-brandDark">
                  {patient.name[0]}
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-textPrimary">{patient.name}</p>
                <p className="text-textSecondary">Age {calcAge(patient.dateOfBirth)} | DOB {formatDate(patient.dateOfBirth)}</p>
                <p className="font-semibold text-danger">Blood type: {patient.bloodType}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-red-50 p-4">
            <p className="font-semibold text-red-700">Allergies</p>
            <p className="mt-2 text-red-700/80">{patient.allergies.join(", ")}</p>
          </div>
          <div className="rounded-3xl border border-borderColor p-4">
            <p className="font-semibold text-textPrimary">Conditions</p>
            <ul className="mt-2 space-y-2 text-textSecondary">
              {[patient.primaryDiagnosis, ...patient.secondaryConditions].map((condition) => <li key={condition}>- {condition}</li>)}
            </ul>
          </div>
          <div className="rounded-3xl border border-borderColor p-4">
            <p className="font-semibold text-textPrimary">Medications</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-textSecondary">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Dose</th>
                    <th className="pb-2 pr-4">Frequency</th>
                    <th className="pb-2 pr-4">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMedications.map((medication) => (
                    <tr key={medication.id}>
                      <td className="py-2 pr-4">{medication.name}</td>
                      <td className="py-2 pr-4">{medication.doseAmount}{medication.doseUnit}</td>
                      <td className="py-2 pr-4">{medication.frequency}</td>
                      <td className="py-2 pr-4">{medication.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-3xl border border-borderColor p-4">
            <p className="font-semibold text-textPrimary">Contacts</p>
            <p className="mt-2 text-textSecondary">Primary doctor: {patient.primaryDoctorName} - {patient.primaryDoctorPhone}</p>
            <p className="text-textSecondary">Hospital: {patient.hospitalPreference}</p>
            {canViewInsurance ? (
              <p className="text-textSecondary">Insurance: {patient.insuranceProvider} - {patient.insuranceId}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-3">
            {canShareEmergency ? (
              <Button
                variant="ghost"
                className="mb-2 sm:mb-0"
                onClick={() => {
                  setInfoOpen(false);
                  void openQrTools();
                }}
              >
                <QrCode className="h-4 w-4" />
                Share with First Responders
              </Button>
            ) : null}
            <Button variant="secondary" onClick={printCard}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={printCard}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={shareOpen} title="Share Emergency Info" onClose={() => setShareOpen(false)}>
        <div className="space-y-4">
          {shareableFamily.map((member) => (
            <label key={member.id} className="flex items-center gap-3 rounded-3xl border border-borderColor p-4">
              <input
                type="checkbox"
                checked={selectedFamilyIds.includes(member.id)}
                onChange={(event) =>
                  setSelectedFamilyIds((current) =>
                    event.target.checked ? [...current, member.id] : current.filter((item) => item !== member.id),
                  )
                }
              />
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brandSoft font-bold text-brandDark">{member.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-textPrimary">{member.name}</p>
                <p className="text-sm text-textSecondary">{member.role.replaceAll("_", " ")}</p>
              </div>
            </label>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button onClick={sendToFamily}>Send Email to Selected</Button>
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied to clipboard."))}
            >
              Copy Shareable Link
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={qrOpen} title="Emergency QR link" onClose={() => setQrOpen(false)}>
        <div className="flex flex-col items-center gap-4 text-center">
          <QRCodeSVG value={shareUrl} size={200} />
          <p className="break-all text-sm text-textSecondary">{shareUrl}</p>
          <p className="text-sm text-textSecondary">Print this QR code and keep it on the fridge or in your wallet.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied to clipboard."))}
            >
              Download QR Image
            </Button>
            <Button onClick={printCard}>Print Emergency Card</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
