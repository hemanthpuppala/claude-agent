import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCard } from "./ToolCard";
import { AskUserQuestion } from "./AskUserQuestion";
import type { AssistantMsg, ContentBlock } from "@/lib/types";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Find the tool_result output for a given tool_use_id by scanning
 * all messages in the session. The result may be in a later message.
 */
function findToolOutput(sessionId: string | undefined, toolUseId: string): { content: string; isError: boolean } | null {
  if (!sessionId || !toolUseId) return null;
  const session = useSessionStore.getState().getSession(sessionId);
  if (!session) return null;

  for (const msg of session.messages) {
    if (msg.type !== "assistant") continue;
    const assistant = msg as AssistantMsg;
    for (const block of assistant.content) {
      if (block.type === "tool_result" && block.tool_use_id === toolUseId) {
        return { content: block.content || "", isError: block.is_error || false };
      }
    }
  }
  return null;
}

export function MessageClaude({ message, sessionId }: { message: AssistantMsg; sessionId?: string }) {
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {message.content.map((block, i) => (
          <ContentBlockRenderer key={i} block={block} sessionId={sessionId} />
        ))}
      </div>
    </div>
  );
}

function ContentBlockRenderer({ block, sessionId }: { block: ContentBlock; sessionId?: string }) {
  switch (block.type) {
    case "text":
      return (
        <div className="claude-markdown" style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text)" }}>
          <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
            {block.text || ""}
          </ReactMarkdown>
        </div>
      );

    case "thinking":
      return <ThinkingBlock text={block.thinking || ""} />;

    case "tool_use": {
      const name = block.name || "Unknown";
      if (name === "ToolSearch" || name === "ListMcpResourcesTool" || name === "ReadMcpResourceTool") return null;
      if (name === "AskUserQuestion") {
        return <AskUserQuestion input={block.input || {}} />;
      }
      // Find the matching tool_result output
      const result = findToolOutput(sessionId, block.id || "");
      return (
        <ToolCard
          toolName={name}
          toolInput={block.input || {}}
          toolId={block.id || ""}
          output={result?.content}
          outputError={result?.isError}
        />
      );
    }

    case "tool_result":
      // Don't render standalone — it's displayed inside the ToolCard above
      return null;

    default:
      return null;
  }
}
