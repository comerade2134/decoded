"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  type Transition,
  type Variants,
} from "framer-motion";
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  RotateCcw,
  MessageSquare,
  Image as ImageIcon,
  Flame,
  BrainCircuit,
  Eye,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  X,
  FileImage,
  UserPlus,
  Users,
  Mic,
  Sliders,
  History,
  Trash2,
  Tag,
  Info,
  CheckCircle2,
  Ban,
} from "lucide-react";
import {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisRecord,
  ContactDossier,
  DynamicStatus,
  EnergyLevel,
  RelationshipContext,
  SamplePreset,
  Trajectory,
  UserVoiceProfile,
} from "@/lib/types";

const CONTEXT_OPTIONS: RelationshipContext[] = [
  "Talking Stage",
  "First Date",
  "Post-Date",
  "Situationship",
  "Ex / Re-connect",
  "Dry Spell / Ghosting",
];

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: "cold-delay",
    title: "12h Delay 'haha yeah'",
    context: "Talking Stage",
    messages: "Them [11:42 PM]: haha yeah totally\n[12 hours after I asked about her favorite travel spots]",
  },
  {
    id: "late-wyd",
    title: "Late Night 'wyd'",
    context: "Situationship",
    messages: "Them [11:48 PM]: wyd tonight? are u still out",
  },
  {
    id: "vague-reschedule",
    title: "Vague Raincheck",
    context: "First Date",
    messages: "Them: Hey something just came up for tonight, can we do another time? Super busy this week sorry!!",
  },
  {
    id: "ex-reconnect",
    title: "Ex 'Thinking of u'",
    context: "Ex / Re-connect",
    messages: "Them: Just drove past that Italian place we used to go to and thought of you. Hope you're doing well :)",
  },
];

const SCANNER_PHRASES = [
  "Calibrating to your personal voiceprint...",
  "Parsing message latency & cadence...",
  "Evaluating frame & power dynamics...",
  "Calculating Reciprocity & Dignity index...",
  "Simulating internal monologue...",
  "Synthesizing Safe, Bold & Walk-Away plays...",
];

const DEFAULT_VOICE_PROFILE: UserVoiceProfile = {
  styleToggles: {
    allLowercase: true,
    dryHumor: true,
    fastAndPunchy: false,
    zeroEmoji: true,
  },
  customSampleTexts: "yeah sounds good, catch you later, haha not a chance",
};

const DEFAULT_CONTACTS: ContactDossier[] = [
  {
    id: "quick-scan",
    name: "Quick Scan",
    tag: "Incognito",
    context: "Talking Stage",
    createdAt: Date.now(),
    history: [],
  },
  {
    id: "sarah-hinge",
    name: "Sarah",
    tag: "Hinge",
    context: "Talking Stage",
    createdAt: Date.now() - 86400000 * 2,
    history: [],
  },
];

// Apple & Emil Kowalski spring configurations
const springTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
};

const resultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const resultItemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 360,
      damping: 26,
    },
  },
};

// Calculate Trajectory based on history + current
function calculateTrajectory(history: AnalysisRecord[], currentStatus?: DynamicStatus): Trajectory {
  const allStatuses = [...history.map((h) => h.response.status), ...(currentStatus ? [currentStatus] : [])];
  if (allStatuses.length === 0) return "Stable / Plateau";

  const latest = allStatuses[allStatuses.length - 1];
  if (latest === "Leading") return "Accelerating Interest";
  if (latest === "Fading" || latest === "Chasing") return "Decelerating / Frame Loss";
  return "Stable / Plateau";
}

export default function DecodedApp() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"text" | "ocr">("text");
  const [messages, setMessages] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<RelationshipContext>("Talking Stage");
  const [loading, setLoading] = useState<boolean>(false);
  const [scanStepIndex, setScanStepIndex] = useState<number>(0);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Contacts Dossier State
  const [contacts, setContacts] = useState<ContactDossier[]>(DEFAULT_CONTACTS);
  const [activeContactId, setActiveContactId] = useState<string>("quick-scan");
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>("");
  const [newContactTag, setNewContactTag] = useState<string>("Hinge");
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);

  // Voice Calibration State
  const [voiceProfile, setVoiceProfile] = useState<UserVoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);

  // OCR Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isExtractingOcr, setIsExtractingOcr] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expandable reasoning accordion state
  const [safeExpanded, setSafeExpanded] = useState<boolean>(true);
  const [boldExpanded, setBoldExpanded] = useState<boolean>(true);
  const [walkAwayExpanded, setWalkAwayExpanded] = useState<boolean>(true);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Hydration safety & LocalStorage loading
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedContacts = localStorage.getItem("decoded_contacts");
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }
      const savedVoice = localStorage.getItem("decoded_voice_profile");
      if (savedVoice) {
        setVoiceProfile(JSON.parse(savedVoice));
      }
    } catch (e) {
      console.error("Failed to load local state:", e);
    }
  }, []);

  // Save contacts to localStorage
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem("decoded_contacts", JSON.stringify(contacts));
      } catch (e) {
        console.error(e);
      }
    }
  }, [contacts, isMounted]);

  // Save voice profile to localStorage
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem("decoded_voice_profile", JSON.stringify(voiceProfile));
      } catch (e) {
        console.error(e);
      }
    }
  }, [voiceProfile, isMounted]);

  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0];
  const activeTrajectory = calculateTrajectory(activeContact?.history || [], analysis?.status);

  // Sync context when switching contact
  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    const target = contacts.find((c) => c.id === contactId);
    if (target) {
      setSelectedContext(target.context);
      // If contact has previous scan, load latest result
      if (target.history.length > 0) {
        const latest = target.history[target.history.length - 1];
        setAnalysis(latest.response);
        setMessages(latest.messages);
      } else {
        setAnalysis(null);
        setMessages("");
      }
    }
  };

  // Create New Contact Dossier
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;

    const newContact: ContactDossier = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      tag: newContactTag.trim() || "Dating",
      context: selectedContext,
      createdAt: Date.now(),
      history: [],
    };

    setContacts((prev) => [...prev, newContact]);
    setActiveContactId(newContact.id);
    setNewContactName("");
    setIsNewContactModalOpen(false);
    setAnalysis(null);
    setMessages("");
  };

  const handleDeleteContact = (contactId: string) => {
    if (contactId === "quick-scan") return; // Prevent deleting default
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    if (activeContactId === contactId) {
      setActiveContactId("quick-scan");
    }
  };

  // Auto-expand textarea dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        280
      )}px`;
    }
  }, [messages]);

  // Loading phrase cycler
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setScanStepIndex(0);
      interval = setInterval(() => {
        setScanStepIndex((prev) => (prev + 1) % SCANNER_PHRASES.length);
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Handle Image Selection
  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);
      setImageFileName(file.name);
      setIsExtractingOcr(true);
      setError(null);

      // OCR Extraction simulation & text mapping
      setTimeout(() => {
        setIsExtractingOcr(false);
        setMessages(
          `Them [Screenshot: ${file.name}]: "Hey! Just saw your message, super crazy day at work today haha"`
        );
        setActiveTab("text");
      }, 1200);
    };
    reader.readAsDataURL(file);
  }, []);

  // Global Clipboard Paste Listener (Ctrl+V / Cmd+V screenshot support)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processImageFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!messages.trim()) {
      setError("Please paste a text snippet or select a scenario preset to analyze.");
      return;
    }

    setError(null);
    setLoading(true);
    setAnalysis(null);

    try {
      const payload: AnalysisRequest = {
        messages: messages.trim(),
        relationshipContext: selectedContext,
        userVoiceProfile: voiceProfile,
        contactHistoryCount: activeContact?.history.length || 0,
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to decode conversation dynamics.");
      }

      const data = (await res.json()) as AnalysisResponse;
      setAnalysis(data);

      // Save to active contact dossier history
      const newRecord: AnalysisRecord = {
        id: `rec-${Date.now()}`,
        timestamp: Date.now(),
        messages: messages.trim(),
        relationshipContext: selectedContext,
        response: data,
      };

      setContacts((prev) =>
        prev.map((c) => {
          if (c.id === activeContactId) {
            return {
              ...c,
              context: selectedContext,
              history: [...c.history, newRecord],
            };
          }
          return c;
        })
      );

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handlePresetSelect = (preset: SamplePreset) => {
    setMessages(preset.messages);
    setSelectedContext(preset.context);
    setError(null);
  };

  const handleReset = () => {
    setMessages("");
    setUploadedImage(null);
    setImageFileName(null);
    setAnalysis(null);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: DynamicStatus) => {
    switch (status) {
      case "Leading":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: TrendingUp,
          label: "You Hold Frame",
        };
      case "Chasing":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: Zap,
          label: "You Are Chasing",
        };
      case "Testing Frame":
        return {
          bg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
          icon: BrainCircuit,
          label: "Testing Frame",
        };
      case "Fading":
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: ShieldAlert,
          label: "Interest Fading",
        };
      case "Balanced":
      default:
        return {
          bg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
          icon: Sparkles,
          label: "Balanced Frame",
        };
    }
  };

  const getEnergyBadge = (energy: EnergyLevel) => {
    switch (energy) {
      case "High":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
      case "Balanced":
        return "bg-blue-500/15 text-blue-300 border-blue-500/40";
      case "Low":
        return "bg-amber-500/15 text-amber-300 border-amber-500/40";
      case "Fading":
        return "bg-rose-500/15 text-rose-300 border-rose-500/40";
    }
  };

  const getTrajectoryBadge = (traj: Trajectory) => {
    switch (traj) {
      case "Accelerating Interest":
        return {
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
          icon: TrendingUp,
        };
      case "Decelerating / Frame Loss":
        return {
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
          icon: TrendingDown,
        };
      case "Stable / Plateau":
      default:
        return {
          color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
          icon: Minus,
        };
    }
  };

  if (!isMounted) {
    return (
      <main className="w-full max-w-2xl lg:max-w-3xl mx-auto min-h-screen px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const TrajectoryIcon = getTrajectoryBadge(activeTrajectory).icon;

  return (
    <main className="w-full max-w-2xl lg:max-w-3xl mx-auto min-h-screen px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 ios-safe-top ios-safe-bottom relative">
      {/* Ambient Lighting Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-500/15 via-indigo-500/10 to-transparent blur-[110px] rounded-full"
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/[0.08] pb-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 4 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-2xl frosted-glass-subtle flex items-center justify-center border-white/[0.12] text-blue-400 shadow-md shadow-blue-500/10"
          >
            <BrainCircuit className="w-6 h-6" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight font-mono text-zinc-100 uppercase">
                Decoded
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-950/70 text-blue-400 border border-blue-800/40">
                OS 3.0
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-normal">
              Dating Intelligence & Behavioral Subtext OS
            </p>
          </div>
        </div>

        {/* Global OS Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Voice Calibration Trigger */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-blue-300 frosted-glass-subtle border-blue-500/30 hover:border-blue-400/50 transition-colors shadow-sm"
            title="Calibrate your authentic texting voiceprint"
          >
            <Mic className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Voiceprint</span>
          </motion.button>

          {analysis && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-zinc-100 frosted-glass-subtle border-white/[0.1] hover:border-white/[0.2] transition-colors shadow-sm"
              title="Reset and analyze another message"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* 📁 CONTACT DOSSIER SWITCHER BAR */}
      <section className="flex flex-col gap-2 relative z-10">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            Active Contact Dossier
          </span>
          <div className="flex items-center gap-2">
            {activeContact.history.length > 0 && (
              <button
                onClick={() => setIsHistoryDrawerOpen(true)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1"
              >
                <History className="w-3 h-3" />
                <span>{activeContact.history.length} Scans</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 whitespace-nowrap">
          {contacts.map((contact) => {
            const isActive = contact.id === activeContactId;
            return (
              <motion.button
                key={contact.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectContact(contact.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 transition-all relative ${
                  isActive
                    ? "bg-blue-600/25 text-blue-200 border-blue-500/70 shadow-sm shadow-blue-500/20 font-semibold"
                    : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.14] hover:text-zinc-200"
                }`}
              >
                <span>{contact.name}</span>
                {contact.tag && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-black/40 text-zinc-400 border border-white/[0.06]">
                    {contact.tag}
                  </span>
                )}
              </motion.button>
            );
          })}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsNewContactModalOpen(true)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-white/[0.16] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.3] flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>New Contact</span>
          </motion.button>
        </div>

        {/* Active Contact Dossier Banner */}
        <div className="p-3.5 rounded-xl frosted-glass-subtle flex items-center justify-between border border-white/[0.06] text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-semibold text-zinc-200">{activeContact.name}</span>
            <span className="text-zinc-500 font-mono">({activeContact.tag})</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                getTrajectoryBadge(activeTrajectory).color
              }`}
            >
              <TrajectoryIcon className="w-3 h-3" />
              <span>{activeTrajectory}</span>
            </div>

            {activeContact.id !== "quick-scan" && (
              <button
                onClick={() => handleDeleteContact(activeContact.id)}
                className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                title="Delete contact dossier"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Fluid Spring Tab Switcher */}
      <div className="flex items-center p-1 rounded-2xl bg-zinc-950/70 border border-white/[0.06] relative shadow-inner z-10">
        <button
          onClick={() => setActiveTab("text")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium relative z-10 touch-target transition-colors ${
            activeTab === "text" ? "text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {activeTab === "text" && (
            <motion.div
              layoutId="tab-pill"
              className="absolute inset-0 rounded-xl frosted-glass bg-zinc-800/70 border-white/[0.16] shadow-sm z-[-1]"
              transition={springTransition}
            />
          )}
          <MessageSquare className="w-4 h-4" />
          <span>Raw Text Snippet</span>
        </button>

        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium relative z-10 touch-target transition-colors ${
            activeTab === "ocr" ? "text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {activeTab === "ocr" && (
            <motion.div
              layoutId="tab-pill"
              className="absolute inset-0 rounded-xl frosted-glass bg-zinc-800/70 border-white/[0.16] shadow-sm z-[-1]"
              transition={springTransition}
            />
          )}
          <ImageIcon className="w-4 h-4" />
          <span>Screenshot OCR</span>
        </button>
      </div>

      {/* Relationship Context Selector (Balanced 3x2 Grid) */}
      <div className="flex flex-col gap-2.5 relative z-10">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            Relationship Context
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">Calibrates subtext</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {CONTEXT_OPTIONS.map((ctx) => {
            const isSelected = selectedContext === ctx;
            return (
              <motion.button
                key={ctx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedContext(ctx)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium border text-center flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-blue-600/25 text-blue-200 border-blue-500/70 shadow-sm shadow-blue-500/20 font-semibold"
                    : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.14] hover:text-zinc-200"
                }`}
              >
                <span>{ctx}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Raw Text Input with Spring Interactions */}
      <AnimatePresence mode="wait">
        {activeTab === "text" ? (
          <motion.div
            key="text-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 relative z-10"
          >
            {/* Equal-Height Quick Scenario Cards Grid */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium">Quick Scenarios:</span>
                <span className="text-[11px] text-zinc-500 font-mono">1-tap populate</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SAMPLE_PRESETS.map((preset) => (
                  <motion.button
                    key={preset.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={springTransition}
                    onClick={() => handlePresetSelect(preset)}
                    className="min-h-[64px] p-3.5 rounded-xl text-left frosted-glass-subtle hover:bg-zinc-800/60 text-zinc-300 border-white/[0.06] hover:border-white/[0.16] transition-all flex flex-col justify-between shadow-sm"
                  >
                    <span className="font-medium text-xs text-zinc-200 truncate">{preset.title}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{preset.context}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Textarea Input Card */}
            <div className="relative flex flex-col rounded-2xl frosted-glass focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all overflow-hidden shadow-lg">
              <textarea
                ref={textareaRef}
                value={messages}
                onChange={(e) => {
                  setMessages(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste their text, timestamps, or full conversation snippet here... (e.g. 'Them [10:30 PM]: haha maybe next week!')"
                rows={4}
                className="w-full bg-transparent px-4.5 pt-4 pb-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none min-h-[120px] leading-relaxed"
              />

              <div className="flex items-center justify-between px-4.5 py-3 bg-black/40 border-t border-white/[0.06] text-xs text-zinc-500 font-mono">
                <span className="flex items-center gap-2">
                  <span>{messages.length} characters</span>
                  {imageFileName && (
                    <span className="text-blue-400 flex items-center gap-1">
                      <FileImage className="w-3 h-3" />
                      {imageFileName}
                    </span>
                  )}
                </span>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages("");
                      setUploadedImage(null);
                      setImageFileName(null);
                    }}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Tab 2: Interactive Screenshot OCR Drag & Drop + Simulation */
          <motion.div
            key="ocr-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col gap-4 p-6 sm:p-8 rounded-2xl frosted-glass border-2 border-dashed transition-all text-center items-center justify-center min-h-[220px] relative z-10 ${
              isDragging
                ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                : "border-white/[0.14] hover:border-white/[0.22]"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processImageFile(e.target.files[0]);
                }
              }}
            />

            {uploadedImage ? (
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <div className="relative rounded-xl overflow-hidden border border-white/[0.16] shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedImage}
                    alt="Uploaded screenshot"
                    className="max-h-48 w-auto object-contain rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setUploadedImage(null);
                      setImageFileName(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-zinc-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {isExtractingOcr ? (
                  <div className="flex items-center gap-2 text-xs text-blue-400 font-mono">
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span>Extracting text timestamps & cadence...</span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">
                    Screenshot loaded: <span className="text-zinc-200 font-mono">{imageFileName}</span>
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl frosted-glass-subtle flex items-center justify-center text-blue-400 mb-1 shadow-md">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">
                    Drag & Drop or Paste Screenshot
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                    Drop your iMessage, WhatsApp, or Hinge screenshot here or press <span className="font-mono text-zinc-300">Ctrl+V / Cmd+V</span>.
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 touch-target flex items-center gap-2 mt-1"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>Choose Image File</span>
                </motion.button>

                <div className="flex items-center gap-2 my-1">
                  <div className="h-[1px] w-12 bg-white/[0.08]" />
                  <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">or test presets</span>
                  <div className="h-[1px] w-12 bg-white/[0.08]" />
                </div>

                <div className="flex flex-wrap gap-2.5 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      handlePresetSelect(SAMPLE_PRESETS[0]);
                      setActiveTab("text");
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-white/[0.08] hover:border-white/[0.18] touch-target flex items-center"
                  >
                    Simulate &ldquo;Cold 12h Delay&rdquo;
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      handlePresetSelect(SAMPLE_PRESETS[1]);
                      setActiveTab("text");
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-white/[0.08] hover:border-white/[0.18] touch-target flex items-center"
                  >
                    Simulate &ldquo;Late Night Wyd&rdquo;
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs relative z-10"
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shimmer Primary Action Button */}
      <motion.button
        whileHover={!loading && messages.trim() ? { scale: 1.01 } : {}}
        whileTap={!loading && messages.trim() ? { scale: 0.97 } : {}}
        disabled={loading || !messages.trim()}
        onClick={handleAnalyze}
        className={`w-full relative overflow-hidden py-4 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all touch-target z-10 ${
          loading || !messages.trim()
            ? "bg-zinc-900/80 text-zinc-500 border border-white/[0.04] cursor-not-allowed"
            : "shimmer-glow text-white shadow-xl shadow-blue-600/25 border border-blue-400/40 cursor-pointer"
        }`}
      >
        {loading ? (
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="font-mono text-xs tracking-wide">
              DECODING CONVERSATION DYNAMICS...
            </span>
          </div>
        ) : (
          <>
            <BrainCircuit className="w-4 h-4 text-blue-100" />
            <span>DECODE SUBTEXT & GENERATE PLAYS</span>
            <ArrowRight className="w-4 h-4 text-blue-100 ml-1" />
          </>
        )}
      </motion.button>

      {/* Tactical Pulse Scanner during Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="p-6 sm:p-8 rounded-2xl frosted-glass border-blue-500/40 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden shadow-2xl z-10"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-beam" />
            <div className="w-12 h-12 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center animate-pulse-subtle">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold font-mono text-zinc-100">
                {SCANNER_PHRASES[scanStepIndex]}
              </p>
              <p className="text-xs text-zinc-500">
                Applying non-neediness, outcome independence & voiceprint constraints
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staggered Dynamic Reveal for Analysis Results */}
      <AnimatePresence>
        {analysis && !loading && (
          <motion.div
            ref={resultsRef}
            variants={resultContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4 pt-1 relative z-10"
          >
            {/* Dynamic Status & Energy Bar */}
            <motion.div
              variants={resultItemVariants}
              className="p-4 rounded-2xl frosted-glass flex flex-wrap items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const badge = getStatusBadge(analysis.status);
                  const IconComp = badge.icon;
                  return (
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.bg}`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                  <span>ENERGY:</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getEnergyBadge(
                      analysis.energyLevel
                    )}`}
                  >
                    {analysis.energyLevel}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Blunt Psychological Subtext Banner */}
            <motion.div
              variants={resultItemVariants}
              className="p-5 sm:p-6 rounded-2xl frosted-glass flex flex-col gap-2.5 shadow-md border-blue-500/20"
            >
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider font-mono text-blue-400 uppercase">
                <Sparkles className="w-4 h-4" />
                <span>Psychological Subtext</span>
              </div>
              <p className="text-sm sm:text-base leading-relaxed text-zinc-200 font-normal">
                &ldquo;{analysis.subtext}&rdquo;
              </p>
            </motion.div>

            {/* Internal Monologue Thought Bubble */}
            <motion.div
              variants={resultItemVariants}
              className="p-5 sm:p-6 rounded-2xl frosted-glass border-purple-900/40 relative overflow-hidden shadow-md"
            >
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider font-mono text-purple-400 uppercase mb-2">
                <Eye className="w-4 h-4" />
                <span>Their Unfiltered Internal Monologue</span>
              </div>
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/30 text-purple-200/90 text-sm italic leading-relaxed">
                &ldquo;{analysis.internalMonologue}&rdquo;
              </div>
            </motion.div>

            {/* Fatal Communication Trap Alert */}
            <motion.div
              variants={resultItemVariants}
              className="p-5 sm:p-6 rounded-2xl bg-rose-950/25 border border-rose-900/50 flex flex-col gap-2 shadow-md"
            >
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider font-mono text-rose-400 uppercase">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>The Needy Trap To Avoid</span>
              </div>
              <p className="text-sm leading-relaxed text-rose-200/95 font-medium">
                {analysis.trapToAvoid}
              </p>
            </motion.div>

            {/* Tactical Response Plays Grid (Safe Play vs. Bold Play) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-stretch">
              {/* Play 1: Safe Play */}
              <motion.div
                variants={resultItemVariants}
                layout
                className="p-5 sm:p-6 rounded-2xl frosted-glass border-emerald-900/50 flex flex-col justify-between gap-5 relative shadow-lg h-full"
              >
                <div className="flex flex-col gap-3.5 flex-1">
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span>PLAY 1: SAFE PLAY</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-zinc-800/60 text-zinc-400 border border-white/[0.06]">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>LOW RISK</span>
                    </div>
                  </div>

                  {/* Dedicated Timing Pill */}
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-950/25 border border-emerald-800/25 text-emerald-300 text-xs font-mono leading-relaxed">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Timing: {analysis.safePlay.timing}</span>
                  </div>

                  {/* Suggested Reply Box */}
                  <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-800/35 text-emerald-100 text-sm font-medium leading-relaxed select-all">
                    {analysis.safePlay.reply}
                  </div>

                  {/* Expandable Reasoning Accordion */}
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <button
                      onClick={() => setSafeExpanded(!safeExpanded)}
                      className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 py-1"
                    >
                      <span className="font-semibold text-zinc-300">Why this preserves frame</span>
                      {safeExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <AnimatePresence>
                      {safeExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-zinc-400 leading-relaxed mt-1.5 overflow-hidden"
                        >
                          {analysis.safePlay.reasoning}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tactile Morph Copy Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCopy(analysis.safePlay.reply, "safe")}
                  className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 touch-target transition-all mt-auto"
                >
                  <AnimatePresence mode="wait">
                    {copiedKey === "safe" ? (
                      <motion.div
                        key="copied"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>COPIED TO CLIPBOARD</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY SAFE PLAY</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {/* Play 2: Bold Play */}
              <motion.div
                variants={resultItemVariants}
                layout
                className="p-5 sm:p-6 rounded-2xl frosted-glass border-amber-900/50 flex flex-col justify-between gap-5 relative shadow-lg h-full"
              >
                <div className="flex flex-col gap-3.5 flex-1">
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <span>PLAY 2: BOLD PLAY</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>HIGH LEVERAGE</span>
                    </div>
                  </div>

                  {/* Dedicated Focus Pill */}
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/25 border border-amber-800/25 text-amber-300 text-xs font-mono leading-relaxed">
                    <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>Focus: Polarizing Frame Shift</span>
                  </div>

                  {/* Suggested Reply Box */}
                  <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-800/35 text-amber-100 text-sm font-medium leading-relaxed select-all">
                    {analysis.boldPlay.reply}
                  </div>

                  {/* Expandable Reasoning Accordion */}
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <button
                      onClick={() => setBoldExpanded(!boldExpanded)}
                      className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 py-1"
                    >
                      <span className="font-semibold text-zinc-300">Strategic leverage & risk</span>
                      {boldExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <AnimatePresence>
                      {boldExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col gap-2 mt-1.5 overflow-hidden"
                        >
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            {analysis.boldPlay.reasoning}
                          </p>
                          <div className="text-xs text-amber-300/85 leading-relaxed bg-amber-950/30 p-2.5 rounded-lg border border-amber-900/40">
                            <span className="font-semibold text-amber-200">Risk factor: </span>
                            {analysis.boldPlay.risk}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tactile Morph Copy Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCopy(analysis.boldPlay.reply, "bold")}
                  className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 touch-target transition-all mt-auto"
                >
                  <AnimatePresence mode="wait">
                    {copiedKey === "bold" ? (
                      <motion.div
                        key="copied"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                        <span>COPIED TO CLIPBOARD</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY BOLD PLAY</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </div>

            {/* 🛑 3. THE "WALK-AWAY" DIGNITY DIAGNOSTIC CARD */}
            {analysis.walkAwayOption && (
              <motion.div
                variants={resultItemVariants}
                className="p-5 sm:p-6 rounded-2xl bg-rose-950/30 border border-rose-900/60 flex flex-col gap-4 relative shadow-xl overflow-hidden mt-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-rose-400" />
                      <span>THE WALK-AWAY PLAY (MAX DIGNITY)</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-rose-400/90 font-semibold uppercase tracking-wider">
                    RECOMMENDED MOVE
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-rose-900/40 flex flex-col gap-2">
                  <div className="text-xs text-zinc-400 font-mono">
                    <span className="text-rose-400 font-semibold">TRIGGER: </span>
                    {analysis.walkAwayOption.triggerReason}
                  </div>
                  <p className="text-sm font-medium text-rose-100/95 leading-relaxed">
                    &ldquo;{analysis.walkAwayOption.dignityRule}&rdquo;
                  </p>
                </div>

                {/* Re-engagement condition box */}
                <div className="border-t border-rose-900/40 pt-3">
                  <button
                    onClick={() => setWalkAwayExpanded(!walkAwayExpanded)}
                    className="w-full flex items-center justify-between text-xs text-rose-300/80 hover:text-rose-200 py-1"
                  >
                    <span className="font-semibold text-rose-200">Re-Engagement Condition Protocol</span>
                    {walkAwayExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <AnimatePresence>
                    {walkAwayExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-rose-200/80 leading-relaxed mt-2 bg-rose-950/40 p-3 rounded-lg border border-rose-900/40"
                      >
                        <span className="font-semibold text-rose-300 font-mono uppercase text-[10px]">Rule: </span>
                        {analysis.walkAwayOption.reEngagementCondition}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCopy("LEAVE ON READ", "walkaway")}
                  className="w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border border-rose-500/40 touch-target transition-all"
                >
                  <AnimatePresence mode="wait">
                    {copiedKey === "walkaway" ? (
                      <motion.div
                        key="copied"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-rose-400" />
                        <span>FRAME LOCKED: LEFT ON READ</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>EXECUTE WALK-AWAY (LEAVE ON READ)</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎙️ 1. VOICE CALIBRATION MODAL */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={springTransition}
              className="w-full max-w-lg p-6 sm:p-7 rounded-3xl frosted-glass border-white/[0.16] shadow-2xl flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl frosted-glass-subtle flex items-center justify-center text-blue-400 border-white/[0.1]">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100 uppercase font-mono tracking-tight">
                      Voice Calibration Engine
                    </h2>
                    <p className="text-[11px] text-zinc-400">Anti-Impostor Persona Constraints</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVoiceModalOpen(false)}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Style Flags Toggles */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-zinc-300 font-mono">STYLE CONSTRAINTS</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      setVoiceProfile((p) => ({
                        ...p,
                        styleToggles: {
                          ...p.styleToggles,
                          allLowercase: !p.styleToggles.allLowercase,
                        },
                      }))
                    }
                    className={`p-3 rounded-xl text-left border text-xs transition-all flex flex-col justify-between ${
                      voiceProfile.styleToggles.allLowercase
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/60 font-semibold"
                        : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span>All-Lowercase</span>
                    <span className="text-[10px] opacity-70 font-mono">no capital letters</span>
                  </button>

                  <button
                    onClick={() =>
                      setVoiceProfile((p) => ({
                        ...p,
                        styleToggles: {
                          ...p.styleToggles,
                          dryHumor: !p.styleToggles.dryHumor,
                        },
                      }))
                    }
                    className={`p-3 rounded-xl text-left border text-xs transition-all flex flex-col justify-between ${
                      voiceProfile.styleToggles.dryHumor
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/60 font-semibold"
                        : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span>Dry / Deadpan</span>
                    <span className="text-[10px] opacity-70 font-mono">understated irony</span>
                  </button>

                  <button
                    onClick={() =>
                      setVoiceProfile((p) => ({
                        ...p,
                        styleToggles: {
                          ...p.styleToggles,
                          fastAndPunchy: !p.styleToggles.fastAndPunchy,
                        },
                      }))
                    }
                    className={`p-3 rounded-xl text-left border text-xs transition-all flex flex-col justify-between ${
                      voiceProfile.styleToggles.fastAndPunchy
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/60 font-semibold"
                        : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span>Fast & Punchy</span>
                    <span className="text-[10px] opacity-70 font-mono">&lt; 7 words strictly</span>
                  </button>

                  <button
                    onClick={() =>
                      setVoiceProfile((p) => ({
                        ...p,
                        styleToggles: {
                          ...p.styleToggles,
                          zeroEmoji: !p.styleToggles.zeroEmoji,
                        },
                      }))
                    }
                    className={`p-3 rounded-xl text-left border text-xs transition-all flex flex-col justify-between ${
                      voiceProfile.styleToggles.zeroEmoji
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/60 font-semibold"
                        : "frosted-glass-subtle text-zinc-400 border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span>Zero Emoji</span>
                    <span className="text-[10px] opacity-70 font-mono">strictly 0 emojis</span>
                  </button>
                </div>
              </div>

              {/* Sample Texts Training Input */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-300 font-mono">
                  YOUR NATURAL TEXTING SAMPLES (OPTIONAL)
                </span>
                <textarea
                  value={voiceProfile.customSampleTexts}
                  onChange={(e) =>
                    setVoiceProfile((p) => ({
                      ...p,
                      customSampleTexts: e.target.value,
                    }))
                  }
                  placeholder="Paste 2-3 examples of how you naturally text friends (e.g. 'yeah for sure, catch you in 10, lol not a chance')..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-blue-500/60 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsVoiceModalOpen(false)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-blue-600/20"
              >
                SAVE VOICEPRINT & CONSTRAIN LLM
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 👥 2. NEW CONTACT CREATION MODAL */}
      <AnimatePresence>
        {isNewContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={springTransition}
              className="w-full max-w-md p-6 rounded-3xl frosted-glass border-white/[0.16] shadow-2xl flex flex-col gap-4 relative"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-sm font-bold text-zinc-100 uppercase font-mono">
                  Create Contact Dossier
                </h2>
                <button
                  onClick={() => setIsNewContactModalOpen(false)}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateContact} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400 font-mono">Contact Name</label>
                  <input
                    type="text"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Jessica, Alex, Maya"
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-blue-500/60 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400 font-mono">Platform / Tag</label>
                  <input
                    type="text"
                    value={newContactTag}
                    onChange={(e) => setNewContactTag(e.target.value)}
                    placeholder="e.g. Hinge, Bumble, Work, Met at Party"
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-blue-500/60 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-lg mt-2"
                >
                  CREATE DOSSIER
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📜 3. CONTACT HISTORY REPLAY DRAWER */}
      <AnimatePresence>
        {isHistoryDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={springTransition}
              className="w-full max-w-lg p-6 rounded-3xl frosted-glass border-white/[0.16] shadow-2xl flex flex-col gap-4 relative max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-zinc-100 uppercase font-mono">
                    Scan History: {activeContact.name}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {activeContact.history.length} analyses recorded
                  </p>
                </div>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {activeContact.history.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-6">No previous scans recorded yet.</p>
                ) : (
                  activeContact.history.map((record, index) => (
                    <div
                      key={record.id}
                      className="p-4 rounded-xl frosted-glass-subtle border border-white/[0.06] flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-zinc-500">Scan #{index + 1}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(record.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-medium line-clamp-2 italic">
                        &ldquo;{record.messages}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-blue-400 font-mono">Safe: {record.response.safePlay.reply}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-8 border-t border-white/[0.06] pt-4 pb-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono relative z-10">
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3 text-zinc-500" />
          <span>Decoded OS 3.0 • Standalone PWA</span>
        </div>
        <div>
          <span>Decoded &copy; 2026</span>
        </div>
      </footer>
    </main>
  );
}
