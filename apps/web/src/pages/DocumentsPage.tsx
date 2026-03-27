import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSearch, Trash2, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import type { DocumentRecord } from "@carecircle/shared";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";

const categoryOptions: Array<{ value: DocumentRecord["documentCategory"] | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "medical_record", label: "Medical Record" },
  { value: "insurance", label: "Insurance" },
  { value: "lab_result", label: "Lab Result" },
  { value: "prescription", label: "Prescription" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "other", label: "Other" },
];

const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const maxFileSize = 20 * 1024 * 1024;

export const DocumentsPage = () => {
  const { bootstrap, request, refresh } = useAppData();
  const [documentItems, setDocumentItems] = useState<DocumentRecord[]>(() => bootstrap?.data.documents ?? []);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState("");
  const [selectedDocumentUrlLoading, setSelectedDocumentUrlLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DocumentRecord["documentCategory"]>("medical_record");
  const [categoryFilter, setCategoryFilter] = useState<DocumentRecord["documentCategory"] | "all">("all");
  const [dateRange, setDateRange] = useState("all");
  const [sort, setSort] = useState("newest");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!bootstrap) return null;

  const hasProcessingDocuments = documentItems.some((document) =>
    document.processingStatus === "queued" || document.processingStatus === "processing",
  );

  useEffect(() => {
    setDocumentItems(bootstrap.data.documents);
    if (!selectedDocument) return;
    const nextSelectedDocument = bootstrap.data.documents.find((document) => document.id === selectedDocument.id) ?? null;
    setSelectedDocument(nextSelectedDocument);
  }, [bootstrap.data.documents, selectedDocument?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadSecureUrl = async () => {
      if (!selectedDocument) {
        setSelectedDocumentUrl("");
        setSelectedDocumentUrlLoading(false);
        return;
      }

      if (!selectedDocument.storagePath) {
        setSelectedDocumentUrl(selectedDocument.fileUrl);
        setSelectedDocumentUrlLoading(false);
        return;
      }

      setSelectedDocumentUrlLoading(true);
      try {
        const response = await request<{ url: string }>(`/documents/${selectedDocument.id}/access`);
        if (!cancelled) {
          setSelectedDocumentUrl(response.url);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentUrl("");
          toast.error(error instanceof Error ? error.message : "Unable to open that document right now.");
        }
      } finally {
        if (!cancelled) {
          setSelectedDocumentUrlLoading(false);
        }
      }
    };

    void loadSecureUrl();

    return () => {
      cancelled = true;
    };
  }, [request, selectedDocument]);

  useEffect(() => {
    if (!hasProcessingDocuments) return undefined;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = await request<{ documents: DocumentRecord[] }>("/documents");
          setDocumentItems(payload.documents);
          if (selectedDocument) {
            setSelectedDocument(payload.documents.find((document) => document.id === selectedDocument.id) ?? null);
          }
        } catch {
          void refresh();
        }
      })();
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [hasProcessingDocuments, refresh, request, selectedDocument]);

  const validateFile = (file?: File | null) => {
    if (!file) return null;
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please choose a PDF, JPG, JPEG, or PNG file.");
      return null;
    }
    if (file.size > maxFileSize) {
      toast.error("File too large. Please keep documents under 20MB.");
      return null;
    }
    return file;
  };

  const chooseFile = (file?: File | null) => {
    const nextFile = validateFile(file);
    if (!nextFile) return;
    setPendingFile(nextFile);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleDragState = (event: React.DragEvent<HTMLDivElement>, active: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(active);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const uploadFile = async () => {
    if (!pendingFile) {
      toast.error("Please choose a file before uploading.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("category", category);
      formData.append("documentDate", documentDate);
      formData.append("notes", notes);
      await request("/documents/upload", {
        method: "POST",
        body: formData,
      });
      toast.success("Document uploaded. AI analysis is running in the background.");
      clearPendingFile();
      setNotes("");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const documents = useMemo(() => {
    const now = Date.now();
    return [...documentItems]
      .filter((document) => {
        const searchValue = search.toLowerCase();
        const matchesSearch =
          !searchValue ||
          document.fileName.toLowerCase().includes(searchValue) ||
          document.aiSummary.summary.toLowerCase().includes(searchValue) ||
          document.extractedText?.toLowerCase().includes(searchValue);
        const matchesCategory = categoryFilter === "all" || document.documentCategory === categoryFilter;

        if (dateRange === "30") {
          return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 30;
        }
        if (dateRange === "90") {
          return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 90;
        }
        if (dateRange === "365") {
          return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 365;
        }
        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        if (sort === "oldest") return left.uploadDate.localeCompare(right.uploadDate);
        if (sort === "alphabetical") return left.fileName.localeCompare(right.fileName);
        return right.uploadDate.localeCompare(left.uploadDate);
      });
  }, [categoryFilter, dateRange, documentItems, search, sort]);

  const getProcessingBadge = (document: DocumentRecord) => {
    if (document.processingStatus === "failed") return { tone: "danger" as const, label: "Processing failed" };
    if (document.processingStatus === "processing") return { tone: "warning" as const, label: "Analyzing..." };
    if (document.processingStatus === "queued") return { tone: "warning" as const, label: "Queued" };
    if (document.isLowConfidence) return { tone: "warning" as const, label: "Needs review" };
    return { tone: "success" as const, label: "Analyzed" };
  };

  const updateCategory = async (nextCategory: DocumentRecord["documentCategory"]) => {
    if (!selectedDocument) return;
    try {
      await request(`/documents/${selectedDocument.id}`, {
        method: "PATCH",
        body: JSON.stringify({ documentCategory: nextCategory }),
      });
      setSelectedDocument({ ...selectedDocument, documentCategory: nextCategory });
      toast.success("Category updated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const reprocessDocument = async () => {
    if (!selectedDocument) return;
    try {
      const response = await request<{ document: DocumentRecord }>(`/documents/${selectedDocument.id}/reprocess`, {
        method: "POST",
      });
      setSelectedDocument(response.document);
      toast.success("Document reprocessed.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const deleteDocument = async () => {
    if (!selectedDocument) return;
    if (!window.confirm("Delete this document from CareCircle?")) return;
    try {
      await request(`/documents/${selectedDocument.id}`, { method: "DELETE" });
      toast.success("Document deleted.");
      setSelectedDocument(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    }
  };

  const openSelectedDocument = async (download = false) => {
    if (!selectedDocument) return;

    try {
      const response = await request<{ url: string }>(
        `/documents/${selectedDocument.id}/access${download ? "?download=1" : ""}`,
      );
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open that document right now.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeader title="Upload documents" description="Drop a document here and CareCircle will explain it in plain language." />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-6 text-center transition ${
              dragActive ? "border-brand bg-brandSoft/60" : "border-brand/35 bg-brandSoft/30"
            }`}
            onClick={openFilePicker}
            onDragEnter={(event) => handleDragState(event, true)}
            onDragLeave={(event) => handleDragState(event, false)}
            onDragOver={(event) => handleDragState(event, true)}
            onDrop={handleDrop}
          >
            <UploadCloud className="h-12 w-12 text-brandDark" />
            <p className="mt-4 text-xl font-bold text-textPrimary">Drop a document here</p>
            <p className="mt-2 text-sm text-textSecondary">PDF, JPG, JPEG, or PNG up to 20MB</p>
            <div className="mt-5">
              <Button
                type="button"
                variant="secondary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openFilePicker();
                }}
              >
                Choose file
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          <div className="space-y-4">
            {pendingFile ? (
              <div className="rounded-3xl border border-borderColor bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-textPrimary">{pendingFile.name}</p>
                    <p className="mt-1 text-sm text-textSecondary">{(pendingFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <button type="button" className="text-sm font-semibold text-red-700" onClick={clearPendingFile}>
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <Field label="Category">
              <Select value={category} onChange={(event) => setCategory(event.target.value as DocumentRecord["documentCategory"])}>
                {categoryOptions.filter((item) => item.value !== "all").map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date of this document">
              <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea value={notes} placeholder="Anything helpful to remember about this file?" onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <Button onClick={() => void uploadFile()} disabled={!pendingFile || uploading}>
              {uploading ? "Uploading..." : "Upload & Analyze"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Document library" description="Search documents, filter by category, and open the AI summary in one tap." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <Input value={search} placeholder="Search documents or AI summaries..." onChange={(event) => setSearch(event.target.value)} />
          <Select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="365">This year</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">Alphabetical</option>
          </Select>
          <Select value={viewMode} onChange={(event) => setViewMode(event.target.value as "grid" | "list")}>
            <option value="grid">Grid view</option>
            <option value="list">List view</option>
          </Select>
          <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as DocumentRecord["documentCategory"] | "all")}>
            {categoryOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
        </div>

        {!documents.length ? (
          <div className="mt-5">
            <EmptyState title="No matching documents yet" description="Upload a document or loosen the filters to see your library here." />
          </div>
        ) : (
          <div className={`mt-5 ${viewMode === "grid" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}`}>
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelectedDocument(document)}
                className={`rounded-[28px] border border-borderColor bg-white p-4 text-left transition hover:border-brand ${viewMode === "list" ? "w-full" : ""}`}
              >
                <div className={`flex ${viewMode === "list" ? "items-center gap-4" : "flex-col"}`}>
                  <div className={`flex items-center justify-center rounded-3xl bg-brandSoft text-brandDark ${viewMode === "list" ? "h-20 w-20" : "h-[100px] w-full"}`}>
                    <FileSearch className="h-8 w-8" />
                  </div>
                  <div className={`${viewMode === "list" ? "min-w-0 flex-1" : "mt-4"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getProcessingBadge(document).tone}>{getProcessingBadge(document).label}</Badge>
                      {document.aiSummary.severityFlag !== "normal" ? (
                        <Badge tone={document.aiSummary.severityFlag === "urgent" ? "danger" : "warning"}>
                          {document.aiSummary.severityFlag === "urgent" ? "Urgent" : "Needs Review"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-lg font-bold text-textPrimary">{document.fileName}</p>
                    <p className="mt-1 text-sm text-textSecondary">{formatDate(document.documentDate)} | Uploaded {formatDate(document.uploadDate)}</p>
                    <p className="mt-3 line-clamp-2 text-sm text-textSecondary">
                      {document.processingStatus === "queued" || document.processingStatus === "processing"
                        ? "CareCircle is extracting text and preparing an AI summary."
                        : document.processingStatus === "failed"
                          ? (document.processingError || "CareCircle could not finish analyzing this file.")
                          : document.aiSummary.summary}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={Boolean(selectedDocument)} title={selectedDocument?.fileName ?? "Document details"} onClose={() => setSelectedDocument(null)}>
        {selectedDocument ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-[28px] border border-borderColor bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-textSecondary">Preview</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => void openSelectedDocument()}>
                    Open
                  </Button>
                  <Button variant="secondary" onClick={() => void openSelectedDocument(true)}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-borderColor bg-white p-6 text-center text-textSecondary">
                {selectedDocumentUrlLoading ? (
                  "Loading secure preview..."
                ) : selectedDocument.fileType === "image" && selectedDocumentUrl ? (
                  <img src={selectedDocumentUrl} alt={`Preview of ${selectedDocument.fileName}`} className="max-h-[380px] w-auto rounded-3xl object-contain" />
                ) : (
                  "PDF preview placeholder"
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-borderColor bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={getProcessingBadge(selectedDocument).tone}>{getProcessingBadge(selectedDocument).label}</Badge>
                  {selectedDocument.processingStatus === "ready" ? (
                    <Badge tone="neutral">AI-generated · Not a medical diagnosis · Consult your doctor</Badge>
                  ) : null}
                </div>
                {selectedDocument.processingStatus === "processing" || selectedDocument.processingStatus === "queued" ? (
                  <p className="mt-3 text-sm text-textSecondary">
                    CareCircle is still working on this file. You can keep using the app and come back in a moment.
                  </p>
                ) : selectedDocument.processingStatus === "failed" ? (
                  <p className="mt-3 text-sm text-danger">
                    {selectedDocument.processingError || "CareCircle could not finish the AI analysis for this document."}
                  </p>
                ) : null}
              </div>
              <div className="rounded-[28px] bg-brandSoft p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brandDark">Plain English summary</p>
                <p className="mt-3 text-base text-textPrimary">{selectedDocument.aiSummary.summary}</p>
              </div>
              {selectedDocument.processingStatus === "ready" && !selectedDocument.isLowConfidence ? (
                <>
                  <div className="rounded-[28px] bg-red-50 p-5">
                    <p className="font-semibold text-red-700">Action items</p>
                    <ul className="mt-2 space-y-2 text-sm text-red-700/80">
                      {selectedDocument.aiSummary.actionItems.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[28px] bg-sky-50 p-5">
                    <p className="font-semibold text-sky-800">Important dates</p>
                    <ul className="mt-2 space-y-2 text-sm text-sky-900/80">
                      {selectedDocument.aiSummary.importantDates.map((item) => (
                        <li key={`${item.date}-${item.description}`}>
                          {item.date}: {item.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[28px] border border-borderColor p-5">
                    <p className="font-semibold text-textPrimary">Medical terms explained</p>
                    <ul className="mt-2 space-y-3 text-sm text-textSecondary">
                      {selectedDocument.aiSummary.medicalTerms.map((item) => (
                        <li key={item.term}>
                          <strong className="text-textPrimary">{item.term}:</strong> {item.plainEnglish}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[28px] border border-borderColor p-5">
                    <p className="font-semibold text-textPrimary">Questions for your doctor</p>
                    <ul className="mt-2 space-y-2 text-sm text-textSecondary">
                      {selectedDocument.aiSummary.doctorQuestions.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={selectedDocument.documentCategory} onChange={(event) => void updateCategory(event.target.value as DocumentRecord["documentCategory"])}>
                    {categoryOptions.filter((item) => item.value !== "all").map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="AI tools">
                  <Button className="w-full" variant="secondary" onClick={() => void reprocessDocument()} disabled={selectedDocument.processingStatus === "queued" || selectedDocument.processingStatus === "processing"}>
                    Reprocess with AI
                  </Button>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void openSelectedDocument(true)}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button variant="ghost" onClick={() => void deleteDocument()}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
