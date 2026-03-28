import { useState } from "react";
import { HelpCircle, Check, ChevronRight, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useMobile } from "@/hooks/useMobile";

interface QuestionOption {
  label: string;
  description?: string;
  preview?: string;
}

interface Question {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

interface AskUserQuestionInput {
  questions: Question[];
}

export function AskUserQuestion({ input, onAnswer }: {
  input: Record<string, unknown>;
  onAnswer?: (answer: string) => void;
}) {
  const data = input as unknown as AskUserQuestionInput;
  const questions = data.questions || [];
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Set<string>>>(new Map());
  const [customText, setCustomText] = useState("");
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  const { isMobile } = useMobile();

  if (questions.length === 0) return null;

  const question = questions[currentStep];
  const isMulti = question?.multiSelect ?? false;
  const isLast = currentStep === questions.length - 1;
  const selectedForStep = answers.get(currentStep) || new Set<string>();

  const toggleOption = (label: string) => {
    const next = new Map(answers);
    const current = new Set(selectedForStep);
    if (isMulti) {
      if (current.has(label)) current.delete(label);
      else current.add(label);
    } else {
      current.clear();
      current.add(label);
    }
    next.set(currentStep, current);
    setAnswers(next);
  };

  const handleSubmit = () => {
    if (!onAnswer) return;
    const parts: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const sel = answers.get(i);
      if (sel && sel.size > 0) {
        const labels = [...sel].map((label) => {
          const note = notes.get(`${i}-${label}`);
          return note ? `${label} [note: ${note}]` : label;
        });
        parts.push(labels.join(", "));
      }
    }
    if (customText.trim()) parts.push(customText.trim());
    onAnswer(parts.join(" | ") || "skipped");
    setSubmitted(true);
  };

  if (submitted) {
    const allAnswers = [...answers.entries()]
      .map(([, sel]) => [...sel].join(", "))
      .filter(Boolean)
      .join(" | ");
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 0", fontSize: 12, opacity: 0.6,
      }}>
        <Check size={14} color="var(--color-success)" />
        <span style={{ color: "var(--color-text-secondary)" }}>
          Answered: {allAnswers || customText || "skipped"}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      margin: "12px 0", borderRadius: 12, overflow: "hidden",
      border: "1px solid var(--color-border)",
      background: "var(--color-bg-elevated)",
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: "var(--color-accent)" }} />

      <div style={{ padding: 20 }}>
        {/* Header with step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <HelpCircle size={18} color="var(--color-accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
            Claude has a question
          </span>
          {questions.length > 1 && (
            <span style={{
              marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)",
              color: "var(--color-text-tertiary)",
            }}>
              {currentStep + 1} of {questions.length}
            </span>
          )}
        </div>

        {/* Progress dots */}
        {questions.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: 99,
                background: i < currentStep
                  ? "var(--color-success)"
                  : i === currentStep
                    ? "var(--color-accent)"
                    : "var(--color-bg-surface)",
                boxShadow: i === currentStep ? "0 0 6px rgba(212,132,90,0.4)" : "none",
                transition: "all 0.2s",
              }} />
            ))}
          </div>
        )}

        {/* Category badge */}
        {question.header && (
          <div style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 6,
            background: "rgba(212,132,90,0.1)", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: "var(--color-accent)", marginBottom: 12,
          }}>
            {question.header}
          </div>
        )}

        {/* Question text */}
        <div style={{
          fontSize: 15, fontWeight: 500, color: "var(--color-text)",
          marginBottom: 16, lineHeight: 1.5,
        }}>
          {question.question}
        </div>

        {/* Multi-select hint */}
        {isMulti && (
          <div style={{
            fontSize: 11, fontStyle: "italic", color: "var(--color-text-tertiary)",
            marginBottom: 10,
          }}>
            Select all that apply
          </div>
        )}

        {/* Options + Preview layout */}
        {(() => {
          const selectedOpt = question.options.find((o) => selectedForStep.has(o.label));
          const hasPreview = question.options.some((o) => o.preview);

          return (
            <div style={{
              display: "flex", gap: 16, marginBottom: 16,
              flexDirection: (hasPreview && !isMobile) ? "row" : "column",
            }}>
              {/* Options column */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 6,
                flex: (hasPreview && !isMobile) ? "0 0 50%" : "1",
                minWidth: 0,
              }}>
                {question.options.map((opt) => {
                  const isSelected = selectedForStep.has(opt.label);
                  const note = notes.get(`${currentStep}-${opt.label}`) || "";
                  return (
                    <div key={opt.label}>
                      <button
                        onClick={() => toggleOption(opt.label)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10, width: "100%",
                          padding: "12px 14px", borderRadius: 10, textAlign: "left",
                          cursor: "pointer", transition: "all 0.15s",
                          border: isSelected
                            ? "1px solid var(--color-accent)"
                            : "1px solid var(--color-border)",
                          background: isSelected ? "rgba(212,132,90,0.06)" : "var(--color-bg)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = "var(--color-text-tertiary)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = "var(--color-border)";
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: isMulti ? 4 : 99,
                          flexShrink: 0, marginTop: 1,
                          border: isSelected ? "none" : "2px solid var(--color-border)",
                          background: isSelected ? "var(--color-accent)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>
                            {opt.label}
                          </div>
                          {opt.description && (
                            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3, lineHeight: 1.4 }}>
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Per-option note input (shown when selected) */}
                      {isSelected && (
                        <div style={{
                          marginTop: 4, marginLeft: 28,
                          padding: "6px 10px", borderRadius: 6,
                          border: "1px solid var(--color-border-subtle)",
                          background: "var(--color-bg)",
                        }}>
                          <input
                            value={note}
                            onChange={(e) => {
                              const next = new Map(notes);
                              next.set(`${currentStep}-${opt.label}`, e.target.value);
                              setNotes(next);
                            }}
                            placeholder="Add a note (optional)..."
                            style={{
                              width: "100%", padding: "2px 0", border: "none", outline: "none",
                              background: "transparent", color: "var(--color-text-secondary)",
                              fontSize: 12, fontFamily: "var(--font-sans)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Other / custom input */}
                <div style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: "1px solid var(--color-border)", background: "var(--color-bg)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                    Other...
                  </div>
                  <input
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Type your own answer"
                    style={{
                      width: "100%", padding: "4px 0", border: "none", outline: "none",
                      background: "transparent", color: "var(--color-text)",
                      fontSize: 13, fontFamily: "var(--font-sans)",
                    }}
                  />
                </div>
              </div>

              {/* Preview column (only if any option has preview) */}
              {hasPreview && (
                <div style={{
                  flex: isMobile ? "1" : "0 0 48%", minWidth: 0,
                  borderRadius: 10, overflow: "hidden",
                  border: "1px solid var(--color-border-subtle)",
                  background: "var(--color-bg)",
                }}>
                  {selectedOpt?.preview ? (
                    <div style={{ padding: 16, maxHeight: 400, overflowY: "auto" }} className="claude-markdown">
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
                        {selectedOpt.preview}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{
                      height: "100%", minHeight: 120,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--color-text-tertiary)", fontSize: 12,
                    }}>
                      Select an option to see preview
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Navigation */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          borderTop: "1px solid var(--color-border-subtle)",
          paddingTop: 16,
        }}>
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "transparent", color: "var(--color-text-secondary)",
                fontSize: 13, cursor: "pointer",
              }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}

          <button
            onClick={() => {
              if (onAnswer) onAnswer("skipped");
              setSubmitted(true);
            }}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "transparent", color: "var(--color-text-tertiary)",
              fontSize: 12, cursor: "pointer",
            }}
          >
            Skip{questions.length > 1 ? " all" : ""}
          </button>

          <div style={{ flex: 1 }} />

          {!isLast ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={selectedForStep.size === 0 && !customText.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "8px 18px", borderRadius: 8, border: "none",
                background: "var(--color-accent)", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: (selectedForStep.size === 0 && !customText.trim()) ? 0.5 : 1,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={selectedForStep.size === 0 && !customText.trim()}
              style={{
                padding: "8px 22px", borderRadius: 8, border: "none",
                background: "var(--color-accent)", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: (selectedForStep.size === 0 && !customText.trim()) ? 0.5 : 1,
              }}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
