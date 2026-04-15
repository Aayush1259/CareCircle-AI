import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSearch, Trash2, UploadCloud, Search, Calendar, Filter, Grid, List as ListIcon, FileText, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { DocumentRecord } from "@carecircle/shared";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionHeader, Select, Textarea } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";

const categoryOptions: Array<{ value: DocumentRecord["documentCategory"] | "all"; label: string }> = [
  { value: "all", label: "All Documents" },
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
    return () => { cancelled = true; };
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
        if (dateRange === "30") return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 30;
        if (dateRange === "90") return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 90;
        if (dateRange === "365") return matchesSearch && matchesCategory && now - new Date(document.uploadDate).getTime() <= 1000 * 60 * 60 * 24 * 365;
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <Card className="rounded-[2.5rem] p-10 border-none bg-white shadow-premium relative overflow-hidden">
        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <SectionHeader
              title="Upload Center"
              titleClassName="responsive-title-xl"
              description="Drop lab results, summaries, or insurance cards. CareCircle AI extracts the core facts so you don't have to."
            />

            <div
              className={`group flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed transition-all duration-500 hover:shadow-lg ${
                dragActive
                  ? "border-brand bg-brandSoft/60 scale-[1.01]"
                  : "border-brand/20 bg-slate-50/50 hover:bg-brandSoft/20 hover:border-brand/40"
              }`}
              onClick={openFilePicker}
              onDragEnter={(event) => handleDragState(event, true)}
              onDragLeave={(event) => handleDragState(event, false)}
              onDragOver={(event) => handleDragState(event, true)}
              onDrop={handleDrop}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-brand/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <UploadCloud className="relative h-20 w-20 text-brand group-hover:scale-110 transition-transform duration-500" />
              </div>
              <p className="mt-8 font-['Outfit'] text-2xl font-bold text-textPrimary">Release your document here</p>
              <p className="mt-3 text-sm text-textSecondary font-medium">Or tap to browse your local files</p>
              <div className="mt-8 flex gap-4 text-xs font-bold text-textSecondary uppercase tracking-widest bg-white/80 px-4 py-2 rounded-full border border-slate-100">
                <span>PDF</span>
                <span className="opacity-30">•</span>
                <span>JPG</span>
                <span className="opacity-30">•</span>
                <span>PNG</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>

          <div className="space-y-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100/50 self-start">
            <p className="font-['Outfit'] text-xl font-bold text-textPrimary mb-2">Processing Details</p>
            {pendingFile ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-white border border-brand/10 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-textPrimary truncate">{pendingFile.name}</p>
                    <p className="mt-1 text-sm text-textSecondary">{(pendingFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <button type="button" className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1 rounded-full transition-colors" onClick={clearPendingFile}>
                    Clear
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center text-textSecondary italic text-sm">No file selected for analysis</div>
            )}

            <Field label="Document Category">
              <Select value={category} className="h-12 rounded-xl" onChange={(event) => setCategory(event.target.value as DocumentRecord["documentCategory"])}>
                {categoryOptions.filter((item) => item.value !== "all").map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Recorded Date">
              <Input type="date" value={documentDate} className="h-12 rounded-xl" onChange={(event) => setDocumentDate(event.target.value)} />
            </Field>
            <Field label="Brief Note (Optional)">
              <Textarea value={notes} className="min-h-[100px] rounded-xl" placeholder="E.g. Dr. Miller's oncology summary..." onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <Button
              onClick={() => void uploadFile()}
              disabled={!pendingFile || uploading}
              className="w-full py-7 text-lg rounded-2xl shadow-brand/20 shadow-xl"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 animate-bounce" />
                  Uploading...
                </div>
              ) : "Start AI Extraction"}
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brandSoft/30 blur-3xl" />
      </Card>

      <Card className="rounded-[2.5rem] p-10">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-10">
          <SectionHeader
            title="Document Library"
            titleClassName="responsive-title-lg"
            description="Access your entire medical history, translated into plain English."
          />
          <div className="flex flex-wrap items-center gap-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
            <button
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-brand shadow-sm scale-110' : 'text-textSecondary hover:text-textPrimary'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-brand shadow-sm scale-110' : 'text-textSecondary hover:text-textPrimary'}`}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 mb-10">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary group-focus-within:text-brand transition-colors" />
            <Input
              value={search}
              className="pl-11 h-12 rounded-xl"
              placeholder="Search everything..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary group-focus-within:text-brand transition-colors" />
            <Select value={dateRange} className="pl-11 h-12 rounded-xl" onChange={(event) => setDateRange(event.target.value)}>
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="365">This year</option>
            </Select>
          </div>
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-textSecondary group-focus-within:text-brand transition-colors" />
            <Select value={categoryFilter} className="pl-11 h-12 rounded-xl" onChange={(event) => setCategoryFilter(event.target.value as any)}>
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!documents.length ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState title="No documents found" description="Try refining your search or filter to find what you're looking for." />
            </motion.div>
          ) : (
            <motion.div
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={viewMode === "grid" ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-4"}
            >
              {documents.map((document, idx) => (
                <motion.button
                  key={document.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelectedDocument(document)}
                  className={`group rounded-[2rem] border border-borderColor bg-white p-5 text-left transition-all duration-300 hover:border-brand hover:shadow-premium ${viewMode === "list" ? "flex items-center gap-6" : "flex flex-col"}`}
                >
                  <div className={`shrink-0 flex items-center justify-center rounded-2xl bg-brandSoft/50 text-brand shadow-inner ${viewMode === "list" ? "h-20 w-20" : "h-32 w-full mb-6"}`}>
                    <FileText className="h-10 w-10 group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge tone={getProcessingBadge(document).tone} className="px-3 py-0.5">{getProcessingBadge(document).label}</Badge>
                      {document.aiSummary.severityFlag === "urgent" && <Badge tone="danger">Urgent Action</Badge>}
                    </div>
                    <p className="font-['Outfit'] text-xl font-bold text-textPrimary truncate">{document.fileName}</p>
                    <p className="mt-1 text-xs font-bold text-textSecondary uppercase tracking-widest">{formatDate(document.documentDate)}</p>
                    <p className="mt-4 text-sm text-textSecondary line-clamp-2 leading-relaxed h-10">
                      {document.processingStatus === "ready" ? document.aiSummary.summary : "Analysis in progress..."}
                    </p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Modal open={Boolean(selectedDocument)} title={selectedDocument?.fileName ?? "Document Insight"} onClose={() => setSelectedDocument(null)} className="max-w-5xl">
        {selectedDocument && (
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] p-1">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-borderColor bg-slate-50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-['Outfit'] text-xl font-bold text-textPrimary">Document Preview</h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="rounded-xl px-5 border border-slate-200" onClick={() => void openSelectedDocument()}>Open Hub</Button>
                    <Button variant="secondary" className="rounded-xl px-5" onClick={() => void openSelectedDocument(true)}>
                      <Download className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-[500px] items-center justify-center rounded-[1.5rem] border border-dashed border-borderColor bg-white p-8 overflow-hidden shadow-inner">
                  {selectedDocumentUrlLoading ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-10 w-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium text-textSecondary">Securing your file...</p>
                    </div>
                  ) : selectedDocument.fileType === "image" && selectedDocumentUrl ? (
                    <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={selectedDocumentUrl} className="max-h-[440px] w-auto rounded-xl shadow-lg" />
                  ) : (
                    <div className="text-center space-y-4">
                      <FileSearch className="h-16 w-16 mx-auto text-slate-200" />
                      <p className="text-sm text-textSecondary font-medium">Full PDF preview is best viewed in the Open Hub</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-brand/5 border border-brand/10 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center shadow-brand/20 shadow-lg">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="font-['Outfit'] text-2xl font-bold text-textPrimary">Plain-Text Insight</h3>
                </div>
                <p className="text-lg leading-relaxed text-textPrimary font-medium">{selectedDocument.aiSummary.summary}</p>
              </div>

              {selectedDocument.processingStatus === "ready" && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-red-50/50 border border-red-100 p-6">
                    <div className="flex items-center gap-2 mb-4 text-red-800">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-bold font-['Outfit'] text-lg">Action Items</span>
                    </div>
                    <ul className="space-y-3">
                      {selectedDocument.aiSummary.actionItems.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-red-900/80 leading-relaxed font-medium">
                          <span className="text-red-300">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-sky-50/50 border border-sky-100 p-6">
                    <div className="flex items-center gap-2 mb-4 text-sky-800">
                      <Calendar className="h-5 w-5" />
                      <span className="font-bold font-['Outfit'] text-lg">Follow-up Timeline</span>
                    </div>
                    {selectedDocument.aiSummary.importantDates.map((item, i) => (
                      <div key={i} className="flex flex-col gap-1 mb-3 last:mb-0">
                        <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">{item.date}</span>
                        <span className="text-sm text-sky-900 font-medium">{item.description}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-borderColor bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-textPrimary">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <span className="font-bold font-['Outfit'] text-lg">Medical Vocabulary</span>
                    </div>
                    <div className="space-y-4">
                      {selectedDocument.aiSummary.medicalTerms.map((item, i) => (
                        <div key={i} className="text-sm group">
                          <p className="font-bold text-textPrimary group-hover:text-brand transition-colors">{item.term}</p>
                          <p className="text-textSecondary mt-1 line-clamp-2 hover:line-clamp-none transition-all">{item.plainEnglish}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <Button variant="ghost" className="flex-1 rounded-xl text-red-600 hover:bg-red-50" onClick={() => void deleteDocument()}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button variant="secondary" className="flex-1 rounded-xl" onClick={() => void reprocessDocument()}>
                  Refresh AI
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};
