"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    FileUp, Upload, X, CheckCircle2, AlertCircle, FileText,
    Trash2, Eye, EyeOff, ClipboardPaste, Globe, ShieldCheck, ShieldOff, ChevronDown
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type ProxyType = "paid" | "free";

interface ParsedProxy {
    ip: string;
    port: number;
    username?: string;
    password?: string;
    _raw: string;
    _rowIndex: number;
}

type ImportStep = "input" | "preview" | "result";

interface ImportResult {
    imported: number;
    failed: number;
    checking?: boolean;
}

interface CheckResult {
    status: string;   // live | die | timeout | auth_failed
    quality: string;  // good | bad | unknown
    latency: number | null;
    anonymity: string | null;
    country: string | null;
}

/* ── Parser — auto-detect format ──────────────────────────────────────────── */

function parseProxyLine(line: string, rowIndex: number): ParsedProxy | null {
    line = line.trim();
    if (!line || line.startsWith("#")) return null;

    try {
        // Bóc tách protocol prefix: http:// https:// socks4:// socks5://
        let cleaned = line;
        const protoMatch = cleaned.match(/^(https?|socks[45]):\/\//i);
        if (protoMatch) {
            cleaned = cleaned.substring(protoMatch[0].length);
        }

        // Format: user:pass@ip:port
        if (cleaned.includes("@")) {
            const atIdx = cleaned.lastIndexOf("@");
            const auth = cleaned.substring(0, atIdx);
            const host = cleaned.substring(atIdx + 1);
            const [username, password] = auth.split(":", 2);
            const lastColon = host.lastIndexOf(":");
            const ip = host.substring(0, lastColon);
            const port = parseInt(host.substring(lastColon + 1));
            if (!ip || isNaN(port)) return null;
            return { ip, port, username: username.trim(), password: password?.trim(), _raw: line, _rowIndex: rowIndex };
        }

        const parts = cleaned.split(":");

        // Format: ip:port:user:pass
        if (parts.length === 4) {
            const [ip, portStr, username, password] = parts;
            const port = parseInt(portStr);
            if (isNaN(port)) return null;
            return { ip: ip.trim(), port, username: username.trim(), password: password.trim(), _raw: line, _rowIndex: rowIndex };
        }

        // Format: ip:port (free)
        if (parts.length === 2) {
            const [ip, portStr] = parts;
            const port = parseInt(portStr);
            if (isNaN(port)) return null;
            return { ip: ip.trim(), port, _raw: line, _rowIndex: rowIndex };
        }

        // Fallback: try to extract IP:PORT with regex from any format
        const ipPortMatch = cleaned.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/);
        if (ipPortMatch) {
            const ip = ipPortMatch[1];
            const port = parseInt(ipPortMatch[2]);
            if (!isNaN(port) && port > 0 && port <= 65535) {
                return { ip, port, _raw: line, _rowIndex: rowIndex };
            }
        }

        return null;
    } catch {
        return null;
    }
}

function parseProxyText(text: string): ParsedProxy[] {
    // Handle all line ending formats: \r\n (Windows), \n (Unix), \r (Classic Mac)
    // Also strip BOM if present
    const cleaned = text.replace(/^\uFEFF/, "");
    return cleaned.split(/\r\n|\n|\r/)
        .map((line, i) => parseProxyLine(line, i + 1))
        .filter((p): p is ParsedProxy => p !== null);
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function ProfilesPage() {
    const qc = useQueryClient();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [step, setStep] = useState<ImportStep>("input");
    const [proxyType, setProxyType] = useState<ProxyType>("paid");
    const [protocol, setProtocol] = useState("http");
    const [providerName, setProviderName] = useState("");
    const [cost, setCost] = useState("");
    const [rawText, setRawText] = useState("");
    const [fileName, setFileName] = useState("");
    const [parsedProxies, setParsedProxies] = useState<ParsedProxy[]>([]);
    const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
    const [showAuth, setShowAuth] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    // Check state
    const [checkResults, setCheckResults] = useState<Record<number, CheckResult>>({});
    const [isChecking, setIsChecking] = useState(false);
    const [checkProgress, setCheckProgress] = useState({ done: 0, total: 0 });

    /* ── Check proxies ─────────────────────────────────────────────────────── */

    const runChecks = useCallback(async (proxies: ParsedProxy[]) => {
        setIsChecking(true);
        setCheckResults({});
        setCheckProgress({ done: 0, total: proxies.length });

        const BATCH = 50; // gửi 50 proxy mỗi request batch
        for (let i = 0; i < proxies.length; i += BATCH) {
            const batch = proxies.slice(i, i + BATCH);
            const batchPayload = batch.map(p => ({
                proxy_url: `http://${p.ip}:${p.port}`,
                username: p.username || undefined,
                password: p.password || undefined,
            }));

            try {
                const { data } = await api.post("/api/proxies/check-batch", { proxies: batchPayload }, { timeout: 120000 });
                const results = (data as { results: CheckResult[] }).results;
                results.forEach((result, batchIdx) => {
                    const idx = i + batchIdx;
                    setCheckResults(prev => ({ ...prev, [idx]: result }));
                });
            } catch {
                // Fallback: mark all in batch as die
                batch.forEach((_, batchIdx) => {
                    const idx = i + batchIdx;
                    setCheckResults(prev => ({ ...prev, [idx]: { status: "die", quality: "bad", latency: null, anonymity: null, country: null } }));
                });
            }
            setCheckProgress(prev => ({ ...prev, done: Math.min(prev.done + batch.length, proxies.length) }));
        }

        setIsChecking(false);
        toast.success("Kiểm tra hoàn tất!");
    }, []);

    /* ── Handlers ──────────────────────────────────────────────────────────── */

    const doParse = useCallback((text: string, source?: string) => {
        const proxies = parseProxyText(text);
        if (proxies.length === 0) {
            toast.error("Không tìm thấy proxy hợp lệ. Kiểm tra lại định dạng.");
            return;
        }

        // Auto-detect type
        const hasAuth = proxies.some(p => p.username && p.password);
        setProxyType(hasAuth ? "paid" : "free");

        setParsedProxies(proxies);
        setRemovedRows(new Set());
        setCheckResults({});
        if (source) setFileName(source);
        setStep("preview");
        toast.success(`Tìm thấy ${proxies.length} proxy — bắt đầu kiểm tra...`);

        // Auto-check ngay
        runChecks(proxies);
    }, [runChecks]);

    const handlePaste = () => {
        if (!rawText.trim()) {
            toast.error("Vui lòng dán danh sách proxy");
            return;
        }
        doParse(rawText, "Pasted text");
    };

    const handleFile = useCallback((file: File) => {
        const validExts = [".csv", ".txt", ".tsv"];
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!validExts.includes(ext)) {
            toast.error("File không hỗ trợ. Dùng CSV, TXT hoặc TSV");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File quá lớn. Tối đa 5MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setRawText(content);
            doParse(content, file.name);
        };
        reader.readAsText(file);
    }, [doParse]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    // Auto-fill textarea on paste from clipboard
    const handleTextareaPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // Let it paste naturally into the textarea
        const pastedText = e.clipboardData.getData("text");
        if (pastedText) {
            // The text will be set by the onChange anyway, so we auto-parse after a tick
            setTimeout(() => {
                const textarea = e.target as HTMLTextAreaElement;
                const text = textarea.value;
                if (text.trim()) {
                    doParse(text, "Pasted text");
                }
            }, 50);
        }
    }, [doParse]);

    /* ── Import mutation ───────────────────────────────────────────────────── */

    const doImport = async (filter?: "live" | "dead") => {
        let proxiesToImport = parsedProxies.filter((_, i) => !removedRows.has(i));
        if (filter === "live") {
            proxiesToImport = proxiesToImport.filter((_, i) => checkResults[parsedProxies.indexOf(proxiesToImport[i] ?? proxiesToImport[0])]?.status === "live");
        } else if (filter === "dead") {
            proxiesToImport = proxiesToImport.filter((_, i) => {
                const idx = parsedProxies.indexOf(proxiesToImport[i] ?? proxiesToImport[0]);
                const cr = checkResults[idx];
                return cr && cr.status !== "live";
            });
        }
        // Re-filter using original index for correctness
        if (filter === "live") {
            proxiesToImport = parsedProxies.filter((_, i) => !removedRows.has(i) && checkResults[i]?.status === "live");
        } else if (filter === "dead") {
            proxiesToImport = parsedProxies.filter((_, i) => !removedRows.has(i) && checkResults[i] && checkResults[i].status !== "live");
        }
        const textLines = proxiesToImport.map(p => p._raw).join("\n");
        const { data } = await api.post("/api/proxies/import", {
            text: textLines,
            protocol,
            provider_name: providerName || undefined,
            cost: cost ? parseFloat(cost) : undefined,
        });
        return data as ImportResult;
    };

    const importMutation = useMutation({
        mutationFn: () => doImport(),
        onSuccess: (result) => {
            setImportResult(result);
            setStep("result");
            qc.invalidateQueries({ queryKey: ["proxies"] });
            if (result.failed === 0) {
                toast.success(`Import thành công ${result.imported} proxy!`);
            } else {
                toast.warning(`${result.imported} thành công, ${result.failed} thất bại`);
            }
        },
        onError: () => toast.error("Import thất bại"),
    });

    const importLiveMutation = useMutation({
        mutationFn: () => doImport("live"),
        onSuccess: (result) => {
            setImportResult(result);
            setStep("result");
            qc.invalidateQueries({ queryKey: ["proxies"] });
            toast.success(`Import ${result.imported} proxy sống!`);
        },
        onError: () => toast.error("Import thất bại"),
    });

    const importDeadMutation = useMutation({
        mutationFn: () => doImport("dead"),
        onSuccess: (result) => {
            setImportResult(result);
            setStep("result");
            qc.invalidateQueries({ queryKey: ["proxies"] });
            toast.success(`Import ${result.imported} proxy chết!`);
        },
        onError: () => toast.error("Import thất bại"),
    });

    const activeProxies = parsedProxies.filter((_, i) => !removedRows.has(i));

    const reset = () => {
        setStep("input");
        setRawText("");
        setFileName("");
        setParsedProxies([]);
        setRemovedRows(new Set());
        setImportResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /* ── Render ────────────────────────────────────────────────────────────── */

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Profiles</h1>
                <p className="text-slate-400 text-sm mt-0.5">Import proxy profiles — Dán hoặc upload danh sách proxy</p>
            </div>

            {/* ════════════════ STEP: INPUT ════════════════ */}
            {step === "input" && (
                <div className="space-y-4">
                    {/* Proxy type + settings */}
                    <div className="rounded-xl border border-white/5 bg-[#0d1426] p-5">
                        <h3 className="text-sm font-medium text-slate-200 mb-4">Cài đặt import</h3>

                        {/* Type selector */}
                        <div className="flex gap-3 mb-4">
                            <button
                                onClick={() => setProxyType("paid")}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${proxyType === "paid"
                                    ? "border-violet-500/50 bg-violet-500/10"
                                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${proxyType === "paid" ? "bg-violet-500/20" : "bg-white/5"
                                    }`}>
                                    <ShieldCheck className={`w-5 h-5 ${proxyType === "paid" ? "text-violet-400" : "text-slate-500"}`} />
                                </div>
                                <div className="text-left">
                                    <p className={`text-sm font-medium ${proxyType === "paid" ? "text-violet-300" : "text-slate-300"}`}>
                                        Proxy Mua
                                    </p>
                                    <p className="text-xs text-slate-500">Có user:pass (HTTP Auth)</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setProxyType("free")}
                                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${proxyType === "free"
                                    ? "border-emerald-500/50 bg-emerald-500/10"
                                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${proxyType === "free" ? "bg-emerald-500/20" : "bg-white/5"
                                    }`}>
                                    <ShieldOff className={`w-5 h-5 ${proxyType === "free" ? "text-emerald-400" : "text-slate-500"}`} />
                                </div>
                                <div className="text-left">
                                    <p className={`text-sm font-medium ${proxyType === "free" ? "text-emerald-300" : "text-slate-300"}`}>
                                        Proxy Free
                                    </p>
                                    <p className="text-xs text-slate-500">Không có user:pass</p>
                                </div>
                            </button>
                        </div>

                        {/* Advanced settings toggle */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
                            Tùy chọn nâng cao (Protocol, Provider, Cost)
                        </button>

                        {showAdvanced && (
                            <div className="grid grid-cols-3 gap-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div>
                                    <Label className="text-xs text-slate-300 mb-1.5 block">Protocol</Label>
                                    <Select value={protocol} onValueChange={setProtocol}>
                                        <SelectTrigger className="bg-white/5 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#0d1426] border-white/10">
                                            <SelectItem value="http">HTTP</SelectItem>
                                            <SelectItem value="https">HTTPS</SelectItem>
                                            <SelectItem value="socks5">SOCKS5</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-300 mb-1.5 block">Provider</Label>
                                    <Input className="bg-white/5 border-white/10" placeholder="Tinsoft, TMProxy..."
                                        value={providerName} onChange={e => setProviderName(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-300 mb-1.5 block">Cost (đ/tháng)</Label>
                                    <Input className="bg-white/5 border-white/10" type="number" placeholder="50000"
                                        value={cost} onChange={e => setCost(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Paste area */}
                    <div className="rounded-xl border border-white/5 bg-[#0d1426] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <ClipboardPaste className="w-4 h-4 text-violet-400" />
                            <h3 className="text-sm font-medium text-slate-200">Dán danh sách proxy</h3>
                        </div>
                        <textarea
                            className="w-full h-44 bg-black/30 border border-white/10 rounded-lg p-3 text-sm font-mono text-slate-200 resize-none
                                       focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-slate-600"
                            placeholder={proxyType === "paid"
                                ? "1.2.3.4:8080:user:pass\nuser:pass@5.6.7.8:3128\n..."
                                : "1.2.3.4:8080\n5.6.7.8:3128\n..."
                            }
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            onPaste={handleTextareaPaste}
                        />
                        <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-slate-600">
                                {rawText.trim() ? `${rawText.trim().split("\n").filter(Boolean).length} dòng` : "Dán proxy vào đây — tự động parse khi paste"}
                            </p>
                            <Button onClick={handlePaste} size="sm" className="bg-violet-600 hover:bg-violet-700"
                                disabled={!rawText.trim()}>
                                <Upload className="w-3.5 h-3.5 mr-1.5" /> Parse & Preview
                            </Button>
                        </div>
                    </div>

                    {/* OR divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-xs text-slate-600 font-medium">HOẶC</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* File drop zone */}
                    <div
                        className={`relative rounded-xl border-2 border-dashed transition-all duration-300 ${isDragging
                            ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
                            : "border-white/10 bg-[#0d1426] hover:border-white/20"
                            }`}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <div className="flex flex-col items-center justify-center py-10 px-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all ${isDragging ? "bg-violet-500/20" : "bg-white/5"
                                }`}>
                                <FileUp className={`w-6 h-6 ${isDragging ? "text-violet-300" : "text-slate-500"}`} />
                            </div>
                            <p className="text-sm text-slate-300 mb-1">
                                {isDragging ? "Thả file tại đây" : "Kéo thả file proxy vào đây"}
                            </p>
                            <p className="text-xs text-slate-600 mb-3">CSV, TXT, TSV — Tối đa 5MB</p>
                            <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => fileInputRef.current?.click()}>
                                <FileText className="w-3.5 h-3.5 mr-1.5" /> Chọn file
                            </Button>
                            <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                        </div>
                    </div>

                    {/* Format guide */}
                    <div className="rounded-xl border border-white/5 bg-[#0d1426] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Globe className="w-4 h-4 text-violet-400" />
                            <h3 className="text-sm font-medium text-slate-200">Định dạng hỗ trợ</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <p className="text-violet-300 font-medium">Free (không auth)</p>
                                <div className="bg-black/30 rounded-lg p-2.5 font-mono text-slate-400 leading-relaxed">
                                    1.2.3.4:8080<br />
                                    5.6.7.8:3128<br />
                                    9.10.11.12:80
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-violet-300 font-medium">Mua (ip:port:user:pass)</p>
                                <div className="bg-black/30 rounded-lg p-2.5 font-mono text-slate-400 leading-relaxed">
                                    1.2.3.4:8080:user1:pass1<br />
                                    5.6.7.8:3128:user2:pass2<br />
                                    9.10.11.12:80:user3:pass3
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-violet-300 font-medium">Mua (user:pass@ip:port)</p>
                                <div className="bg-black/30 rounded-lg p-2.5 font-mono text-slate-400 leading-relaxed">
                                    user1:pass1@1.2.3.4:8080<br />
                                    user2:pass2@5.6.7.8:3128<br />
                                    user3:pass3@9.10.11.12:80
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ STEP: PREVIEW ════════════════ */}
            {step === "preview" && (
                <div className="space-y-4">
                    {/* Summary card — total / alive / dead */}
                    {(() => {
                        const totalChecked = Object.keys(checkResults).length;
                        const liveCount = Object.values(checkResults).filter(r => r.status === "live").length;
                        const deadCount = totalChecked - liveCount;
                        const progressPct = parsedProxies.length > 0
                            ? Math.round((checkProgress.done / parsedProxies.length) * 100)
                            : 0;

                        return (
                            <div className="rounded-xl border border-white/5 bg-[#0d1426] p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium text-slate-200">
                                        {isChecking ? "Đang kiểm tra proxy..." : "Kết quả kiểm tra"}
                                    </h3>
                                    {isChecking && (
                                        <span className="text-xs text-violet-400">
                                            {checkProgress.done}/{checkProgress.total} ({progressPct}%)
                                        </span>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {isChecking && (
                                    <div className="w-full h-2 bg-white/5 rounded-full mb-4 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                )}

                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                        <p className="text-3xl font-bold text-slate-100">{parsedProxies.length}</p>
                                        <p className="text-xs text-slate-500 mt-1">Tổng cộng</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                                        <p className="text-3xl font-bold text-emerald-400">{liveCount}</p>
                                        <p className="text-xs text-emerald-400/70 mt-1">Proxy sống</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-red-500/[0.06] border border-red-500/20">
                                        <p className="text-3xl font-bold text-red-400">{deadCount}</p>
                                        <p className="text-xs text-red-400/70 mt-1">Proxy chết</p>
                                    </div>
                                </div>

                                {!isChecking && totalChecked > 0 && (
                                    <p className="text-xs text-slate-500 mt-3 text-center">
                                        Tỷ lệ sống: {parsedProxies.length > 0 ? Math.round((liveCount / parsedProxies.length) * 100) : 0}%
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    {/* Info bar */}
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0d1426] px-5 py-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${proxyType === "paid" ? "bg-violet-500/15" : "bg-emerald-500/15"
                                }`}>
                                {proxyType === "paid"
                                    ? <ShieldCheck className="w-4 h-4 text-violet-400" />
                                    : <ShieldOff className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-200">
                                    {fileName || "Proxy list"} — <span className={proxyType === "paid" ? "text-violet-400" : "text-emerald-400"}>
                                        {proxyType === "paid" ? "Proxy Mua" : "Proxy Free"}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500">
                                    {activeProxies.length} proxy · {protocol.toUpperCase()}
                                    {providerName && ` · ${providerName}`}
                                    {cost && ` · ${parseFloat(cost).toLocaleString()}đ`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {proxyType === "paid" && (
                                <Button variant="ghost" size="sm" onClick={() => setShowAuth(!showAuth)}
                                    className="text-slate-400 hover:text-slate-200 text-xs">
                                    {showAuth ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                                    {showAuth ? "Ẩn" : "Hiện"} Auth
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={reset}
                                className="text-slate-400 hover:text-red-400 text-xs">
                                <X className="w-3.5 h-3.5 mr-1" /> Hủy
                            </Button>
                        </div>
                    </div>

                    {/* Preview table */}
                    <div className="rounded-xl border border-white/5 bg-[#0d1426] overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-[#0d1426] z-10">
                                    <tr className="border-b border-white/5">
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5 w-10">#</th>
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">IP</th>
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Port</th>
                                        {proxyType === "paid" && (
                                            <>
                                                <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Username</th>
                                                <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Password</th>
                                            </>
                                        )}
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Status</th>
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Quality</th>
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Latency</th>
                                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Country</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedProxies.map((proxy, idx) => {
                                        const isRemoved = removedRows.has(idx);
                                        const cr = checkResults[idx];
                                        const checking = !cr && isChecking;
                                        return (
                                            <tr key={idx} className={`border-b border-white/[0.03] transition-all duration-200 ${isRemoved ? "opacity-30 bg-red-500/5" : "hover:bg-white/[0.02]"
                                                }`}>
                                                <td className="px-4 py-2 text-xs text-slate-600">{proxy._rowIndex}</td>
                                                <td className="px-4 py-2 text-slate-200 font-mono text-xs">{proxy.ip}</td>
                                                <td className="px-4 py-2 text-slate-300 font-mono text-xs">{proxy.port}</td>
                                                {proxyType === "paid" && (
                                                    <>
                                                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                                                            {showAuth ? (proxy.username || "—") : (proxy.username ? "••••" : "—")}
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                                                            {showAuth ? (proxy.password || "—") : (proxy.password ? "••••••" : "—")}
                                                        </td>
                                                    </>
                                                )}
                                                {/* Status */}
                                                <td className="px-4 py-2">
                                                    {checking ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                                                            <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                                        </span>
                                                    ) : cr ? (
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${{
                                                            live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                                                            die: "bg-red-500/15 text-red-400 border-red-500/30",
                                                            timeout: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                                                            auth_failed: "bg-orange-500/15 text-orange-400 border-orange-500/30",
                                                        }[cr.status] || "bg-slate-700 text-slate-400 border-slate-600"}`}>
                                                            {cr.status === "live" && <span className="mr-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                                            {cr.status.toUpperCase()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-600">—</span>
                                                    )}
                                                </td>
                                                {/* Quality */}
                                                <td className="px-4 py-2">
                                                    {cr ? (
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${{
                                                            good: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                                                            bad: "bg-red-500/15 text-red-400 border-red-500/30",
                                                            unknown: "bg-slate-700 text-slate-500 border-slate-600",
                                                        }[cr.quality] || "bg-slate-700 text-slate-500 border-slate-600"}`}>
                                                            {cr.quality === "good" ? "Good" : cr.quality === "bad" ? "Bad" : "—"}
                                                        </span>
                                                    ) : checking ? (
                                                        <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                                    ) : <span className="text-xs text-slate-600">—</span>}
                                                </td>
                                                {/* Latency */}
                                                <td className="px-4 py-2 text-xs">
                                                    {cr?.latency != null ? (
                                                        <span className={cr.latency < 500 ? "text-emerald-400" : cr.latency < 2000 ? "text-amber-400" : "text-red-400"}>
                                                            {cr.latency}ms
                                                        </span>
                                                    ) : checking ? (
                                                        <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                                    ) : <span className="text-slate-600">—</span>}
                                                </td>
                                                {/* Country */}
                                                <td className="px-4 py-2 text-xs text-slate-400">
                                                    {cr?.country || (checking ? "" : "—")}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <button
                                                        onClick={() => {
                                                            setRemovedRows(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(idx)) next.delete(idx); else next.add(idx);
                                                                return next;
                                                            });
                                                        }}
                                                        className={`p-1 rounded transition-colors ${isRemoved ? "text-emerald-400 hover:text-emerald-300" : "text-slate-600 hover:text-red-400"
                                                            }`}
                                                        title={isRemoved ? "Khôi phục" : "Loại bỏ"}
                                                    >
                                                        {isRemoved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Import buttons */}
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            {removedRows.size > 0 && <span className="text-amber-400">{removedRows.size} đã loại · </span>}
                            {activeProxies.length} proxy sẽ được import
                        </p>
                        <div className="flex items-center gap-2">
                            {/* Import chỉ proxy sống */}
                            {(() => {
                                const liveCount = parsedProxies.filter((_, i) => !removedRows.has(i) && checkResults[i]?.status === "live").length;
                                return (
                                    <Button
                                        onClick={() => importLiveMutation.mutate()}
                                        disabled={importLiveMutation.isPending || liveCount === 0 || isChecking}
                                        className="bg-emerald-600 hover:bg-emerald-700 transition-all"
                                        size="sm"
                                    >
                                        {importLiveMutation.isPending ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                                                Đang import...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                Import {liveCount} Sống
                                            </>
                                        )}
                                    </Button>
                                );
                            })()}

                            {/* Import chỉ proxy chết */}
                            {(() => {
                                const deadCount = parsedProxies.filter((_, i) => !removedRows.has(i) && checkResults[i] && checkResults[i].status !== "live").length;
                                return (
                                    <Button
                                        onClick={() => importDeadMutation.mutate()}
                                        disabled={importDeadMutation.isPending || deadCount === 0 || isChecking}
                                        variant="outline"
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                                        size="sm"
                                    >
                                        {importDeadMutation.isPending ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin mr-1.5" />
                                                Đang import...
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                                Import {deadCount} Chết
                                            </>
                                        )}
                                    </Button>
                                );
                            })()}

                            {/* Import tất cả */}
                            <Button
                                onClick={() => importMutation.mutate()}
                                disabled={importMutation.isPending || activeProxies.length === 0}
                                className="bg-violet-600 hover:bg-violet-700 transition-all"
                            >
                                {importMutation.isPending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Đang import...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-1.5" />
                                        Import {activeProxies.length} Proxy
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ STEP: RESULT ════════════════ */}
            {step === "result" && importResult && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/5 bg-[#0d1426] p-8">
                        <div className="flex flex-col items-center text-center">
                            {importResult.failed === 0 ? (
                                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
                                    <AlertCircle className="w-8 h-8 text-amber-400" />
                                </div>
                            )}
                            <h2 className="text-xl font-bold text-white mb-1">Import hoàn tất</h2>
                            <p className="text-slate-400 text-sm mb-2">
                                {importResult.failed === 0
                                    ? `Tất cả ${importResult.imported} proxy đã được import thành công!`
                                    : `${importResult.imported} thành công, ${importResult.failed} thất bại`}
                            </p>
                            {importResult.checking && (
                                <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                    <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-xs text-violet-300">
                                        Đang tự động kiểm tra {importResult.imported} proxy... Xem kết quả tại trang Proxies
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center gap-6 mb-6">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-400">{importResult.imported}</p>
                                    <p className="text-xs text-slate-500">Thành công</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
                                    <p className="text-xs text-slate-500">Thất bại</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button onClick={() => router.push("/proxies")} className="bg-violet-600 hover:bg-violet-700">
                                    <Globe className="w-4 h-4 mr-1.5" /> Xem kết quả kiểm tra
                                </Button>
                                <Button onClick={reset} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
                                    <FileUp className="w-4 h-4 mr-1.5" /> Import thêm
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
