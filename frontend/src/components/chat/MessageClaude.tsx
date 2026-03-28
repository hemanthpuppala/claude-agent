import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCard } from "./ToolCard";
import { ToolResult } from "./ToolResult";
import type { AssistantMsg, ContentBlock } from "@/lib/types";

export function MessageClaude({ message }: { message: AssistantMsg }) {
  return (
    <div style={{ padding: "16px 0" }}>
      {/* Label */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)",
        marginBottom: 8,
      }}>
        Claude
      </div>

      {/* Content blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {message.content.map((block, i) => (
          <ContentBlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
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

    case "tool_use":
      return (
        <ToolCard
          toolName={block.name || "Unknown"}
          toolInput={block.input || {}}
          toolId={block.id || ""}
        />
      );

    case "tool_result":
      return (
        <ToolResult
          content={block.content || ""}
          isError={block.is_error || false}
        />
      );

    default:
      return null;
  }
}
